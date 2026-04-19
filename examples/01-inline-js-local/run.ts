import {
  conductorSpec,
  createLaunchRequest,
  inlineBundleArtifact,
  jsModuleAgentForm,
  textPrompt,
  type SandboxSpec,
} from '@fireline/client/spec'
import { FirelineLaunchControlClient } from '@fireline/client/launch-control'
import {
  budget,
  contextInjection,
  trace,
} from '@fireline/client/middleware'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const launchUrl = requiredEnv('FIRELINE_LAUNCH_URL')
const client = new FirelineLaunchControlClient({
  launchUrl,
})
const outputRoot = process.env.FIRELINE_EXAMPLE_OUTPUT_ROOT ??
  join(process.cwd(), 'inline-js-local-output')
const runId = Date.now()

interface MatrixCase {
  readonly name: string
  readonly fsBackend: NonNullable<SandboxSpec['fsBackend']>
  readonly middleware: ReadonlyArray<{ readonly kind: string }>
}

const cases: readonly MatrixCase[] = [
  {
    name: 'local-fs-no-middleware',
    fsBackend: 'local',
    middleware: [],
  },
  {
    name: 'stream-fs-no-middleware',
    fsBackend: 'streamFs',
    middleware: [],
  },
  {
    name: 'local-fs-trace',
    fsBackend: 'local',
    middleware: [
      trace({
        streamName: 'audit:inline-js-local',
        includeMethods: ['session/new', 'session/prompt'],
      }),
    ],
  },
  {
    name: 'local-fs-context-budget',
    fsBackend: 'local',
    middleware: [
      contextInjection({
        prependText: 'Discovery matrix context: answer tersely.',
        placement: 'prepend',
      }),
      budget({ tokens: 100_000 }),
    ],
  },
  {
    name: 'stream-fs-trace-context-budget',
    fsBackend: 'streamFs',
    middleware: [
      trace({
        streamName: 'audit:inline-js-local-stream-fs',
        includeMethods: ['session/new', 'session/prompt'],
      }),
      contextInjection({
        prependText: 'Discovery matrix context for stream-backed fs.',
        placement: 'prepend',
      }),
      budget({ tokens: 100_000 }),
    ],
  },
]

const summaries = []
for (const entry of cases) {
  summaries.push(await runCase(entry))
}

console.log(JSON.stringify({ matrix: summaries }, null, 2))

async function runCase(entry: MatrixCase) {
  const clientRequestId = `inline-js-local-${entry.name}-${runId}`
  const stateStream = clientRequestId
  const outputDir = join(outputRoot, entry.name)
  const outputFile = join(outputDir, 'agent-output.txt')
  await mkdir(outputDir, { recursive: true })

  const artifact = await inlineBundleArtifact({
    entrypoint: 'agent.mjs',
    files: [{
      path: 'agent.mjs',
      mediaType: 'text/javascript',
      content: agentSource({ entry, outputFile }),
    }],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: 'examples/01-inline-js-local',
      revision: entry.name,
    },
  })

  const spec = conductorSpec({
    name: `inline-js-local-${entry.name}`,
    agent: jsModuleAgentForm({ artifact }),
    sandbox: {
      provider: 'local',
      fsBackend: entry.fsBackend,
      env: {
        FIRELINE_EXAMPLE_CASE: entry.name,
      },
      labels: {
        example: '01-inline-js-local',
        mode: 'discovery',
        matrix: entry.name,
        fsBackend: entry.fsBackend,
      },
    },
    middleware: {
      kind: 'middleware',
      chain: entry.middleware,
    },
  })

  const request = createLaunchRequest(spec, {
    clientRequestId,
    runtime: {
      name: `inline-js-local-${entry.name}`,
      provider: 'local',
      labels: {
        example: '01-inline-js-local',
        matrix: entry.name,
      },
    },
    startSession: {
      stateStream,
      create: true,
      newSession: {
        cwd: process.cwd(),
        mcpServers: [],
      },
      prompt: textPrompt(`ping from external fireline-examples case ${entry.name}`),
    },
    wait: {
      until: 'session',
      timeoutMs: 30_000,
    },
  })

  const created = await client.create(request, {
    idempotencyKey: clientRequestId,
  })
  const result = created.result ? created : await client.awaitLaunchResult({
    launch: created,
    timeoutMs: 30_000,
  })

  const fileContents = await readFile(outputFile, 'utf8')
  const stopped = await client.stop({ launch: result })

  return {
    case: entry.name,
    fsBackend: entry.fsBackend,
    middlewareKinds: entry.middleware.map((middleware) => middleware.kind),
    launchId: result.launchId,
    clientRequestId: result.clientRequestId,
    status: result.status,
    result: result.result ?? false,
    partial: result.partial ?? false,
    waitCoordinates: result.waitCoordinates,
    launchState: result.launchState,
    runtime: result.runtime
      ? {
          runtimeId: result.runtime.runtimeId,
          name: result.runtime.name,
          provider: result.runtime.provider,
          status: result.runtime.status,
          acpUrl: result.runtime.acp.url,
          state: result.runtime.state,
        }
      : undefined,
    session: result.startSession
      ? {
          acpSessionId: result.startSession.acpSessionId,
          requestedStateStream: stateStream,
        }
      : undefined,
    localFs: {
      outputFile,
      contents: fileContents,
    },
    stopped: {
      launchId: stopped.launchId,
      status: stopped.status,
      waitCoordinates: stopped.waitCoordinates,
    },
  }
}

function agentSource({ entry, outputFile }: {
  readonly entry: MatrixCase
  readonly outputFile: string
}): string {
  return `
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export default async function handle(ctx) {
  const outputFile = ${JSON.stringify(outputFile)}
  const text = [
    "case=${entry.name}",
    "fsBackend=${entry.fsBackend}",
    "middleware=${entry.middleware.map((middleware) => middleware.kind).join(',') || 'none'}",
    "prompt=" + ctx.prompt[0].text,
    "env=" + process.env.FIRELINE_EXAMPLE_CASE,
  ].join("\\n")
  await mkdir(dirname(outputFile), { recursive: true })
  await writeFile(outputFile, text + "\\n", "utf8")
  await ctx.session.text("matrix case " + ${JSON.stringify(entry.name)} + " wrote " + outputFile)
  await ctx.session.complete()
}
`
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required. Run through fireline-v3-dev.`)
  }
  return value
}
