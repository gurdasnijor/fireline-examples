import {
  createManagedAgentLaunchRequest,
} from '@fireline/client/managed-agent'
import {
  launchManagedAgent,
  observeManagedAgent,
  stopManagedAgent,
  type ManagedAgentLaunchRow,
} from '../../shared/managed-agent-launch.js'
import type { AppActor, AppLaunchIntent, AppLaunchSummary } from './framework-boundary.js'
import { createWorkerAgentBundle } from './generated-worker-agent.js'

export interface ServerWorkerWrapperConfig {
  readonly env: NodeJS.ProcessEnv
  readonly authToken: string
  readonly requestedBy?: string
}

export interface AppLaunchRequest {
  readonly authorization: string
  readonly actor: AppActor
  readonly intent: AppLaunchIntent
}

export interface AppStopRequest {
  readonly authorization: string
  readonly actor: AppActor
  readonly tenantId: string
  readonly launchId: string
  readonly clientRequestId: string
}

export function createServerWorkerWrapper(config: ServerWorkerWrapperConfig) {
  const controlStreamUrl = resolveLaunchControlStreamUrl(config.env)
  const requestedBy = config.requestedBy ?? 'examples/11-server-worker-wrapper'

  return {
    controlStreamUrl,
    async submitLaunch(request: AppLaunchRequest): Promise<{
      readonly summary: AppLaunchSummary
      readonly row: ManagedAgentLaunchRow
    }> {
      const actor = authorize({
        authorization: request.authorization,
        expectedToken: config.authToken,
        actor: request.actor,
        tenantId: request.intent.tenantId,
        requiredScope: 'fireline:launch',
      })
      const clientRequestId = stableClientRequestId(request.intent)
      const launch = await launchManagedAgent({
        controlStreamUrl,
        idempotencyKey: clientRequestId,
        requestedBy,
        timeoutMs: 60_000,
        request: createManagedAgentLaunchRequest({
          name: 'server-worker-wrapper',
          agent: await createWorkerAgentBundle({ revision: clientRequestId, intent: request.intent }),
          sandbox: {
            provider: 'local',
            fsBackend: 'streamFs',
            env: {
              APP_TENANT_ID: request.intent.tenantId,
              APP_DOCUMENT_ID: request.intent.documentId,
            },
            labels: {
              example: '11-server-worker-wrapper',
              boundary: 'server-worker',
              tenantId: request.intent.tenantId,
            },
          },
          middleware: {
            kind: 'middleware',
            chain: [],
          },
          clientRequestId,
          runtime: {
            name: 'server-worker-wrapper',
            provider: 'local',
            labels: {
              example: '11-server-worker-wrapper',
              tenantId: actor.tenantId,
              documentId: request.intent.documentId,
            },
          },
          startSession: {
            stateStream: sessionStateStream(request.intent),
            create: true,
            cwd: '/',
            mcpServers: [],
            prompt: request.intent.prompt,
          },
          wait: {
            until: 'session',
            timeoutMs: 60_000,
          },
        }),
      })
      const events = [
        `authorized tenant ${actor.tenantId}`,
        `appended ${launch.handle.requestEnvelope?.type ?? 'fireline.launch_request'}`,
        `observed collections.launches row ${launch.row.launchId}`,
      ]

      try {
        const stop = await stopManagedAgent({
          handle: launch.handle,
          clientRequestId,
          requestedBy,
          reason: 'server wrapper smoke complete',
          timeoutMs: 60_000,
        })
        events.push('appended fireline.launch_stop')
        events.push(`observed stop row ${stop.row.status}`)

        return {
          row: launch.row,
          summary: {
            accepted: true,
            tenantId: actor.tenantId,
            launchId: launch.row.launchId,
            clientRequestId: launch.row.clientRequestId,
            launchStatus: launch.row.status,
            runtime: launch.row.runtime
              ? {
                  runtimeId: launch.row.runtime.runtimeId,
                  acpUrl: launch.row.runtime.acp.url,
                }
              : undefined,
            session: launch.row.startSession
              ? {
                  acpSessionId: launch.row.startSession.acpSessionId,
                }
              : undefined,
            stopStatus: stop.row.status,
            events,
          },
        }
      } finally {
        launch.handle.close()
      }
    },
    async stopLaunch(request: AppStopRequest): Promise<ManagedAgentLaunchRow> {
      authorize({
        authorization: request.authorization,
        expectedToken: config.authToken,
        actor: request.actor,
        tenantId: request.tenantId,
        requiredScope: 'fireline:stop',
      })
      const handle = observeManagedAgent({
        controlStreamUrl,
        launchId: request.launchId,
        requestedBy,
      })
      try {
        const stop = await stopManagedAgent({
          handle,
          clientRequestId: request.clientRequestId,
          requestedBy,
          reason: 'app requested stop through server wrapper',
          timeoutMs: 60_000,
        })
        return stop.row
      } finally {
        handle.close()
      }
    },
  }
}

function authorize(options: {
  readonly authorization: string
  readonly expectedToken: string
  readonly actor: AppActor
  readonly tenantId: string
  readonly requiredScope: string
}): AppActor {
  if (options.authorization !== `Bearer ${options.expectedToken}`) {
    throw new Error('unauthorized: invalid bearer token')
  }
  if (options.actor.tenantId !== options.tenantId) {
    throw new Error('forbidden: actor tenant does not match request tenant')
  }
  if (!options.actor.scopes.includes(options.requiredScope)) {
    throw new Error(`forbidden: missing ${options.requiredScope}`)
  }
  return options.actor
}

function resolveLaunchControlStreamUrl(env: NodeJS.ProcessEnv): string {
  if (env.FIRELINE_LAUNCH_CONTROL_STREAM_URL) return env.FIRELINE_LAUNCH_CONTROL_STREAM_URL

  const controlStream = env.FIRELINE_CONTROL_STREAM ?? 'fireline-server-wrapper-control'
  if (env.FIRELINE_DURABLE_STREAMS_URL) {
    return `${env.FIRELINE_DURABLE_STREAMS_URL.replace(/\/$/, '')}/${encodeURIComponent(controlStream)}`
  }

  const localBaseUrl = `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? '7474'}`
  return `${localBaseUrl}/v1/stream/${encodeURIComponent(controlStream)}`
}

function stableClientRequestId(intent: AppLaunchIntent): string {
  return [
    'launch',
    'server-wrapper',
    safeIdPart(intent.tenantId),
    safeIdPart(intent.documentId),
    safeIdPart(intent.runId),
    safeIdPart(intent.attemptId),
  ].join(':')
}

function sessionStateStream(intent: AppLaunchIntent): string {
  return [
    'server-wrapper',
    safeIdPart(intent.tenantId),
    safeIdPart(intent.documentId),
    safeIdPart(intent.runId),
    safeIdPart(intent.attemptId),
    'session',
  ].join('-')
}

function safeIdPart(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return cleaned.replace(/^-+|-+$/g, '') || 'unknown'
}
