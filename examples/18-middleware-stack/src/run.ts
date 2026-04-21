import {
  acp,
  Agent,
  Fireline,
  type ManagedAgentSessionHandle,
} from '@fireline/client/managed-agent'
import {
  budget,
  contextInjection,
  trace,
} from '@fireline/client/middleware'

interface MiddlewareStackEnv {
  readonly FIRELINE_ENDPOINT?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
  readonly MIDDLEWARE_STACK_TENANT_ID?: string
  readonly MIDDLEWARE_STACK_RUN_ID?: string
  readonly MIDDLEWARE_STACK_ATTEMPT_ID?: string
  readonly MIDDLEWARE_STACK_PROMPT?: string
}

type MiddlewareSpec =
  | ReturnType<typeof trace>
  | ReturnType<typeof contextInjection>
  | ReturnType<typeof budget>

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
  const fireline = new Fireline({
    endpoint: config.endpoint,
    requestedBy,
  })
  const agent = await createAgent(clientRequestId, input, middlewareChain)

  let session: ManagedAgentSessionHandle | undefined
  try {
    session = await fireline.session(agent, {
      idempotencyKey: clientRequestId,
      requestedBy,
    })
    const snapshot = await session.waitUntil('session_ready', { timeoutMs: 60_000 })
    const stop = await session.stop({
      clientRequestId,
      requestedBy,
      reason: 'Middleware stack example complete',
      wait: {
        until: 'terminal',
        timeoutMs: 60_000,
      },
    })

    return {
      ok: true,
      example: exampleId,
      controlStream: config.controlStream,
      endpoint: config.endpoint,
      launchId: session.launchId,
      sessionId: snapshot.sessionId,
      sessionStatus: snapshot.status,
      requiredActions: snapshot.requiredActions.map((action) => action.type),
      middlewareKinds: middlewareChain.map((middleware) => middleware.kind),
      traceStreamName: middlewareChain[0].streamName,
      requestedStateStream: sessionStateStream(input),
      stop: {
        stopId: stop.envelope.value.stopId,
        stopStatus: (stop.row ?? snapshot).status,
      },
    }
  } finally {
    session?.close()
    fireline.close()
  }
}

async function createAgent(
  revision: string,
  input: ReturnType<typeof normalizeInput>,
  middlewareChain: readonly MiddlewareSpec[],
) {
  return new Agent({
    id: 'middleware-stack',
    entrypoint: await acp.inlineJsBundle({
      entrypoint: 'agent.mjs',
      files: [{
        path: 'agent.mjs',
        mediaType: 'text/javascript',
        content: agentSource(input, middlewareChain.map((middleware) => middleware.kind)),
      }],
      provenance: {
        producer: 'fireline-examples-discovery',
        source: `examples/${exampleId}`,
        revision,
      },
    }),
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
    defaults: {
      prompt: input.prompt,
      cwd: '/',
      mcpServers: [],
      runtime: {
        name: exampleId,
        provider: 'local',
        labels: {
          example: exampleId,
          tenantId: input.tenantId,
        },
      },
      wait: {
        until: 'session',
        timeoutMs: 60_000,
      },
    },
  })
}

function deriveConfig(env: MiddlewareStackEnv) {
  const controlStream = env.FIRELINE_CONTROL_STREAM ?? defaultControlStream
  if (env.FIRELINE_ENDPOINT) {
    return {
      controlStream,
      endpoint: env.FIRELINE_ENDPOINT,
    }
  }

  const durableStreamsBase =
    env.FIRELINE_DURABLE_STREAMS_URL ??
    `http://127.0.0.1:${env.FIRELINE_STREAMS_PORT ?? defaultStreamsPort}/v1/stream`
  return {
    controlStream,
    endpoint: `${trimTrailingSlash(durableStreamsBase)}/${encodeURIComponent(controlStream)}`,
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
