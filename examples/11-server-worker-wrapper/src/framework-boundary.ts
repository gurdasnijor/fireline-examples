export interface AppActor {
  readonly tenantId: string
  readonly userId: string
  readonly scopes: readonly string[]
}

export interface AppLaunchIntent {
  readonly tenantId: string
  readonly documentId: string
  readonly runId: string
  readonly attemptId: string
  readonly title: string
  readonly prompt: string
}

export interface AppLaunchSummary {
  readonly accepted: boolean
  readonly tenantId: string
  readonly launchId: string
  readonly clientRequestId?: string
  readonly launchStatus: string
  readonly runtime?: {
    readonly runtimeId: string
    readonly acpUrl: string
  }
  readonly session?: {
    readonly acpSessionId: string
  }
  readonly stopStatus: string
  readonly events: readonly string[]
}

export interface DemoServerConfig {
  readonly authToken: string
  readonly actor: AppActor
  readonly intent: AppLaunchIntent
}

export function createDemoServerConfig(env: NodeJS.ProcessEnv): DemoServerConfig {
  const tenantId = env.APP_TENANT_ID ?? 'tenant-alpha'
  const runId = env.APP_RUN_ID ?? `run-${Date.now()}`
  const attemptId = env.APP_ATTEMPT_ID ?? 'attempt-1'
  return {
    authToken: env.APP_AUTH_TOKEN ?? 'server-wrapper-demo-token',
    actor: {
      tenantId,
      userId: env.APP_USER_ID ?? 'user-001',
      scopes: ['fireline:launch', 'fireline:stop'],
    },
    intent: {
      tenantId,
      runId,
      attemptId,
      documentId: env.APP_DOCUMENT_ID ?? 'doc-local-001',
      title: env.APP_TITLE ?? 'Server wrapper launch',
      prompt: env.APP_PROMPT ?? 'prepare the server-owned launch wrapper result',
    },
  }
}

export function renderSummary(summary: AppLaunchSummary): string {
  return JSON.stringify({
    example: '07-server-worker-wrapper',
    accepted: summary.accepted,
    tenantId: summary.tenantId,
    launchId: summary.launchId,
    clientRequestId: summary.clientRequestId,
    launchStatus: summary.launchStatus,
    runtime: summary.runtime,
    session: summary.session,
    stopStatus: summary.stopStatus,
    events: summary.events,
  }, null, 2)
}
