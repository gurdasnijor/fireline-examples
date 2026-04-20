import fireline from '@fireline/client'
import { appendLaunchStop } from '@fireline/client/events'
import {
  agentDefinition,
  inlineBundleArtifact,
  jsModuleAgentForm,
  launchSpec,
  newSessionRequest,
  textPrompt,
} from '@fireline/client/spec'
import type { LaunchRow } from '@fireline/state'
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
  const definition = await createDefinition(clientRequestId, launchInput)
  const request = launchSpec(definition, {
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

  const launch = await fireline.appendLaunchRequest({
    streamUrl: config.controlStreamUrl,
    request,
    idempotencyKey: clientRequestId,
    requestedBy: config.requestedBy,
  })
  const launchRow = await waitForLaunchRow({
    stateStreamUrl: config.controlStreamUrl,
    launchId: launch.value.launchId,
    timeoutMs: 60_000,
    predicate: (row) =>
      row.status === 'failed' || Boolean(row.runtime && row.startSession),
  })
  if (launchRow.status === 'failed') {
    throw new Error(launchRow.error?.message ?? `Launch ${launchRow.launchId} failed`)
  }

  const stop = await appendLaunchStop({
    streamUrl: config.controlStreamUrl,
    launchId: launchRow.launchId,
    clientRequestId,
    requestedBy: config.requestedBy,
    reason: 'Vercel Function Node example complete',
  })
  const stoppedRow = await waitForLaunchRow({
    stateStreamUrl: config.controlStreamUrl,
    launchId: launchRow.launchId,
    timeoutMs: 60_000,
    predicate: (row) => row.status === 'stopped' || row.status === 'failed',
  })
  if (stoppedRow.status === 'failed') {
    throw new Error(stoppedRow.error?.message ?? `Launch ${stoppedRow.launchId} failed while stopping`)
  }

  return {
    ok: true,
    example: '12-vercel-function-node',
    controlStream: config.controlStream,
    launchId: launchRow.launchId,
    clientRequestId: launchRow.clientRequestId,
    launchStatus: launchRow.status,
    runtime: launchRow.runtime
      ? {
          runtimeId: launchRow.runtime.runtimeId,
          acpUrl: launchRow.runtime.acp.url,
        }
      : undefined,
    session: launchRow.startSession
      ? {
          acpSessionId: launchRow.startSession.acpSessionId,
        }
      : undefined,
    stopId: stop.value.stopId,
    stopStatus: stoppedRow.status,
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
  return agentDefinition({
    name: 'vercel-function-node',
    agent: jsModuleAgentForm({ artifact }),
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
  })
}

async function waitForLaunchRow(options: {
  readonly stateStreamUrl: string
  readonly launchId: string
  readonly timeoutMs: number
  readonly predicate: (row: LaunchRow) => boolean
}): Promise<LaunchRow> {
  const db = await fireline.db({ stateStreamUrl: options.stateStreamUrl })
  try {
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
  db: Awaited<ReturnType<typeof fireline.db>>,
  launchId: string,
  predicate: (row: LaunchRow) => boolean,
): LaunchRow | undefined {
  return db.collections.launches.toArray.find((row) =>
    row.launchId === launchId && predicate(row)
  )
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
