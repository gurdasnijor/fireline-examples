import {
  Agent,
  Fireline,
} from '@fireline/client/managed-agent'
import type { FlamecastRunIntent, FlamecastRunSummary } from './framework-boundary.js'
import { createGeneratedHarnessAgent } from './generated-harness.js'

export async function runFlamecastCharacterization(
  intent: FlamecastRunIntent,
): Promise<FlamecastRunSummary> {
  const clientRequestId = stableClientRequestId(intent)
  const fireline = new Fireline({
    endpoint: intent.endpoint,
    requestedBy: intent.requestedBy,
    defaults: {
      wait: {
        until: 'session_ready',
        timeoutMs: 60_000,
      },
    },
  })
  const agent = new Agent({
    id: 'flamecast-v3-shaped',
    entrypoint: await createGeneratedHarnessAgent({
      revision: clientRequestId,
      composition: intent.composition,
    }),
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
    defaults: {
      runtime: {
        name: 'flamecast-v3-shaped',
        provider: 'local',
        labels: {
          example: '06-flamecast-v3-shaped',
          framework: 'flamecast-v3-shaped',
          workspaceId: intent.workspaceId,
        },
      },
      wait: {
        until: 'session',
        timeoutMs: 60_000,
      },
    },
  })

  const events = [
    `created agent ${agent.id}`,
    `resolved endpoint ${intent.endpoint}`,
  ]
  let session:
    | Awaited<ReturnType<Fireline['session']>>
    | undefined
  try {
    let followUpSent = false
    let followUpStopReason: string | undefined
    let sessionStatus: string | undefined
    let requiredActions: readonly string[] = []
    let followUpError: unknown
    session = await fireline.session(agent, {
      idempotencyKey: clientRequestId,
      requestedBy: intent.requestedBy,
      prompt: 'prepare flamecast composition runtime',
      cwd: '/',
      mcpServers: [],
      advanced: {
        startSession: {
          stateStream: sessionStateStream(intent),
          create: true,
        },
        request: {
          clientRequestId,
        },
      },
    })
    const ready = session.current()
    sessionStatus = ready.status
    requiredActions = ready.requiredActions.map((action) => action.type)
    events.push(`opened session ${ready.sessionId ?? 'pending'}`)
    if (requiredActions.length > 0) {
      events.push(`session requires actions: ${requiredActions.join(', ')}`)
    }
    try {
      const result = await session.chat(
        intent.followUpPrompt ?? 'complete the flamecast characterization run',
      )
      followUpSent = true
      followUpStopReason = result.stopReason
      const afterChat = session.current()
      sessionStatus = afterChat.status
      requiredActions = afterChat.requiredActions.map((action) => action.type)
      events.push(`sent session chat to ${result.sessionId}`)
      if (requiredActions.length > 0) {
        events.push(`session requires actions after chat: ${requiredActions.join(', ')}`)
      }
    } catch (error) {
      followUpError = error
      events.push(
        `session chat failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    const stop = await session.stop({
      clientRequestId,
      reason: 'flamecast-shaped characterization complete',
      wait: { until: 'terminal', timeoutMs: 60_000 },
    })
    events.push(`appended ${stop.envelope.type}`)
    events.push(`observed stop row ${stop.row?.status}`)
    if (followUpError) throw followUpError

    return {
      launchId: session.launchId,
      clientRequestId,
      session: {
        sessionId: session.current().sessionId,
        status: sessionStatus,
        followUpSent,
        stopReason: followUpStopReason,
        requiredActions,
      },
      stopStatus: stop.row?.status ?? 'unknown',
      events,
    }
  } finally {
    session?.close()
    fireline.close()
  }
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
