export interface FlamecastComposition {
  readonly title: string
  readonly sceneCount: number
  readonly tone: 'brief' | 'detailed'
}

export interface FlamecastRunIntent {
  readonly controlStreamUrl: string
  readonly composition: FlamecastComposition
  readonly workspaceId: string
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
  const value = env[name]
  if (!value) {
    throw new Error(`${name} is required. Configure the durable launch/control stream URL.`)
  }
  return value
}
