import {
  acpRegistry,
  type ResolveAcpRegistryOptions,
} from '@fireline/client'
import { connectBrowserAcp } from '@fireline/client/acp-browser'
import {
  appendLaunchRequest,
  appendLaunchStop,
} from '@fireline/client/events'
import {
  agentDefinition,
  launchSpec,
  newSessionRequest,
  textPrompt,
  type LaunchSpec,
} from '@fireline/client/spec'
import {
  budget,
  contextInjection,
  trace,
} from '@fireline/client/middleware'
import type { LaunchRow } from '@fireline/state'
import { createFirelineDB } from '@fireline/state'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface RegistryChatEnv {
  readonly FIRELINE_LAUNCH_CONTROL_STREAM_URL?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
  readonly ACP_REGISTRY_CHAT_RUN_ID?: string
  readonly ACP_REGISTRY_CHAT_ATTEMPT_ID?: string
  readonly ACP_REGISTRY_CHAT_INITIAL_PROMPT?: string
  readonly ACP_REGISTRY_CHAT_FOLLOW_UP_PROMPT?: string
}

interface RegistryChatConfig {
  readonly controlStream: string
  readonly controlStreamUrl: string
  readonly requestedBy: string
}

const exampleId = '17-acp-registry-chat'
const registryAgentId = 'fireline-example-registry-echo'
const registryAgentVersion = '0.0.1'
const defaultControlStream = 'fireline-acp-registry-chat-control'
const defaultStreamsPort = '7474'
const requestedBy = `examples/${exampleId}`

const summary = await runRegistryChat(process.env)
console.log(JSON.stringify(summary, null, 2))

async function runRegistryChat(env: RegistryChatEnv) {
  const config = deriveConfig(env)
  const input = normalizeInput(env)
  const clientRequestId = stableClientRequestId(input)
  const registryAgent = await acpRegistry(registryAgentId, {
    catalog: registryCatalog(),
    transport: 'command',
  } satisfies ResolveAcpRegistryOptions)
  const request = launchSpec(agentDefinition({
    name: registryAgentId,
    agent: registryAgent,
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: exampleId,
        source: 'acp-registry-fixture',
      },
    },
    middleware: {
      kind: 'middleware',
      chain: [
        trace({
          streamName: `audit:${exampleId}`,
          includeMethods: ['session/new', 'session/prompt'],
        }),
        contextInjection({
          prependText: 'Registry chat example context: reply in one short sentence.',
          placement: 'prepend',
        }),
        budget({ tokens: 10_000 }),
      ],
    },
  }), {
    clientRequestId,
    runtime: {
      name: exampleId,
      provider: 'local',
      labels: {
        example: exampleId,
        registryAgentId,
      },
    },
    startSession: {
      stateStream: sessionStateStream(input),
      create: true,
      newSession: newSessionRequest({
        cwd: process.cwd(),
        mcpServers: [],
      }),
      prompt: textPrompt(input.initialPrompt),
    },
    wait: {
      until: 'session',
      timeoutMs: 60_000,
    },
  })

  const launch = await appendLaunchRequestAndObserve({
    controlStreamUrl: config.controlStreamUrl,
    request,
    clientRequestId,
    requestedBy: config.requestedBy,
  })
  const followUp = await promptLaunchedSession({
    row: launch,
    prompt: input.followUpPrompt,
  })
  const stop = await appendLaunchStop({
    streamUrl: config.controlStreamUrl,
    launchId: launch.launchId,
    clientRequestId,
    requestedBy: config.requestedBy,
    reason: 'ACP registry chat example complete',
  })
  const stopped = await waitForLaunchRow({
    stateStreamUrl: config.controlStreamUrl,
    launchId: launch.launchId,
    timeoutMs: 60_000,
    predicate: (row) => row.status === 'stopped' || row.status === 'failed',
  })
  if (stopped.status === 'failed') {
    throw new Error(stopped.error?.message ?? `Launch ${stopped.launchId} failed while stopping`)
  }

  return {
    ok: true,
    example: exampleId,
    controlStream: config.controlStream,
    registry: {
      agentId: registryAgentId,
      version: registryAgentVersion,
      transport: 'command',
      command: registryAgent.command,
    },
    launchId: launch.launchId,
    clientRequestId: launch.clientRequestId,
    launchStatus: launch.status,
    runtime: launch.runtime
      ? {
          runtimeId: launch.runtime.runtimeId,
          acpUrl: launch.runtime.acp.url,
        }
      : undefined,
    session: launch.startSession
      ? {
          acpSessionId: launch.startSession.acpSessionId,
        }
      : undefined,
    followUp,
    stopId: stop.value.stopId,
    stopStatus: stopped.status,
  }
}

async function appendLaunchRequestAndObserve(options: {
  readonly controlStreamUrl: string
  readonly request: LaunchSpec
  readonly clientRequestId: string
  readonly requestedBy: string
}): Promise<LaunchRow> {
  const envelope = await appendLaunchRequest({
    streamUrl: options.controlStreamUrl,
    request: options.request,
    idempotencyKey: options.clientRequestId,
    requestedBy: options.requestedBy,
  })
  const row = await waitForLaunchRow({
    stateStreamUrl: options.controlStreamUrl,
    launchId: envelope.value.launchId,
    timeoutMs: 60_000,
    predicate: (candidate) =>
      candidate.status === 'failed' || Boolean(candidate.runtime && candidate.startSession),
  })
  if (row.status === 'failed') {
    throw new Error(row.error?.message ?? `Launch ${row.launchId} failed`)
  }
  return row
}

async function promptLaunchedSession(options: {
  readonly row: LaunchRow
  readonly prompt: string
}) {
  const acpUrl = options.row.runtime?.acp.url
  const sessionId = options.row.startSession?.acpSessionId
  if (!acpUrl || !sessionId) {
    throw new Error(`Launch ${options.row.launchId} did not expose ACP session coordinates`)
  }
  const chunks: string[] = []
  const acp = await connectBrowserAcp({
    url: acpUrl,
    clientName: 'fireline-examples-acp-registry-chat',
    clientVersion: '0.0.0',
    onSessionUpdate(notification) {
      const update = notification.update
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
        chunks.push(update.content.text)
      }
    },
  })
  try {
    const result = await acp.connection.prompt({
      sessionId,
      prompt: textPrompt(options.prompt),
    })
    return {
      stopReason: result.stopReason,
      text: chunks.join(''),
    }
  } finally {
    await acp.close()
  }
}

async function waitForLaunchRow(options: {
  readonly stateStreamUrl: string
  readonly launchId: string
  readonly timeoutMs: number
  readonly predicate: (row: LaunchRow) => boolean
}): Promise<LaunchRow> {
  const db = createFirelineDB({ stateStreamUrl: options.stateStreamUrl })
  try {
    await db.preload()
    const existing = db.collections.launches.toArray.find((row) =>
      row.launchId === options.launchId && options.predicate(row)
    )
    if (existing) return existing
    return await new Promise((resolvePromise, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out waiting for launch ${options.launchId}`))
      }, options.timeoutMs)
      let subscription: { unsubscribe(): void } | undefined
      let unsubscribeAfterAssign = false
      const cleanup = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (subscription) {
          subscription.unsubscribe()
        } else {
          unsubscribeAfterAssign = true
        }
      }
      subscription = db.collections.launches.subscribe((rows) => {
        const row = rows.find((candidate) =>
          candidate.launchId === options.launchId && options.predicate(candidate)
        )
        if (!row) return
        cleanup()
        resolvePromise(row)
      })
      if (unsubscribeAfterAssign) subscription.unsubscribe()
    })
  } finally {
    db.close()
  }
}

function registryCatalog() {
  return {
    agents: [{
      id: registryAgentId,
      version: registryAgentVersion,
      distribution: {
        command: {
          command: process.execPath,
          args: [registryAgentPath()],
        },
      },
    }],
  }
}

function registryAgentPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../registry-agent.mjs')
}

function deriveConfig(env: RegistryChatEnv): RegistryChatConfig {
  const controlStream = env.FIRELINE_CONTROL_STREAM ?? defaultControlStream
  if (env.FIRELINE_LAUNCH_CONTROL_STREAM_URL) {
    return {
      controlStream,
      controlStreamUrl: env.FIRELINE_LAUNCH_CONTROL_STREAM_URL,
      requestedBy,
    }
  }
  const durableStreamsBase =
    env.FIRELINE_DURABLE_STREAMS_URL ??
    `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? defaultStreamsPort}/v1/stream`
  return {
    controlStream,
    controlStreamUrl: `${trimTrailingSlash(durableStreamsBase)}/${encodeURIComponent(controlStream)}`,
    requestedBy,
  }
}

function normalizeInput(env: RegistryChatEnv) {
  return {
    runId: env.ACP_REGISTRY_CHAT_RUN_ID ?? `run-${Date.now()}`,
    attemptId: env.ACP_REGISTRY_CHAT_ATTEMPT_ID ?? 'attempt-1',
    initialPrompt: env.ACP_REGISTRY_CHAT_INITIAL_PROMPT ??
      'Start a registry-selected ACP chat session.',
    followUpPrompt: env.ACP_REGISTRY_CHAT_FOLLOW_UP_PROMPT ??
      'Reply with the registry id you were launched from.',
  }
}

function stableClientRequestId(input: ReturnType<typeof normalizeInput>): string {
  return [
    'launch',
    exampleId,
    safeIdPart(input.runId),
    safeIdPart(input.attemptId),
  ].join(':')
}

function sessionStateStream(input: ReturnType<typeof normalizeInput>): string {
  return [
    exampleId,
    safeIdPart(input.runId),
    safeIdPart(input.attemptId),
    'session',
  ].join('-')
}

function safeIdPart(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return cleaned.replace(/^-+|-+$/g, '') || 'unknown'
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
