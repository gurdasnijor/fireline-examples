import { Agent, Fireline, acp } from '@fireline/client/managed-agent'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface LaunchBody {
  readonly tenantId?: string
  readonly runId?: string
  readonly attemptId?: string
  readonly prompt?: string
}

interface VercelFunctionEnv {
  readonly FIRELINE_ENDPOINT?: string
  readonly VERCEL_FUNCTION_RUN_ID?: string
  readonly VERCEL_FUNCTION_ATTEMPT_ID?: string
  readonly VERCEL_FUNCTION_TENANT_ID?: string
  readonly VERCEL_FUNCTION_PROMPT?: string
}

interface LaunchConfig {
  readonly endpoint: string
  readonly requestedBy: string
}

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
  const fireline = new Fireline({
    endpoint: config.endpoint,
    requestedBy: config.requestedBy,
    defaults: {
      wait: {
        until: 'session_ready',
        timeoutMs: 60_000,
      },
      stopReason: 'Vercel Function Node example complete',
    },
  })
  const agent = new Agent({
    id: 'vercel-function-node',
    entrypoint: await createEntrypoint(clientRequestId, launchInput),
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
    defaults: {
      runtime: {
        name: 'vercel-function-node',
        provider: 'local',
        labels: {
          example: '12-vercel-function-node',
          tenantId: launchInput.tenantId,
          runtime: 'vercel-function-node',
        },
      },
      wait: {
        until: 'session',
        timeoutMs: 60_000,
      },
    },
  })
  const session = await fireline.session(agent, {
    prompt: launchInput.prompt,
    cwd: '/',
    mcpServers: [],
    idempotencyKey: clientRequestId,
    requestedBy: config.requestedBy,
    advanced: {
      startSession: {
        stateStream: sessionStateStream(launchInput),
        create: true,
      },
      request: {
        clientRequestId,
      },
    },
  })

  try {
    const ready = session.current()
    const stop = await session.stop({
      clientRequestId,
      requestedBy: config.requestedBy,
      reason: 'Vercel Function Node example complete',
      wait: {
        until: 'terminal',
        timeoutMs: 60_000,
      },
    })

    return {
      ok: true,
      example: '12-vercel-function-node',
      endpoint: config.endpoint,
      launchId: session.launchId,
      clientRequestId,
      launchStatus: ready.status,
      session: ready.sessionId
        ? {
            acpSessionId: ready.sessionId,
          }
        : undefined,
      stopId: stop.envelope.value.stopId,
      stopStatus: stop.row?.status ?? 'unknown',
    }
  } finally {
    await session.close()
    fireline.close()
  }
}

function deriveConfig(env: VercelFunctionEnv): LaunchConfig {
  if (!env.FIRELINE_ENDPOINT) {
    throw new Error('FIRELINE_ENDPOINT is required; run through fireline runtime dev or provide the deployed endpoint')
  }

  return {
    endpoint: env.FIRELINE_ENDPOINT,
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

async function createEntrypoint(
  revision: string,
  input: ReturnType<typeof normalizeLaunchInput>,
) {
  return await acp.inlineJsBundle({
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
