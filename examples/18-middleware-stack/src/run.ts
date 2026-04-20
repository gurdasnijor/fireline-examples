import {
  createManagedAgentLaunchRequest,
  inlineJsBundleAgent,
} from '@fireline/client/managed-agent'
import {
  budget,
  contextInjection,
  trace,
} from '@fireline/client/middleware'
import {
  launchManagedAgent,
  stopManagedAgent,
} from '../../shared/managed-agent-launch.js'

interface MiddlewareStackEnv {
  readonly FIRELINE_LAUNCH_CONTROL_STREAM_URL?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
  readonly MIDDLEWARE_STACK_TENANT_ID?: string
  readonly MIDDLEWARE_STACK_RUN_ID?: string
  readonly MIDDLEWARE_STACK_ATTEMPT_ID?: string
  readonly MIDDLEWARE_STACK_PROMPT?: string
}

const exampleId = '18-middleware-stack'
const defaultControlStream = 'fireline-middleware-stack-control'
const defaultStreamsPort = '7474'
const requestedBy = `examples/${exampleId}`

const summary = await runMiddlewareStack(process.env)
console.log(JSON.stringify(summary, null, 2))

async function runMiddlewareStack(env: MiddlewareStackEnv) {
  const config = deriveConfig(env)
  const input = normalizeInput(env)
  const clientRequestId = stableClientRequestId(input)
  const middlewareChain = [
    trace({
      streamName: `audit:${exampleId}:${input.runId}`,
      includeMethods: ['session/new', 'session/prompt'],
    }),
    contextInjection({
      prependText: [
        'Middleware stack example context:',
        `tenant=${input.tenantId}`,
        'Keep the response short and include the word middleware.',
      ].join('\n'),
      placement: 'prepend',
      sources: [
        { kind: 'staticText', text: 'static source: package-shaped middleware builder' },
        { kind: 'datetime' },
      ],
    }),
    budget({ tokens: 10_000 }),
  ] as const

  const agent = await inlineJsBundleAgent({
    entrypoint: 'agent.mjs',
    files: [{
      path: 'agent.mjs',
      mediaType: 'text/javascript',
      content: agentSource(input, middlewareChain.map((middleware) => middleware.kind)),
    }],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: `examples/${exampleId}`,
      revision: clientRequestId,
    },
  })

  const request = createManagedAgentLaunchRequest({
    name: 'middleware-stack',
    agent,
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: exampleId,
        tenantId: input.tenantId,
      },
    },
    middleware: {
      kind: 'middleware',
      chain: middlewareChain,
    },
    clientRequestId,
    runtime: {
      name: exampleId,
      provider: 'local',
      labels: {
        example: exampleId,
        tenantId: input.tenantId,
      },
    },
    startSession: {
      stateStream: sessionStateStream(input),
      create: true,
      cwd: '/',
      mcpServers: [],
      prompt: input.prompt,
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
    requestedBy,
    timeoutMs: 60_000,
  })

  const stopped = await stopManagedAgent({
    handle: launch.handle,
    clientRequestId,
    requestedBy,
    reason: 'Middleware stack example complete',
    timeoutMs: 60_000,
  }).finally(() => launch.handle.close())

  return {
    ok: true,
    example: exampleId,
    controlStream: config.controlStream,
    controlStreamUrl: config.controlStreamUrl,
    clientRequestId: launch.row.clientRequestId,
    launchId: launch.row.launchId,
    launchStatus: launch.row.status,
    middlewareKinds: middlewareChain.map((middleware) => middleware.kind),
    traceStreamName: middlewareChain[0].streamName,
    runtime: launch.row.runtime
      ? {
          runtimeId: launch.row.runtime.runtimeId,
          acpUrl: launch.row.runtime.acp.url,
        }
      : undefined,
    session: launch.row.startSession
      ? {
          acpSessionId: launch.row.startSession.acpSessionId,
          requestedStateStream: sessionStateStream(input),
        }
      : undefined,
    stop: {
      stopId: stopped.stopId,
      stopStatus: stopped.row.status,
    },
  }
}

function deriveConfig(env: MiddlewareStackEnv) {
  const controlStream = env.FIRELINE_CONTROL_STREAM ?? defaultControlStream
  if (env.FIRELINE_LAUNCH_CONTROL_STREAM_URL) {
    return {
      controlStream,
      controlStreamUrl: env.FIRELINE_LAUNCH_CONTROL_STREAM_URL,
    }
  }

  const durableStreamsBase =
    env.FIRELINE_DURABLE_STREAMS_URL ??
    `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? defaultStreamsPort}/v1/stream`
  return {
    controlStream,
    controlStreamUrl: `${trimTrailingSlash(durableStreamsBase)}/${encodeURIComponent(controlStream)}`,
  }
}

function normalizeInput(env: MiddlewareStackEnv) {
  return {
    tenantId: env.MIDDLEWARE_STACK_TENANT_ID ?? 'tenant-middleware-stack',
    runId: env.MIDDLEWARE_STACK_RUN_ID ?? `run-${Date.now()}`,
    attemptId: env.MIDDLEWARE_STACK_ATTEMPT_ID ?? 'attempt-1',
    prompt: env.MIDDLEWARE_STACK_PROMPT ??
      'Run the Fireline middleware stack example and mention the middleware chain.',
  }
}

function stableClientRequestId(input: ReturnType<typeof normalizeInput>): string {
  return `launch:middleware-stack:${input.tenantId}:${input.runId}:${input.attemptId}`
}

function sessionStateStream(input: ReturnType<typeof normalizeInput>): string {
  return `middleware-stack-${input.tenantId}-${input.runId}-${input.attemptId}`
    .replace(/[^a-zA-Z0-9_.:-]+/g, '-')
    .slice(0, 120)
}

function agentSource(
  input: ReturnType<typeof normalizeInput>,
  middlewareKinds: readonly string[],
): string {
  return `
export default async function middlewareStackAgent(ctx) {
  await ctx.session.text(${JSON.stringify(`tenant=${input.tenantId}`)})
  await ctx.session.text(${JSON.stringify(`middleware=${middlewareKinds.join(',')}`)})
  await ctx.session.text("prompt=" + ctx.prompt[0].text)
  await ctx.session.complete()
}
`
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
