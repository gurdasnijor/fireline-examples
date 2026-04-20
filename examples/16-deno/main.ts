import {
  createManagedAgentLaunchRequest,
  inlineJsBundleAgent,
} from '@fireline/client/managed-agent'
// @ts-expect-error Deno runs this TypeScript source directly.
import { launchManagedAgent, stopManagedAgent, type ManagedAgentLaunchRow } from '../shared/managed-agent-launch.ts'

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
  const request = createManagedAgentLaunchRequest({
    name: 'deno-package-consumer',
    agent: await createAgent(clientRequestId, launchInput),
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
    fetch,
    timeoutMs: 60_000,
  })

  const stop = await stopManagedAgent({
    handle: launch.handle,
    clientRequestId,
    requestedBy: config.requestedBy,
    reason: 'Deno package consumer example complete',
    timeoutMs: 60_000,
  }).finally(() => launch.handle.close())

  return summarizeRun({
    config,
    input: launchInput,
    launchEnvelopeKey: launch.handle.requestEnvelope?.key,
    launchRow: launch.row,
    stop,
  })
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
}

function summarizeRun(options: {
  readonly config: LaunchConfig
  readonly input: ReturnType<typeof normalizeLaunchInput>
  readonly launchEnvelopeKey?: string
  readonly launchRow: ManagedAgentLaunchRow
  readonly stop: Awaited<ReturnType<typeof stopManagedAgent>>
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
    launchEnvelopeKey: options.launchEnvelopeKey,
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
    stopId: options.stop.stopId,
    stopStatus: options.stop.row.status,
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
