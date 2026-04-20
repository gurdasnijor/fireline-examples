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
  const definition = await createDefinition(clientRequestId, launchInput)
  const request = launchSpec(definition, {
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
    reason: 'Bun example complete',
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
    example: '14-bun',
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
  return agentDefinition({
    name: 'bun',
    agent: jsModuleAgentForm({ artifact }),
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
