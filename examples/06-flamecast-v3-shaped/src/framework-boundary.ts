export interface FlamecastComposition {
  readonly title: string
  readonly sceneCount: number
  readonly tone: 'brief' | 'detailed'
}

export interface FlamecastRunIntent {
  readonly endpoint: string
  readonly composition: FlamecastComposition
  readonly workspaceId: string
  readonly runId: string
  readonly attemptId: string
  readonly requestedBy: string
  readonly followUpPrompt?: string
}

export interface FlamecastRunSummary {
  readonly launchId: string
  readonly clientRequestId?: string
  readonly session?: {
    readonly sessionId?: string
    readonly status?: string
    readonly followUpSent: boolean
    readonly stopReason?: string
    readonly requiredActions: readonly string[]
  }
  readonly stopStatus: string
  readonly events: readonly string[]
}

export function createFlamecastIntentFromEnv(env: NodeJS.ProcessEnv): FlamecastRunIntent {
  return {
    endpoint: resolveEndpoint(env),
    workspaceId: env.FLAMECAST_WORKSPACE_ID ?? 'local-flamecast-shaped-workspace',
    runId: env.FLAMECAST_RUN_ID ?? `local-${Date.now()}`,
    attemptId: env.FLAMECAST_ATTEMPT_ID ?? 'attempt-1',
    requestedBy: env.FLAMECAST_REQUESTED_BY ?? 'examples/06-flamecast-v3-shaped',
    followUpPrompt: env.FLAMECAST_FOLLOW_UP_PROMPT,
    composition: {
      title: env.FLAMECAST_TITLE ?? 'Launch Surface Characterization',
      sceneCount: Number.parseInt(env.FLAMECAST_SCENE_COUNT ?? '3', 10),
      tone: env.FLAMECAST_TONE === 'detailed' ? 'detailed' : 'brief',
    },
  }
}

export function renderSummary(summary: FlamecastRunSummary): string {
  return JSON.stringify(
    {
      example: '06-flamecast-v3-shaped',
      launchId: summary.launchId,
      clientRequestId: summary.clientRequestId,
      session: summary.session,
      stopStatus: summary.stopStatus,
      events: summary.events,
    },
    null,
    2,
  )
}

function resolveEndpoint(env: NodeJS.ProcessEnv): string {
  if (env.FIRELINE_ENDPOINT) return env.FIRELINE_ENDPOINT

  const controlStream = env.FIRELINE_CONTROL_STREAM ?? 'fireline-flamecast-shaped-control'
  if (env.FIRELINE_DURABLE_STREAMS_URL) {
    return `${env.FIRELINE_DURABLE_STREAMS_URL.replace(/\/$/, '')}/${encodeURIComponent(controlStream)}`
  }

  const localBaseUrl = `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? '7474'}`
  return `${localBaseUrl}/v1/stream/${encodeURIComponent(controlStream)}`
}
