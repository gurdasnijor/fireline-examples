import {
  createManagedAgentLaunchRequest,
  inlineJsBundleAgent,
} from '@fireline/client/managed-agent'
import {
  launchManagedAgent,
  observeManagedAgent,
  stopManagedAgent,
  type ManagedAgentLaunchRow,
} from '../../shared/managed-agent-launch.js'

interface Env {
  readonly FIRELINE_LAUNCH_CONTROL_STREAM_URL?: string
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
            `fireline-v3-dev --state-stream ${config.controlStream}`,
          streamUrlDerivation:
            `export FIRELINE_LAUNCH_CONTROL_STREAM_URL="http://127.0.0.1:` +
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
        const launch = await launchFromWorker(env, await readLaunchBody(request))
        const stop = await stopFromWorker(env, {
          launchId: launch.row.launchId,
          clientRequestId: launch.row.clientRequestId,
          reason: 'direct Worker demo complete',
          requestedBy,
        })
        return jsonResponse({ launch, stop })
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
  const config = deriveConfig(env)
  const clientRequestId = `launch:worker-direct:${crypto.randomUUID()}`
  const request = createManagedAgentLaunchRequest({
    name: 'cloudflare-worker-direct',
    agent: await createWorkerDirectAgent(clientRequestId),
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
    clientRequestId,
    runtime: {
      name: 'cloudflare-worker-direct',
      provider: 'local',
      labels: {
        example: '08-cloudflare-worker-direct',
        runtime: 'cloudflare-worker',
      },
    },
    startSession: {
      stateStream: clientRequestId.replace(/:/g, '-'),
      create: true,
      cwd: '/',
      mcpServers: [],
      prompt: body.prompt ?? 'Run the direct Cloudflare Worker example.',
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
    requestedBy: body.requestedBy ?? requestedBy,
    fetch,
    timeoutMs: 60_000,
  })
  try {
    return summarizeLaunch({ config, handle: launch.handle, row: launch.row })
  } finally {
    launch.handle.close()
  }
}

async function stopFromWorker(env: Env, body: StopBody) {
  if (!body.launchId) throw new Error('POST /stop requires launchId')
  const config = deriveConfig(env)
  const handle = observeManagedAgent({
    controlStreamUrl: config.controlStreamUrl,
    launchId: body.launchId,
    requestedBy: body.requestedBy ?? requestedBy,
    fetch,
  })
  try {
    const stop = await stopManagedAgent({
      handle,
      clientRequestId: body.clientRequestId,
      reason: body.reason ?? 'direct Worker stop requested',
      requestedBy: body.requestedBy ?? requestedBy,
      timeoutMs: 60_000,
    })
    return summarizeStop({ config, stopId: stop.stopId, row: stop.row })
  } finally {
    handle.close()
  }
}

async function createWorkerDirectAgent(revision: string) {
  return await inlineJsBundleAgent({
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
  const controlStreamUrl =
    env.FIRELINE_LAUNCH_CONTROL_STREAM_URL ??
    `${trimTrailingSlash(durableStreamsBase)}/${encodeURIComponent(controlStream)}`
  return { controlStream, controlStreamUrl, durableStreamsBase }
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

function summarizeLaunch(options: {
  readonly config: ReturnType<typeof deriveConfig>
  readonly handle: Awaited<ReturnType<typeof launchManagedAgent>>['handle']
  readonly row: ManagedAgentLaunchRow
}) {
  return {
    controlStreamUrl: options.config.controlStreamUrl,
    envelope: {
      type: options.handle.requestEnvelope?.type,
      key: options.handle.requestEnvelope?.key,
    },
    row: summarizeRow(options.row),
  }
}

function summarizeStop(options: {
  readonly config: ReturnType<typeof deriveConfig>
  readonly stopId: string
  readonly row: ManagedAgentLaunchRow
}) {
  return {
    controlStreamUrl: options.config.controlStreamUrl,
    stopId: options.stopId,
    row: summarizeRow(options.row),
  }
}

function summarizeRow(row: ManagedAgentLaunchRow) {
  return {
    launchId: row.launchId,
    clientRequestId: row.clientRequestId,
    status: row.status,
    runtime: row.runtime && {
      runtimeId: row.runtime.runtimeId,
      acpUrl: row.runtime.acp.url,
      stateUrl: row.runtime.state.url,
    },
    startSession: row.startSession,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
