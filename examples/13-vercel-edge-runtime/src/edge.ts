import {
  appendLaunchRequest,
  appendLaunchStop,
  type LaunchRequestEnvelope,
  type LaunchStopEnvelope,
} from '@fireline/client/events'
import {
  agentDefinition,
  inlineBundleArtifact,
  jsModuleAgentForm,
  launchSpec,
  newSessionRequest,
  textPrompt,
} from '@fireline/client/spec'
import { createFirelineDB, type LaunchRow } from '@fireline/state'

export const config = { runtime: 'edge' }

interface VercelEdgeEnv {
  readonly FIRELINE_LAUNCH_CONTROL_STREAM_URL?: string
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
  readonly controlStreamUrl: string
  readonly requestedBy: string
}

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
      const derived = deriveConfig(env)
      return jsonResponse({
        example: '13-vercel-edge-runtime',
        runtime: 'vercel-edge',
        routes: {
          launchAndStop: 'POST /api/fireline-launch',
        },
        config: derived,
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
  const launchInput = normalizeLaunchInput(options.env, options.body ?? {})
  const derived = deriveConfig(options.env)
  const clientRequestId = stableClientRequestId(launchInput)
  const definition = await createDefinition(clientRequestId, launchInput)
  const request = launchSpec(definition, {
    clientRequestId,
    runtime: {
      name: 'vercel-edge-runtime',
      provider: 'local',
      labels: {
        example: '13-vercel-edge-runtime',
        tenantId: launchInput.tenantId,
        runtime: 'vercel-edge',
      },
    },
    startSession: {
      stateStream: sessionStateStream(launchInput),
      create: true,
      newSession: newSessionRequest({
        cwd: '/',
        mcpServers: [],
      }),
      prompt: textPrompt(launchInput.prompt),
    },
    wait: {
      until: 'session',
      timeoutMs: 60_000,
    },
  })
  const launch = await appendLaunchRequest({
    streamUrl: derived.controlStreamUrl,
    request,
    idempotencyKey: clientRequestId,
    requestedBy: derived.requestedBy,
  })
  const launchRow = await waitForLaunchRow({
    stateStreamUrl: derived.controlStreamUrl,
    launchId: launch.value.launchId,
    timeoutMs: 60_000,
    predicate: (row) =>
      row.status === 'failed' || Boolean(row.runtime && row.startSession),
  })
  if (launchRow.status === 'failed') {
    throw new Error(launchRow.error?.message ?? `Launch ${launchRow.launchId} failed`)
  }
  const stop = await appendLaunchStop({
    streamUrl: derived.controlStreamUrl,
    launchId: launchRow.launchId,
    clientRequestId,
    requestedBy: derived.requestedBy,
    reason: 'Vercel Edge Runtime example complete',
  })
  const stoppedRow = await waitForLaunchRow({
    stateStreamUrl: derived.controlStreamUrl,
    launchId: launchRow.launchId,
    timeoutMs: 60_000,
    predicate: (row) => row.status === 'stopped' || row.status === 'failed',
  })
  if (stoppedRow.status === 'failed') {
    throw new Error(stoppedRow.error?.message ?? `Launch ${stoppedRow.launchId} failed while stopping`)
  }

  return summarizeRun({
    config: derived,
    input: launchInput,
    launch,
    launchRow,
    stop,
    stoppedRow,
  })
}

async function createDefinition(
  revision: string,
  input: ReturnType<typeof normalizeLaunchInput>,
) {
  const artifact = await inlineBundleArtifact({
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
  })
  return agentDefinition({
    name: 'vercel-edge-runtime',
    agent: jsModuleAgentForm({ artifact }),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: '13-vercel-edge-runtime',
        runtime: 'vercel-edge',
      },
    },
    middleware: {
      kind: 'middleware',
      chain: [],
    },
  })
}

async function waitForLaunchRow(options: {
  readonly stateStreamUrl: string
  readonly launchId: string
  readonly timeoutMs: number
  readonly predicate: (row: LaunchRow) => boolean
}): Promise<LaunchRow> {
  const db = createFirelineDB({ stateStreamUrl: options.stateStreamUrl })
  try {
    await db.preload()
    const existing = findLaunchRow(db, options.launchId, options.predicate)
    if (existing) return existing
    return await new Promise((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out waiting for launch ${options.launchId}`))
      }, options.timeoutMs)
      let subscription: { unsubscribe(): void } | undefined
      let unsubscribeAfterAssign = false
      const cleanup = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (subscription) {
          subscription.unsubscribe()
        } else {
          unsubscribeAfterAssign = true
        }
      }
      subscription = db.collections.launches.subscribe((rows) => {
        const row = rows.find((candidate) =>
          candidate.launchId === options.launchId && options.predicate(candidate)
        )
        if (!row) return
        cleanup()
        resolve(row)
      })
      if (unsubscribeAfterAssign) subscription.unsubscribe()
    })
  } finally {
    db.close()
  }
}

function findLaunchRow(
  db: ReturnType<typeof createFirelineDB>,
  launchId: string,
  predicate: (row: LaunchRow) => boolean,
): LaunchRow | undefined {
  return db.collections.launches.toArray.find((row) =>
    row.launchId === launchId && predicate(row)
  )
}

async function readJsonBody(request: Request): Promise<LaunchBody> {
  if (!request.headers.get('content-type')?.includes('application/json')) return {}
  return await request.json() as LaunchBody
}

function summarizeRun(options: {
  readonly config: LaunchConfig
  readonly input: ReturnType<typeof normalizeLaunchInput>
  readonly launch: LaunchRequestEnvelope<string>
  readonly launchRow: LaunchRow
  readonly stop: LaunchStopEnvelope
  readonly stoppedRow: LaunchRow
}) {
  return {
    ok: true,
    example: '13-vercel-edge-runtime',
    edgeRuntime: edgeRuntimeVersion(),
    controlStream: options.config.controlStream,
    controlStreamUrl: options.config.controlStreamUrl,
    tenantId: options.input.tenantId,
    launchId: options.launchRow.launchId,
    clientRequestId: options.launchRow.clientRequestId,
    launchEnvelopeKey: options.launch.key,
    launchStatus: options.launchRow.status,
    runtime: options.launchRow.runtime
      ? {
          runtimeId: options.launchRow.runtime.runtimeId,
          acpUrl: options.launchRow.runtime.acp.url,
        }
      : undefined,
    session: options.launchRow.startSession
      ? {
          acpSessionId: options.launchRow.startSession.acpSessionId,
        }
      : undefined,
    stopId: options.stop.value.stopId,
    stopStatus: options.stoppedRow.status,
  }
}

function deriveConfig(env: VercelEdgeEnv): LaunchConfig {
  const controlStream = env.FIRELINE_CONTROL_STREAM ?? defaultControlStream
  if (env.FIRELINE_LAUNCH_CONTROL_STREAM_URL) {
    return {
      controlStream,
      controlStreamUrl: env.FIRELINE_LAUNCH_CONTROL_STREAM_URL,
      requestedBy,
    }
  }
  const durableStreamsBase =
    env.FIRELINE_DURABLE_STREAMS_URL ??
    `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? defaultStreamsPort}/v1/stream`
  return {
    controlStream,
    controlStreamUrl: `${trimTrailingSlash(durableStreamsBase)}/${encodeURIComponent(controlStream)}`,
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

function sessionStateStream(input: ReturnType<typeof normalizeLaunchInput>): string {
  return [
    'vercel-edge-runtime',
    safeIdPart(input.tenantId),
    safeIdPart(input.runId),
    safeIdPart(input.attemptId),
    'session',
  ].join('-')
}

function safeIdPart(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return cleaned.replace(/^-+|-+$/g, '') || 'unknown'
}

function runtimeEnv(): VercelEdgeEnv {
  return ((globalThis as typeof globalThis & {
    FIRELINE_VERCEL_EDGE_ENV?: VercelEdgeEnv
  }).FIRELINE_VERCEL_EDGE_ENV ?? {})
}

function edgeRuntimeVersion(): string | undefined {
  return (globalThis as typeof globalThis & { EdgeRuntime?: string }).EdgeRuntime
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
