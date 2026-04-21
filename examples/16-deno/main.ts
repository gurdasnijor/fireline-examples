import {
  acp,
  Agent,
  Fireline,
  type ManagedAgentSessionHandle,
  type ManagedAgentSessionSnapshot,
  type ManagedAgentStopResult,
} from '@fireline/client/managed-agent'

declare const Deno: {
  readonly env: {
    get(name: string): string | undefined
  }
}

interface DenoExampleEnv {
  readonly FIRELINE_ENDPOINT?: string
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
  readonly endpoint: string
  readonly requestedBy: string
}

type SessionSnapshot = ManagedAgentSessionSnapshot

const defaultControlStream = 'fireline-deno-control'
const defaultStreamsPort = '7474'
const requestedBy = 'examples/16-deno'

const result = await runDenoExample(readEnv())
console.log(JSON.stringify(result, null, 2))

async function runDenoExample(env: DenoExampleEnv) {
  const input = normalizeLaunchInput(env)
  const config = deriveConfig(env)
  const clientRequestId = stableClientRequestId(input)
  const fireline = new Fireline({
    endpoint: config.endpoint,
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
      reason: 'Deno package consumer example complete',
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
    id: 'deno-package-consumer',
    entrypoint: await acp.inlineJsBundle({
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
    }),
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: '16-deno',
        runtime: 'deno',
      },
    },
    defaults: {
      prompt: input.prompt,
      cwd: '/',
      mcpServers: [],
      runtime: {
        name: 'deno-package-consumer',
        provider: 'local',
        labels: {
          example: '16-deno',
          tenantId: input.tenantId,
          runtime: 'deno',
        },
      },
      wait: {
        until: 'session',
        timeoutMs: 60_000,
      },
    },
  })
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
    example: '16-deno',
    deno: true,
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

function readEnv(): DenoExampleEnv {
  return {
    FIRELINE_ENDPOINT: Deno.env.get('FIRELINE_ENDPOINT'),
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

function safeIdPart(value: string): string {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return cleaned.replace(/^-+|-+$/g, '') || 'unknown'
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
