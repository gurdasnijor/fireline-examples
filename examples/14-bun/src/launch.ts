import {
  createManagedAgentLaunchRequest,
  inlineJsBundleAgent,
} from '@fireline/client/managed-agent'
import {
  launchManagedAgent,
  stopManagedAgent,
} from '../../shared/managed-agent-launch.js'

interface BunExampleEnv {
  readonly FIRELINE_LAUNCH_CONTROL_STREAM_URL?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
  readonly BUN_EXAMPLE_TENANT_ID?: string
  readonly BUN_EXAMPLE_RUN_ID?: string
  readonly BUN_EXAMPLE_ATTEMPT_ID?: string
  readonly BUN_EXAMPLE_PROMPT?: string
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

const defaultControlStream = 'fireline-bun-control'
const defaultStreamsPort = '7474'
const requestedBy = 'examples/14-bun'

export async function handleBunLaunchRequest(
  request: Request,
  env: BunExampleEnv = runtimeEnv(),
): Promise<Response> {
  try {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/') {
      return jsonResponse({
        example: '14-bun',
        runtime: 'bun',
        routes: {
          launchAndStop: 'POST /api/fireline-launch',
        },
        config: deriveConfig(env),
      })
    }
    if (request.method === 'POST' && url.pathname === '/api/fireline-launch') {
      return jsonResponse(await runBunLaunch({
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

export async function runBunLaunch(options: {
  readonly env: BunExampleEnv
  readonly body?: LaunchBody
}) {
  const config = deriveConfig(options.env)
  const launchInput = normalizeLaunchInput(options.env, options.body ?? {})
  const clientRequestId = stableClientRequestId(launchInput)
  const request = createManagedAgentLaunchRequest({
    name: 'bun',
    agent: await createAgent(clientRequestId, launchInput),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: '14-bun',
        runtime: 'bun',
      },
    },
    middleware: {
      kind: 'middleware',
      chain: [],
    },
    clientRequestId,
    runtime: {
      name: 'bun',
      provider: 'local',
      labels: {
        example: '14-bun',
        tenantId: launchInput.tenantId,
        runtime: 'bun',
      },
    },
    startSession: {
      stateStream: sessionStateStream(launchInput),
      create: true,
      cwd: '/',
      mcpServers: [],
      prompt: launchInput.prompt,
    },
    wait: {
      until: 'session',
      timeoutMs: 60_000,
    },
  })

  const launch = await launchManagedAgent({
    controlStreamUrl: config.controlStreamUrl,
    request,
    idempotencyKey: clientRequestId,
    requestedBy: config.requestedBy,
    timeoutMs: 60_000,
  })

  const stop = await stopManagedAgent({
    handle: launch.handle,
    clientRequestId,
    requestedBy: config.requestedBy,
    reason: 'Bun example complete',
    timeoutMs: 60_000,
  }).finally(() => launch.handle.close())

  return {
    ok: true,
    example: '14-bun',
    controlStream: config.controlStream,
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
    stopId: stop.stopId,
    stopStatus: stop.row.status,
  }
}

function deriveConfig(env: BunExampleEnv): LaunchConfig {
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

function normalizeLaunchInput(env: BunExampleEnv, body: LaunchBody) {
  return {
    tenantId: body.tenantId ?? env.BUN_EXAMPLE_TENANT_ID ?? 'tenant-bun',
    runId: body.runId ?? env.BUN_EXAMPLE_RUN_ID ?? `run-${Date.now()}`,
    attemptId: body.attemptId ?? env.BUN_EXAMPLE_ATTEMPT_ID ?? 'attempt-1',
    prompt: body.prompt ?? env.BUN_EXAMPLE_PROMPT ?? 'Run the Bun Fireline example.',
  }
}

async function createAgent(
  revision: string,
  input: ReturnType<typeof normalizeLaunchInput>,
) {
  return await inlineJsBundleAgent({
    entrypoint: 'agent.mjs',
    files: [{
      path: 'agent.mjs',
      mediaType: 'text/javascript',
      content: `
        export default async function bunExample(ctx) {
          await ctx.session.text("Bun example reached Fireline.")
          await ctx.session.text(${JSON.stringify(`tenant=${input.tenantId}`)})
          await ctx.session.complete()
        }
      `,
    }],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: 'examples/14-bun',
      revision,
    },
  })
}

function stableClientRequestId(input: ReturnType<typeof normalizeLaunchInput>): string {
  return `launch:bun:${input.tenantId}:${input.runId}:${input.attemptId}`
}

function sessionStateStream(input: ReturnType<typeof normalizeLaunchInput>): string {
  return `bun-${input.tenantId}-${input.runId}-${input.attemptId}`
    .replace(/[^a-zA-Z0-9_.:-]+/g, '-')
    .slice(0, 120)
}

function runtimeEnv(): BunExampleEnv {
  return {
    FIRELINE_LAUNCH_CONTROL_STREAM_URL: process.env.FIRELINE_LAUNCH_CONTROL_STREAM_URL,
    FIRELINE_DURABLE_STREAMS_URL: process.env.FIRELINE_DURABLE_STREAMS_URL,
    FIRELINE_STREAMS_PORT: process.env.FIRELINE_STREAMS_PORT,
    FIRELINE_CONTROL_STREAM: process.env.FIRELINE_CONTROL_STREAM,
    BUN_EXAMPLE_TENANT_ID: process.env.BUN_EXAMPLE_TENANT_ID,
    BUN_EXAMPLE_RUN_ID: process.env.BUN_EXAMPLE_RUN_ID,
    BUN_EXAMPLE_ATTEMPT_ID: process.env.BUN_EXAMPLE_ATTEMPT_ID,
    BUN_EXAMPLE_PROMPT: process.env.BUN_EXAMPLE_PROMPT,
  }
}

async function readJsonBody(request: Request): Promise<LaunchBody> {
  if (!request.body) return {}
  const text = await request.text()
  if (text.trim().length === 0) return {}
  const parsed = JSON.parse(text) as unknown
  if (!parsed || typeof parsed !== 'object') return {}
  return parsed as LaunchBody
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
