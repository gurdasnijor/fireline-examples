import {
  agentDefinition,
  jsModuleAgentForm,
  launchSpec,
  newSessionRequest,
  textPrompt,
} from '@fireline/client/spec'
import type { LaunchRow } from '@fireline/state'
import { appendAndObserveLaunch, appendAndObserveLaunchStop } from '../../shared/stream-launch.js'
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
  const requestedBy = config.requestedBy ?? 'examples/07-server-worker-wrapper'

  return {
    controlStreamUrl,
    async submitLaunch(request: AppLaunchRequest): Promise<{
      readonly summary: AppLaunchSummary
      readonly row: LaunchRow
    }> {
      const actor = authorize({
        authorization: request.authorization,
        expectedToken: config.authToken,
        actor: request.actor,
        tenantId: request.intent.tenantId,
        requiredScope: 'fireline:launch',
      })
      const clientRequestId = stableClientRequestId(request.intent)
      const launch = await appendAndObserveLaunch({
        controlStreamUrl,
        idempotencyKey: clientRequestId,
        requestedBy,
        timeoutMs: 60_000,
        request: launchSpec(
          await createDefinition(request.intent, clientRequestId),
          {
            clientRequestId,
            runtime: {
              name: 'server-worker-wrapper',
              provider: 'local',
              labels: {
                example: '07-server-worker-wrapper',
                tenantId: actor.tenantId,
                documentId: request.intent.documentId,
              },
            },
            startSession: {
              stateStream: sessionStateStream(request.intent),
              create: true,
              newSession: newSessionRequest({
                cwd: '/',
                mcpServers: [],
              }),
              prompt: textPrompt(request.intent.prompt),
            },
            wait: {
              until: 'session',
              timeoutMs: 60_000,
            },
          },
        ),
      })
      const events = [
        `authorized tenant ${actor.tenantId}`,
        `appended ${launch.envelope.type}`,
        `observed collections.launches row ${launch.row.launchId}`,
      ]

      try {
        const stop = await appendAndObserveLaunchStop({
          controlStreamUrl,
          launchId: launch.row.launchId,
          clientRequestId,
          requestedBy,
          reason: 'server wrapper smoke complete',
          timeoutMs: 60_000,
        })
        events.push(`appended ${stop.envelope.type}`)
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
        launch.db.close()
      }
    },
    async stopLaunch(request: AppStopRequest): Promise<LaunchRow> {
      authorize({
        authorization: request.authorization,
        expectedToken: config.authToken,
        actor: request.actor,
        tenantId: request.tenantId,
        requiredScope: 'fireline:stop',
      })
      const stop = await appendAndObserveLaunchStop({
        controlStreamUrl,
        launchId: request.launchId,
        clientRequestId: request.clientRequestId,
        requestedBy,
        reason: 'app requested stop through server wrapper',
        timeoutMs: 60_000,
      })
      return stop.row
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

async function createDefinition(intent: AppLaunchIntent, clientRequestId: string) {
  return agentDefinition({
    name: 'server-worker-wrapper',
    agent: jsModuleAgentForm({
      artifact: await createWorkerAgentBundle({ revision: clientRequestId, intent }),
    }),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      env: {
        APP_TENANT_ID: intent.tenantId,
        APP_DOCUMENT_ID: intent.documentId,
      },
      labels: {
        example: '07-server-worker-wrapper',
        boundary: 'server-worker',
        tenantId: intent.tenantId,
      },
    },
    middleware: {
      kind: 'middleware',
      chain: [],
    },
  })
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
