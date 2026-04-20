import { connectBrowserAcp } from '@fireline/client/acp-browser'
import { appendAndObserveLaunch, appendAndObserveLaunchStop } from '../../shared/stream-launch.js'
import {
  agentDefinition,
  jsModuleAgentForm,
  launchSpec,
  newSessionRequest,
  textPrompt,
} from '@fireline/client/spec'
import type { LaunchRow } from '@fireline/state'
import type { FlamecastRunIntent, FlamecastRunSummary } from './framework-boundary.js'
import { createGeneratedHarnessBundle } from './generated-harness.js'

export async function runFlamecastCharacterization(
  intent: FlamecastRunIntent,
): Promise<FlamecastRunSummary> {
  const clientRequestId = stableClientRequestId(intent)
  const launch = await appendAndObserveLaunch({
    controlStreamUrl: intent.controlStreamUrl,
    idempotencyKey: clientRequestId,
    requestedBy: intent.requestedBy,
    timeoutMs: 60_000,
    request: launchSpec(
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
  })

  const events = [
    `appended ${launch.envelope.type}`,
    `observed collections.launches row ${launch.row.launchId}`,
  ]
  try {
    let followUpSent = false
    let followUpError: unknown
    try {
      followUpSent = await attachAndMaybePrompt({
        row: launch.row,
        clientName: 'flamecast-v3-shaped-consumer',
        followUpPrompt: intent.followUpPrompt ?? 'complete the flamecast characterization run',
        events,
      })
    } catch (error) {
      followUpError = error
      events.push(`ACP follow-up failed: ${error instanceof Error ? error.message : String(error)}`)
    }
    const stop = await appendAndObserveLaunchStop({
      controlStreamUrl: intent.controlStreamUrl,
      launchId: launch.row.launchId,
      clientRequestId,
      requestedBy: intent.requestedBy,
      reason: 'flamecast-shaped characterization complete',
      timeoutMs: 60_000,
    })
    events.push(`appended ${stop.envelope.type}`)
    events.push(`observed stop row ${stop.row.status}`)
    if (followUpError) throw followUpError

    return {
      launchId: launch.row.launchId,
      clientRequestId: launch.row.clientRequestId,
      launchStatus: launch.row.status,
      runtime: launch.row.runtime
        ? {
            runtimeId: launch.row.runtime.runtimeId,
            acpUrl: launch.row.runtime.acp.url,
            stateUrl: launch.row.runtime.state.url,
          }
        : undefined,
      session: launch.row.startSession
        ? {
            acpSessionId: launch.row.startSession.acpSessionId,
            followUpSent,
          }
        : undefined,
      stopStatus: stop.row.status,
      events,
    }
  } finally {
    launch.db.close()
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
  readonly row: LaunchRow
  readonly clientName: string
  readonly followUpPrompt: string
  readonly events: string[]
}): Promise<boolean> {
  const acpUrl = options.row.runtime?.acp.url
  const sessionId = options.row.startSession?.acpSessionId
  if (!acpUrl || !sessionId) {
    options.events.push('skipped ACP follow-up because launch row lacked coordinates')
    return false
  }

  const acp = await connectBrowserAcp({
    url: acpUrl,
    clientName: options.clientName,
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
