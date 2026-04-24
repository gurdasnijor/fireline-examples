import fireline, {
  mailbox,
  mailboxRows,
  type FirelineClaimedMailboxHandle,
  type FirelineMailboxAddress,
  type FirelineMailboxClient,
  type FirelineMailboxClientOptions,
  type FirelineMailboxReceiveInput,
  type FirelineMailboxSendInput,
  type MailboxRow,
} from '@fireline/client'

export type DemoAgentId = string

export interface MailboxDemoAgent {
  readonly id: DemoAgentId
  readonly mailbox: FirelineMailboxAddress
  readonly label: string
  readonly role: 'launcher' | 'worker' | 'observer'
}

export interface MailboxDemoHarnessConfig {
  readonly mailboxStreamUrl: string
  readonly stateStreamUrl: string
  readonly agents: readonly MailboxDemoAgent[]
  readonly headers?: Record<string, string>
  readonly fetch?: typeof fetch
  readonly signal?: AbortSignal
}

export interface MailboxDemoTaskPayload {
  readonly demoKind: 'mailbox-agent-task'
  readonly taskId: string
  readonly requestedBy: DemoAgentId
  readonly event: {
    readonly type: 'handoff.requested'
    readonly prompt: string
  }
  readonly metadata: {
    readonly source: 'fireline-examples'
    readonly demo: 'mono-dsbh'
  }
}

export interface MailboxDemoOutputPayload {
  readonly demoKind: 'mailbox-agent-output'
  readonly taskId: string
  readonly text: string
  readonly producedBy: DemoAgentId
}

export interface AgentInboxItem {
  readonly agentId: DemoAgentId
  readonly row: MailboxRow
}

export interface AgentRosterItem {
  readonly agent: MailboxDemoAgent
  readonly visible: number
  readonly claimed: number
  readonly completed: number
  readonly retryable: number
  readonly deadLetter: number
}

export interface DemoOutputItem {
  readonly taskId: string
  readonly messageId: string
  readonly producedBy: DemoAgentId
  readonly text: string
  readonly createdAt: string
  readonly status: MailboxRow['status']
}

export interface MailboxDemoSnapshot {
  readonly rows: readonly MailboxRow[]
  readonly roster: readonly AgentRosterItem[]
  readonly inbox: ReadonlyMap<DemoAgentId, readonly AgentInboxItem[]>
  readonly outputs: readonly DemoOutputItem[]
}

export interface MailboxDemoHarness {
  readonly clients: ReadonlyMap<DemoAgentId, FirelineMailboxClient>
  readonly snapshot: () => MailboxDemoSnapshot
  readonly subscribe: (
    callback: (snapshot: MailboxDemoSnapshot) => void,
  ) => { unsubscribe(): void }
  readonly sendTask: (input: {
    readonly intentId: string
    readonly from: DemoAgentId
    readonly to: DemoAgentId
    readonly taskId: string
    readonly prompt: string
    readonly signal?: AbortSignal
  }) => Promise<{ messageId: string }>
  readonly receiveFor: (
    agentId: DemoAgentId,
    input?: FirelineMailboxReceiveInput,
  ) => Promise<readonly FirelineClaimedMailboxHandle[]>
  readonly close: () => void
}

export async function createMailboxDemoHarness(
  config: MailboxDemoHarnessConfig,
): Promise<MailboxDemoHarness> {
  const agentById = new Map(config.agents.map((agent) => [agent.id, agent]))
  const clientOptions: FirelineMailboxClientOptions = {
    streamUrl: config.mailboxStreamUrl,
    headers: config.headers,
    fetch: config.fetch,
    signal: config.signal,
  }
  const clients = new Map(
    config.agents.map((agent) => [
      agent.id,
      mailbox(agent.mailbox, clientOptions),
    ]),
  )
  const db = await fireline.db({
    stateStreamUrl: config.stateStreamUrl,
    headers: config.headers,
    fetch: config.fetch,
    signal: config.signal,
    schemas: {
      mailbox: mailboxRows,
    },
  })

  const currentRows = () => db.collections.mailbox.toArray
  const snapshot = () => createMailboxDemoSnapshot(config.agents, currentRows())

  return {
    clients,
    snapshot,
    subscribe(callback) {
      return db.collections.mailbox.subscribe((rows) => {
        callback(createMailboxDemoSnapshot(config.agents, rows))
      })
    },
    async sendTask(input) {
      const from = requiredAgent(agentById, input.from)
      const to = requiredAgent(agentById, input.to)
      return requiredClient(clients, to.id).send({
        kind: 'task',
        from: from.mailbox,
        payload: {
          demoKind: 'mailbox-agent-task',
          taskId: input.taskId,
          requestedBy: input.from,
          event: {
            type: 'handoff.requested',
            prompt: input.prompt,
          },
          metadata: {
            demo: 'mono-dsbh',
            source: 'fireline-examples',
          },
        } satisfies MailboxDemoTaskPayload,
        correlationId: input.taskId,
        replyTo: from.mailbox,
        idempotencyKey: input.intentId,
        signal: input.signal,
      } satisfies FirelineMailboxSendInput)
    },
    async receiveFor(agentId, input = {}) {
      const result = await requiredClient(clients, agentId).receive(input)
      return result.messages
    },
    close() {
      db.close()
    },
  }
}

export function createMailboxDemoSnapshot(
  agents: readonly MailboxDemoAgent[],
  rows: readonly MailboxRow[],
): MailboxDemoSnapshot {
  const inbox = new Map<DemoAgentId, readonly AgentInboxItem[]>()
  for (const agent of agents) {
    inbox.set(agent.id, selectAgentInbox(rows, agent))
  }

  return {
    rows,
    roster: agents.map((agent) => createRosterItem(agent, rows)),
    inbox,
    outputs: selectDemoOutputs(rows),
  }
}

export function selectAgentInbox(
  rows: readonly MailboxRow[],
  agent: MailboxDemoAgent,
): readonly AgentInboxItem[] {
  return rows
    .filter((row) => row.mailbox.name === agent.mailbox.name)
    .map((row) => ({ agentId: agent.id, row }))
}

export function selectDemoOutputs(rows: readonly MailboxRow[]): readonly DemoOutputItem[] {
  return rows.flatMap((row) => {
    if (!isOutputPayload(row.payload)) {
      return []
    }
    return [{
      taskId: row.payload.taskId,
      messageId: row.messageId,
      producedBy: row.payload.producedBy,
      text: row.payload.text,
      createdAt: row.createdAt,
      status: row.status,
    }]
  })
}

function createRosterItem(
  agent: MailboxDemoAgent,
  rows: readonly MailboxRow[],
): AgentRosterItem {
  const inbox = rows.filter((row) => row.mailbox.name === agent.mailbox.name)
  return {
    agent,
    visible: inbox.filter((row) => row.status === 'visible').length,
    claimed: inbox.filter((row) => row.status === 'claimed').length,
    completed: inbox.filter((row) => row.status === 'completed').length,
    retryable: inbox.filter((row) => row.status === 'retryable').length,
    deadLetter: inbox.filter((row) => row.status === 'dead_letter').length,
  }
}

function requiredAgent(
  agents: ReadonlyMap<DemoAgentId, MailboxDemoAgent>,
  id: DemoAgentId,
): MailboxDemoAgent {
  const agent = agents.get(id)
  if (!agent) {
    throw new Error(`unknown mailbox demo agent '${id}'`)
  }
  return agent
}

function requiredClient(
  clients: ReadonlyMap<DemoAgentId, FirelineMailboxClient>,
  id: DemoAgentId,
): FirelineMailboxClient {
  const client = clients.get(id)
  if (!client) {
    throw new Error(`unknown mailbox demo client '${id}'`)
  }
  return client
}

function isOutputPayload(value: unknown): value is MailboxDemoOutputPayload {
  if (!isRecord(value)) {
    return false
  }
  return (
    value.demoKind === 'mailbox-agent-output' &&
    typeof value.taskId === 'string' &&
    typeof value.text === 'string' &&
    typeof value.producedBy === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
