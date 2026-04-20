import { createManagedAgentClient } from '@fireline/client/managed-agent'
import {
  agentDefinition,
  jsModuleAgentForm,
  launchSpec,
  newSessionRequest,
  textPrompt,
} from '@fireline/client/spec'
import type { ManagedAgentLaunchHandle } from '@fireline/client/managed-agent'
import type { FlamecastRunIntent, FlamecastRunSummary } from './framework-boundary.js'
import { createGeneratedHarnessBundle } from './generated-harness.js'

export async function runFlamecastCharacterization(
  intent: FlamecastRunIntent,
): Promise<FlamecastRunSummary> {
  const clientRequestId = stableClientRequestId(intent)
  const client = createManagedAgentClient({
    launchControlStreamUrl: intent.controlStreamUrl,
    requestedBy: intent.requestedBy,
    defaults: {
      stopReason: 'flamecast-shaped characterization complete',
    },
  })
  const handle = await client.launch(
    launchSpec(
      await createDefinition(intent, clientRequestId),
      {
        clientRequestId,
        runtime: {
          name: 'flamecast-v3-shaped',
          provider: 'local',
          labels: {
            example: '06-flamecast-v3-shaped',
            framework: 'flamecast-v3-shaped',
            workspaceId: intent.workspaceId,
          },
        },
        startSession: {
          stateStream: sessionStateStream(intent),
          create: true,
          newSession: newSessionRequest({
            cwd: '/',
            mcpServers: [],
          }),
          prompt: textPrompt('prepare flamecast composition runtime'),
        },
        wait: {
          until: 'session',
          timeoutMs: 60_000,
        },
      },
    ),
    {
      idempotencyKey: clientRequestId,
      wait: false,
    },
  )

  const row = await handle.waitUntil('session_ready', { timeoutMs: 60_000 })

  const events = [
    `appended ${handle.requestEnvelope?.type}`,
    `observed managed-agent launch row ${row.launchId}`,
  ]
  try {
    let followUpSent = false
    let followUpError: unknown
    try {
      followUpSent = await attachAndMaybePrompt({
        handle,
        clientName: 'flamecast-v3-shaped-consumer',
        followUpPrompt: intent.followUpPrompt ?? 'complete the flamecast characterization run',
        events,
      })
    } catch (error) {
      followUpError = error
      events.push(`ACP follow-up failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    const stop = await handle.stop({
      clientRequestId,
      reason: 'flamecast-shaped characterization complete',
      wait: { until: 'terminal', timeoutMs: 60_000 },
    })
    events.push(`appended ${stop.envelope.type}`)
    events.push(`observed stop row ${stop.row?.status}`)
    if (followUpError) throw followUpError

    return {
      launchId: row.launchId,
      clientRequestId: row.clientRequestId,
      launchStatus: row.status,
      runtime: row.runtime
        ? {
            runtimeId: row.runtime.runtimeId,
            acpUrl: row.runtime.acp.url,
            stateUrl: row.runtime.state.url,
          }
        : undefined,
      session: row.startSession
        ? {
            acpSessionId: row.startSession.acpSessionId,
            followUpSent,
          }
        : undefined,
      stopStatus: stop.row?.status ?? 'unknown',
      events,
    }
  } finally {
    handle.close()
    client.close()
  }
}

async function createDefinition(intent: FlamecastRunIntent, clientRequestId: string) {
  const artifact = await createGeneratedHarnessBundle({
    revision: clientRequestId,
    composition: intent.composition,
  })
  return agentDefinition({
    name: 'flamecast-v3-shaped',
    agent: jsModuleAgentForm({ artifact }),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      env: {
        FLAMECAST_WORKSPACE_ID: intent.workspaceId,
        FLAMECAST_SCENE_COUNT: String(intent.composition.sceneCount),
        FLAMECAST_TONE: intent.composition.tone,
      },
      labels: {
        example: '06-flamecast-v3-shaped',
        mode: 'black-box-characterization',
        framework: 'flamecast-v3-shaped',
      },
    },
    middleware: {
      kind: 'middleware',
      chain: [],
    },
  })
}

function stableClientRequestId(intent: FlamecastRunIntent): string {
  return [
    'launch',
    'flamecast-shaped',
    safeIdPart(intent.workspaceId),
    safeIdPart(intent.runId),
    safeIdPart(intent.attemptId),
  ].join(':')
}

function sessionStateStream(intent: FlamecastRunIntent): string {
  return [
    'flamecast-shaped',
    safeIdPart(intent.workspaceId),
    safeIdPart(intent.runId),
    safeIdPart(intent.attemptId),
    'session',
  ].join('-')
}

function safeIdPart(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return cleaned.replace(/^-+|-+$/g, '') || 'unknown'
}

async function attachAndMaybePrompt(options: {
  readonly handle: ManagedAgentLaunchHandle
  readonly clientName: string
  readonly followUpPrompt: string
  readonly events: string[]
}): Promise<boolean> {
  const sessionId = options.handle.current()?.startSession?.acpSessionId
  if (!sessionId) {
    options.events.push('skipped ACP follow-up because launch row lacked coordinates')
    return false
  }

  const acp = await options.handle.connectBrowserAcp({
    clientName: options.clientName,
    wait: { until: 'session_ready', timeoutMs: 60_000 },
    onSessionUpdate(notification) {
      options.events.push(`acp update ${JSON.stringify(notification).slice(0, 160)}`)
    },
  })
  try {
    await acp.connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text: options.followUpPrompt }],
    })
    options.events.push(`sent ACP follow-up to ${sessionId}`)
    return true
  } finally {
    await acp.close()
  }
}
