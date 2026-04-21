import {
  acp,
  Agent,
  Fireline,
  type ManagedAgentSessionHandle,
  type ManagedAgentSessionSnapshot,
  type ManagedAgentStopResult,
} from '@fireline/client/managed-agent'

export const config = { runtime: 'edge' }

interface VercelEdgeEnv {
  readonly FIRELINE_ENDPOINT?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
  readonly VERCEL_EDGE_TENANT_ID?: string
  readonly VERCEL_EDGE_RUN_ID?: string
  readonly VERCEL_EDGE_ATTEMPT_ID?: string
  readonly VERCEL_EDGE_PROMPT?: string
}

interface LaunchBody {
  readonly tenantId?: string
  readonly runId?: string
  readonly attemptId?: string
  readonly prompt?: string
}

interface LaunchConfig {
  readonly controlStream: string
  readonly endpoint: string
  readonly requestedBy: string
}

type SessionSnapshot = ManagedAgentSessionSnapshot
type FetchEventWithRequest = Event & {
  readonly request: Request
  respondWith(response: Promise<Response> | Response): void
}

const defaultControlStream = 'fireline-vercel-edge-control'
const defaultStreamsPort = '7474'
const requestedBy = 'examples/13-vercel-edge-runtime'

export async function fetch(request: Request, env: VercelEdgeEnv = runtimeEnv()): Promise<Response> {
  return await handleVercelEdgeRequest(request, env)
}

export async function handleVercelEdgeRequest(
  request: Request,
  env: VercelEdgeEnv = runtimeEnv(),
): Promise<Response> {
  try {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/') {
      return jsonResponse({
        example: '13-vercel-edge-runtime',
        runtime: 'vercel-edge',
        routes: {
          launchAndStop: 'POST /api/fireline-launch',
        },
        config: deriveConfig(env),
      })
    }
    if (request.method === 'POST' && url.pathname === '/api/fireline-launch') {
      return jsonResponse(await runVercelEdgeLaunch({
        env,
        body: await readJsonBody(request),
      }))
    }
    return jsonResponse({ ok: false, error: 'Not found' }, 404)
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500)
  }
}

export async function runVercelEdgeLaunch(options: {
  readonly env: VercelEdgeEnv
  readonly body?: LaunchBody
}) {
  const input = normalizeLaunchInput(options.env, options.body ?? {})
  const config = deriveConfig(options.env)
  const clientRequestId = stableClientRequestId(input)
  const fireline = new Fireline({
    endpoint: config.endpoint,
    fetch: globalThis.fetch,
    requestedBy: config.requestedBy,
  })
  const agent = await createAgent(clientRequestId, input)

  let session: ManagedAgentSessionHandle | undefined
  try {
    session = await fireline.session(agent, {
      idempotencyKey: clientRequestId,
      requestedBy: config.requestedBy,
    })
    const snapshot = await session.waitUntil('session_ready', { timeoutMs: 60_000 })
    const stop = await session.stop({
      clientRequestId,
      requestedBy: config.requestedBy,
      reason: 'Vercel Edge Runtime example complete',
      wait: {
        until: 'terminal',
        timeoutMs: 60_000,
      },
    })

    return summarizeRun({
      config,
      input,
      launchId: session.launchId,
      sessionSnapshot: snapshot,
      stop,
    })
  } finally {
    session?.close()
    fireline.close()
  }
}

async function createAgent(
  revision: string,
  input: ReturnType<typeof normalizeLaunchInput>,
) {
  return new Agent({
    id: 'vercel-edge-runtime',
    entrypoint: await acp.inlineJsBundle({
      entrypoint: 'agent.mjs',
      files: [{
        path: 'agent.mjs',
        mediaType: 'text/javascript',
        content: `
          export default async function vercelEdgeRuntimeExample(ctx) {
            await ctx.session.text("Vercel Edge Runtime example reached Fireline.")
            await ctx.session.text(${JSON.stringify(`tenant=${input.tenantId}`)})
            await ctx.session.complete()
          }
        `,
      }],
      provenance: {
        producer: 'fireline-examples-discovery',
        source: 'examples/13-vercel-edge-runtime',
        revision,
      },
    }),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: '13-vercel-edge-runtime',
        runtime: 'vercel-edge',
      },
    },
    defaults: {
      prompt: input.prompt,
      cwd: '/',
      mcpServers: [],
      runtime: {
        name: 'vercel-edge-runtime',
        provider: 'local',
        labels: {
          example: '13-vercel-edge-runtime',
          tenantId: input.tenantId,
          runtime: 'vercel-edge',
        },
      },
      wait: {
        until: 'session',
        timeoutMs: 60_000,
      },
    },
  })
}

async function readJsonBody(request: Request): Promise<LaunchBody> {
  if (!request.headers.get('content-type')?.includes('application/json')) return {}
  return await request.json() as LaunchBody
}

function summarizeRun(options: {
  readonly config: LaunchConfig
  readonly input: ReturnType<typeof normalizeLaunchInput>
  readonly launchId: string
  readonly sessionSnapshot: SessionSnapshot
  readonly stop: ManagedAgentStopResult
}) {
  const stopRow = options.stop.row ?? options.sessionSnapshot
  return {
    ok: true,
    example: '13-vercel-edge-runtime',
    edgeRuntime: edgeRuntimeVersion(),
    controlStream: options.config.controlStream,
    endpoint: options.config.endpoint,
    tenantId: options.input.tenantId,
    launchId: options.launchId,
    sessionId: options.sessionSnapshot.sessionId,
    sessionStatus: options.sessionSnapshot.status,
    requiredActions: options.sessionSnapshot.requiredActions.map((action) => action.type),
    stopId: options.stop.envelope.value.stopId,
    stopStatus: stopRow.status,
  }
}

function deriveConfig(env: VercelEdgeEnv): LaunchConfig {
  const controlStream = env.FIRELINE_CONTROL_STREAM ?? defaultControlStream
  if (env.FIRELINE_ENDPOINT) {
    return {
      controlStream,
      endpoint: env.FIRELINE_ENDPOINT,
      requestedBy,
    }
  }
  const durableStreamsBase =
    env.FIRELINE_DURABLE_STREAMS_URL ??
    `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? defaultStreamsPort}/v1/stream`
  return {
    controlStream,
    endpoint: `${trimTrailingSlash(durableStreamsBase)}/${encodeURIComponent(controlStream)}`,
    requestedBy,
  }
}

function normalizeLaunchInput(env: VercelEdgeEnv, body: LaunchBody) {
  return {
    tenantId: body.tenantId ?? env.VERCEL_EDGE_TENANT_ID ?? 'tenant-vercel-edge',
    runId: body.runId ?? env.VERCEL_EDGE_RUN_ID ?? `run-${Date.now()}`,
    attemptId: body.attemptId ?? env.VERCEL_EDGE_ATTEMPT_ID ?? 'attempt-1',
    prompt: body.prompt ?? env.VERCEL_EDGE_PROMPT ?? 'Run the Vercel Edge Runtime example.',
  }
}

function stableClientRequestId(input: ReturnType<typeof normalizeLaunchInput>): string {
  return [
    'launch',
    'vercel-edge-runtime',
    safeIdPart(input.tenantId),
    safeIdPart(input.runId),
    safeIdPart(input.attemptId),
  ].join(':')
}

function runtimeEnv(): VercelEdgeEnv {
  return ((globalThis as typeof globalThis & {
    FIRELINE_VERCEL_EDGE_ENV?: VercelEdgeEnv
  }).FIRELINE_VERCEL_EDGE_ENV ?? {})
}

function edgeRuntimeVersion(): string | undefined {
  return (globalThis as typeof globalThis & { EdgeRuntime?: string }).EdgeRuntime
}

function safeIdPart(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return cleaned.replace(/^-+|-+$/g, '') || 'unknown'
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

globalThis.addEventListener?.('fetch', ((event: Event) => {
  const fetchEvent = event as FetchEventWithRequest
  fetchEvent.respondWith(handleVercelEdgeRequest(fetchEvent.request))
}) as EventListener)
