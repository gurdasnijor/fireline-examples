import { Agent, Fireline, acp } from '@fireline/client/managed-agent'

interface Env {
  readonly FIRELINE_ENDPOINT?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
}

interface LaunchBody {
  readonly prompt?: string
  readonly requestedBy?: string
}

interface StopBody {
  readonly launchId?: string
  readonly clientRequestId?: string
  readonly reason?: string
  readonly requestedBy?: string
}

const defaultControlStream = 'fireline-worker-direct-control'
const defaultStreamsPort = '7474'
const requestedBy = 'examples/08-cloudflare-worker-direct'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url)
      if (request.method === 'GET' && url.pathname === '/') {
        const config = deriveConfig(env)
        return jsonResponse({
          example: '08-cloudflare-worker-direct',
          routes: {
            launch: 'POST /launch',
            stop: 'POST /stop',
            demo: 'POST /demo',
          },
          config,
          localDaemonCommand:
            `FIRELINE_CONTROL_STREAM=${config.controlStream} ` +
            `fireline runtime dev --launch-control-stream ${config.controlStream}`,
          endpointDerivation:
            `export FIRELINE_ENDPOINT="http://127.0.0.1:` +
            `\${FIRELINE_STREAMS_PORT:-${defaultStreamsPort}}/v1/stream/` +
            `\${FIRELINE_CONTROL_STREAM:-${defaultControlStream}}"`,
        })
      }
      if (request.method === 'POST' && url.pathname === '/launch') {
        return jsonResponse(await launchFromWorker(env, await readLaunchBody(request)))
      }
      if (request.method === 'POST' && url.pathname === '/stop') {
        return jsonResponse(await stopFromWorker(env, await readStopBody(request)))
      }
      if (request.method === 'POST' && url.pathname === '/demo') {
        return jsonResponse(await demoFromWorker(env, await readLaunchBody(request)))
      }
      return jsonResponse({ error: 'Not found' }, 404)
    } catch (error) {
      return jsonResponse({
        error: error instanceof Error ? error.message : String(error),
      }, 500)
    }
  },
}

async function launchFromWorker(env: Env, body: LaunchBody) {
  const opened = await openWorkerSession(env, body)
  try {
    return summarizeLaunch(opened)
  } finally {
    await opened.session.close()
    opened.fireline.close()
  }
}

async function demoFromWorker(env: Env, body: LaunchBody) {
  const opened = await openWorkerSession(env, body)
  try {
    const launch = summarizeLaunch(opened)
    const stop = await stopSession({
      ...opened,
      clientRequestId: opened.clientRequestId,
      requestedBy: body.requestedBy ?? requestedBy,
      reason: 'direct Worker demo complete',
    })
    return { launch, stop }
  } finally {
    await opened.session.close()
    opened.fireline.close()
  }
}

async function stopFromWorker(env: Env, body: StopBody) {
  if (!body.launchId) throw new Error('POST /stop requires launchId')
  const config = deriveConfig(env)
  const fireline = new Fireline({
    endpoint: config.endpoint,
    requestedBy: body.requestedBy ?? requestedBy,
    fetch,
    defaults: {
      stopReason: body.reason ?? 'direct Worker stop requested',
    },
  })
  const session = await fireline.reconnect({
    launchId: body.launchId,
    fetch,
  })
  try {
    return await stopSession({
      config,
      session,
      clientRequestId: body.clientRequestId ?? `stop:worker-direct:${crypto.randomUUID()}`,
      requestedBy: body.requestedBy ?? requestedBy,
      reason: body.reason ?? 'direct Worker stop requested',
    })
  } finally {
    await session.close()
    fireline.close()
  }
}

async function openWorkerSession(env: Env, body: LaunchBody) {
  const config = deriveConfig(env)
  const clientRequestId = `launch:worker-direct:${crypto.randomUUID()}`
  const requestOwner = body.requestedBy ?? requestedBy
  const fireline = new Fireline({
    endpoint: config.endpoint,
    requestedBy: requestOwner,
    fetch,
    defaults: {
      wait: {
        until: 'session_ready',
        timeoutMs: 60_000,
      },
      stopReason: 'direct Worker stop requested',
    },
  })
  const agent = new Agent({
    id: 'cloudflare-worker-direct',
    entrypoint: await createWorkerDirectEntrypoint(clientRequestId),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: '08-cloudflare-worker-direct',
        runtime: 'cloudflare-worker',
      },
    },
    middleware: {
      kind: 'middleware',
      chain: [],
    },
    defaults: {
      runtime: {
        name: 'cloudflare-worker-direct',
        provider: 'local',
        labels: {
          example: '08-cloudflare-worker-direct',
          runtime: 'cloudflare-worker',
        },
      },
      wait: {
        until: 'session',
        timeoutMs: 60_000,
      },
    },
  })
  const session = await fireline.session(agent, {
    prompt: body.prompt ?? 'Run the direct Cloudflare Worker example.',
    cwd: '/',
    mcpServers: [],
    idempotencyKey: clientRequestId,
    requestedBy: requestOwner,
    advanced: {
      startSession: {
        stateStream: clientRequestId.replace(/:/g, '-'),
        create: true,
      },
      request: {
        clientRequestId,
      },
    },
  })
  return { config, fireline, session, clientRequestId }
}

async function stopSession(options: {
  readonly config: ReturnType<typeof deriveConfig>
  readonly session: Awaited<ReturnType<Fireline['session']>>
  readonly clientRequestId: string
  readonly requestedBy: string
  readonly reason: string
}) {
  const stop = await options.session.stop({
    clientRequestId: options.clientRequestId,
    requestedBy: options.requestedBy,
    reason: options.reason,
    wait: {
      until: 'terminal',
      timeoutMs: 60_000,
    },
  })
  return {
    endpoint: options.config.endpoint,
    launchId: options.session.launchId,
    clientRequestId: options.clientRequestId,
    stopId: stop.envelope.value.stopId,
    stopStatus: stop.row?.status ?? 'unknown',
  }
}

async function createWorkerDirectEntrypoint(revision: string) {
  return await acp.inlineJsBundle({
    entrypoint: 'agent.mjs',
    files: [{
      path: 'agent.mjs',
      mediaType: 'text/javascript',
      content: `
        export default async function directWorkerExample(ctx) {
          await ctx.session.text("Cloudflare Worker direct example reached Fireline.")
          await ctx.session.complete()
        }
      `,
    }],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: 'examples/08-cloudflare-worker-direct',
      revision,
    },
  })
}

function deriveConfig(env: Env) {
  const controlStream = env.FIRELINE_CONTROL_STREAM ?? defaultControlStream
  const durableStreamsBase =
    env.FIRELINE_DURABLE_STREAMS_URL ??
    `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? defaultStreamsPort}/v1/stream`
  const endpoint =
    env.FIRELINE_ENDPOINT ??
    `${trimTrailingSlash(durableStreamsBase)}/${encodeURIComponent(controlStream)}`
  return { controlStream, endpoint, durableStreamsBase }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}

async function readLaunchBody(request: Request): Promise<LaunchBody> {
  if (!request.headers.get('content-type')?.includes('application/json')) return {}
  return await request.json() as LaunchBody
}

async function readStopBody(request: Request): Promise<StopBody> {
  if (!request.headers.get('content-type')?.includes('application/json')) return {}
  return await request.json() as StopBody
}

function summarizeLaunch(options: Awaited<ReturnType<typeof openWorkerSession>>) {
  const snapshot = options.session.current()
  return {
    endpoint: options.config.endpoint,
    launchId: options.session.launchId,
    clientRequestId: options.clientRequestId,
    launchStatus: snapshot.status,
    session: snapshot.sessionId
      ? {
          acpSessionId: snapshot.sessionId,
        }
      : undefined,
    requiredActions: snapshot.requiredActions,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
