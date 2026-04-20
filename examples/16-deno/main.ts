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

declare const Deno: {
  readonly env: {
    get(name: string): string | undefined
  }
}

interface DenoExampleEnv {
  readonly FIRELINE_LAUNCH_CONTROL_STREAM_URL?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
  readonly DENO_EXAMPLE_TENANT_ID?: string
  readonly DENO_EXAMPLE_RUN_ID?: string
  readonly DENO_EXAMPLE_ATTEMPT_ID?: string
  readonly DENO_EXAMPLE_PROMPT?: string
}

interface LaunchConfig {
  readonly controlStream: string
  readonly controlStreamUrl: string
  readonly requestedBy: string
}

const defaultControlStream = 'fireline-deno-control'
const defaultStreamsPort = '7474'
const requestedBy = 'examples/16-deno'

const result = await runDenoExample(readEnv())
console.log(JSON.stringify(result, null, 2))

async function runDenoExample(env: DenoExampleEnv) {
  const launchInput = normalizeLaunchInput(env)
  const config = deriveConfig(env)
  const clientRequestId = stableClientRequestId(launchInput)
  const definition = await createDefinition(clientRequestId, launchInput)
  const request = launchSpec(definition, {
    clientRequestId,
    runtime: {
      name: 'deno-package-consumer',
      provider: 'local',
      labels: {
        example: '16-deno',
        tenantId: launchInput.tenantId,
        runtime: 'deno',
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
    reason: 'Deno package consumer example complete',
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

  return summarizeRun({
    config,
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
        export default async function denoPackageConsumerExample(ctx) {
          await ctx.session.text("Deno package consumer example reached Fireline.")
          await ctx.session.text(${JSON.stringify(`tenant=${input.tenantId}`)})
          await ctx.session.complete()
        }
      `,
    }],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: 'examples/16-deno',
      revision,
    },
  })
  return agentDefinition({
    name: 'deno-package-consumer',
    agent: jsModuleAgentForm({ artifact }),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: '16-deno',
        runtime: 'deno',
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
    example: '16-deno',
    deno: true,
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

function readEnv(): DenoExampleEnv {
  return {
    FIRELINE_LAUNCH_CONTROL_STREAM_URL: Deno.env.get('FIRELINE_LAUNCH_CONTROL_STREAM_URL'),
    FIRELINE_DURABLE_STREAMS_URL: Deno.env.get('FIRELINE_DURABLE_STREAMS_URL'),
    FIRELINE_STREAMS_PORT: Deno.env.get('FIRELINE_STREAMS_PORT'),
    FIRELINE_CONTROL_STREAM: Deno.env.get('FIRELINE_CONTROL_STREAM'),
    DENO_EXAMPLE_TENANT_ID: Deno.env.get('DENO_EXAMPLE_TENANT_ID'),
    DENO_EXAMPLE_RUN_ID: Deno.env.get('DENO_EXAMPLE_RUN_ID'),
    DENO_EXAMPLE_ATTEMPT_ID: Deno.env.get('DENO_EXAMPLE_ATTEMPT_ID'),
    DENO_EXAMPLE_PROMPT: Deno.env.get('DENO_EXAMPLE_PROMPT'),
  }
}

function deriveConfig(env: DenoExampleEnv): LaunchConfig {
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

function normalizeLaunchInput(env: DenoExampleEnv) {
  return {
    tenantId: env.DENO_EXAMPLE_TENANT_ID ?? 'tenant-deno',
    runId: env.DENO_EXAMPLE_RUN_ID ?? `run-${Date.now()}`,
    attemptId: env.DENO_EXAMPLE_ATTEMPT_ID ?? 'attempt-1',
    prompt: env.DENO_EXAMPLE_PROMPT ?? 'Run the Deno package consumer example.',
  }
}

function stableClientRequestId(input: ReturnType<typeof normalizeLaunchInput>): string {
  return [
    'launch',
    'deno-package-consumer',
    safeIdPart(input.tenantId),
    safeIdPart(input.runId),
    safeIdPart(input.attemptId),
  ].join(':')
}

function sessionStateStream(input: ReturnType<typeof normalizeLaunchInput>): string {
  return [
    'deno-package-consumer',
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
