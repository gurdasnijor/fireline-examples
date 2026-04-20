import {
  createManagedAgentLaunchRequest,
  inlineJsBundleAgent,
} from '@fireline/client/managed-agent'
import {
  launchManagedAgent,
  stopManagedAgent,
} from '../../shared/managed-agent-launch.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface LaunchBody {
  readonly tenantId?: string
  readonly runId?: string
  readonly attemptId?: string
  readonly prompt?: string
}

interface VercelFunctionEnv {
  readonly FIRELINE_LAUNCH_CONTROL_STREAM_URL?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
  readonly VERCEL_FUNCTION_RUN_ID?: string
  readonly VERCEL_FUNCTION_ATTEMPT_ID?: string
  readonly VERCEL_FUNCTION_TENANT_ID?: string
  readonly VERCEL_FUNCTION_PROMPT?: string
}

interface LaunchConfig {
  readonly controlStream: string
  readonly controlStreamUrl: string
  readonly requestedBy: string
}

const defaultControlStream = 'fireline-vercel-function-control'
const defaultStreamsPort = '7474'
const requestedBy = 'examples/12-vercel-function-node'

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed; POST required' })
      return
    }
    const summary = await runVercelFunctionLaunch({
      env: process.env,
      body: await readJsonBody(req),
    })
    sendJson(res, 200, summary)
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function runVercelFunctionLaunch(options: {
  readonly env: VercelFunctionEnv
  readonly body?: LaunchBody
}) {
  const config = deriveConfig(options.env)
  const launchInput = normalizeLaunchInput(options.env, options.body ?? {})
  const clientRequestId = stableClientRequestId(launchInput)
  const request = createManagedAgentLaunchRequest({
    name: 'vercel-function-node',
    agent: await createAgent(clientRequestId, launchInput),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: '12-vercel-function-node',
        runtime: 'vercel-function-node',
      },
    },
    middleware: {
      kind: 'middleware',
      chain: [],
    },
    clientRequestId,
    runtime: {
      name: 'vercel-function-node',
      provider: 'local',
      labels: {
        example: '12-vercel-function-node',
        tenantId: launchInput.tenantId,
        runtime: 'vercel-function-node',
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
    reason: 'Vercel Function Node example complete',
    timeoutMs: 60_000,
  }).finally(() => launch.handle.close())

  return {
    ok: true,
    example: '12-vercel-function-node',
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

function deriveConfig(env: VercelFunctionEnv): LaunchConfig {
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

function normalizeLaunchInput(env: VercelFunctionEnv, body: LaunchBody) {
  return {
    tenantId: body.tenantId ?? env.VERCEL_FUNCTION_TENANT_ID ?? 'tenant-vercel-node',
    runId: body.runId ?? env.VERCEL_FUNCTION_RUN_ID ?? `run-${Date.now()}`,
    attemptId: body.attemptId ?? env.VERCEL_FUNCTION_ATTEMPT_ID ?? 'attempt-1',
    prompt: body.prompt ?? env.VERCEL_FUNCTION_PROMPT ?? 'Run the Vercel Function Node example.',
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
        export default async function vercelFunctionNodeExample(ctx) {
          await ctx.session.text("Vercel Function Node example reached Fireline.")
          await ctx.session.text(${JSON.stringify(`tenant=${input.tenantId}`)})
          await ctx.session.complete()
        }
      `,
    }],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: 'examples/12-vercel-function-node',
      revision,
    },
  })
}

async function readJsonBody(req: IncomingMessage): Promise<LaunchBody> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as LaunchBody
}

function sendJson(res: ServerResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode
  res.setHeader('content-type', 'application/json')
  res.end(`${JSON.stringify(value, null, 2)}\n`)
}

function stableClientRequestId(input: ReturnType<typeof normalizeLaunchInput>): string {
  return [
    'launch',
    'vercel-function-node',
    safeIdPart(input.tenantId),
    safeIdPart(input.runId),
    safeIdPart(input.attemptId),
  ].join(':')
}

function sessionStateStream(input: ReturnType<typeof normalizeLaunchInput>): string {
  return [
    'vercel-function-node',
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

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '')
}
