export interface FlamecastComposition {
  readonly title: string
  readonly sceneCount: number
  readonly tone: 'brief' | 'detailed'
}

export interface FlamecastRunIntent {
  readonly controlStreamUrl: string
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
  readonly launchStatus: string
  readonly runtime?: {
    readonly runtimeId: string
    readonly acpUrl: string
    readonly stateUrl?: string
  }
  readonly session?: {
    readonly acpSessionId: string
    readonly followUpSent: boolean
  }
  readonly stopStatus: string
  readonly events: readonly string[]
}

export function createFlamecastIntentFromEnv(env: NodeJS.ProcessEnv): FlamecastRunIntent {
  const controlStreamUrl = requiredEnv(env, 'FIRELINE_LAUNCH_CONTROL_STREAM_URL')
  return {
    controlStreamUrl,
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
  return JSON.stringify({
    example: '06-flamecast-v3-shaped',
    launchId: summary.launchId,
    clientRequestId: summary.clientRequestId,
    launchStatus: summary.launchStatus,
    runtime: summary.runtime,
    session: summary.session,
    stopStatus: summary.stopStatus,
    events: summary.events,
  }, null, 2)
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string): string {
  if (name === 'FIRELINE_LAUNCH_CONTROL_STREAM_URL') {
    return resolveLaunchControlStreamUrl(env)
  }
  const value = env[name]
  if (!value) {
    throw new Error(`${name} is required. Configure the durable launch/control stream URL.`)
  }
  return value
}

function resolveLaunchControlStreamUrl(env: NodeJS.ProcessEnv): string {
  if (env.FIRELINE_LAUNCH_CONTROL_STREAM_URL) return env.FIRELINE_LAUNCH_CONTROL_STREAM_URL

  const controlStream = env.FIRELINE_CONTROL_STREAM ?? 'fireline-flamecast-shaped-control'
  if (env.FIRELINE_DURABLE_STREAMS_URL) {
    return `${env.FIRELINE_DURABLE_STREAMS_URL.replace(/\/$/, '')}/${encodeURIComponent(controlStream)}`
  }

  const localBaseUrl = `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? '7474'}`
  return `${localBaseUrl}/v1/stream/${encodeURIComponent(controlStream)}`
}
