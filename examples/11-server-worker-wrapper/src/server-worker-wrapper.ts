import { Agent, Fireline } from '@fireline/client/managed-agent'
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
  const endpoint = resolveEndpoint(config.env)
  const requestedBy = config.requestedBy ?? 'examples/11-server-worker-wrapper'

  return {
    endpoint,
    async submitLaunch(request: AppLaunchRequest): Promise<{
      readonly summary: AppLaunchSummary
    }> {
      const actor = authorize({
        authorization: request.authorization,
        expectedToken: config.authToken,
        actor: request.actor,
        tenantId: request.intent.tenantId,
        requiredScope: 'fireline:launch',
      })
      const clientRequestId = stableClientRequestId(request.intent)
      const fireline = new Fireline({
        endpoint,
        requestedBy,
        defaults: {
          wait: {
            until: 'session_ready',
            timeoutMs: 60_000,
          },
          stopReason: 'server wrapper smoke complete',
        },
      })
      const agent = new Agent({
        id: 'server-worker-wrapper',
        entrypoint: await createWorkerAgentBundle({
          revision: clientRequestId,
          intent: request.intent,
        }),
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
        defaults: {
          runtime: {
            name: 'server-worker-wrapper',
            provider: 'local',
            labels: {
              example: '11-server-worker-wrapper',
              tenantId: actor.tenantId,
              documentId: request.intent.documentId,
            },
          },
          wait: {
            until: 'session',
            timeoutMs: 60_000,
          },
        },
      })
      const session = await fireline.session(agent, {
        prompt: request.intent.prompt,
        cwd: '/',
        mcpServers: [],
        idempotencyKey: clientRequestId,
        requestedBy,
        advanced: {
          startSession: {
            stateStream: sessionStateStream(request.intent),
            create: true,
          },
          request: {
            clientRequestId,
          },
        },
      })
      const events = [
        `authorized tenant ${actor.tenantId}`,
        `opened managed-agent session ${session.launchId}`,
      ]

      try {
        const ready = session.current()
        events.push(`observed session status ${ready.status ?? 'unknown'}`)
        const stop = await session.stop({
          clientRequestId,
          requestedBy,
          reason: 'server wrapper smoke complete',
          wait: {
            until: 'terminal',
            timeoutMs: 60_000,
          },
        })
        events.push('requested managed-agent stop')
        events.push(`observed stop row ${stop.row?.status ?? 'unknown'}`)

        return {
          summary: {
            accepted: true,
            tenantId: actor.tenantId,
            launchId: session.launchId,
            clientRequestId,
            launchStatus: ready.status ?? 'unknown',
            session: ready.sessionId
              ? {
                  acpSessionId: ready.sessionId,
                }
              : undefined,
            stopStatus: stop.row?.status ?? 'unknown',
            events,
          },
        }
      } finally {
        await session.close()
        fireline.close()
      }
    },
    async stopLaunch(request: AppStopRequest) {
      authorize({
        authorization: request.authorization,
        expectedToken: config.authToken,
        actor: request.actor,
        tenantId: request.tenantId,
        requiredScope: 'fireline:stop',
      })
      const fireline = new Fireline({
        endpoint,
        requestedBy,
      })
      const session = await fireline.reconnect({
        launchId: request.launchId,
      })
      try {
        const stop = await session.stop({
          clientRequestId: request.clientRequestId,
          requestedBy,
          reason: 'app requested stop through server wrapper',
          wait: {
            until: 'terminal',
            timeoutMs: 60_000,
          },
        })
        return {
          launchId: session.launchId,
          status: stop.row?.status ?? session.current().status ?? 'unknown',
          requiredActions: session.current().requiredActions,
        }
      } finally {
        await session.close()
        fireline.close()
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

function resolveEndpoint(env: NodeJS.ProcessEnv): string {
  if (env.FIRELINE_ENDPOINT) return env.FIRELINE_ENDPOINT

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
