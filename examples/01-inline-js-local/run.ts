import {
  createManagedAgentLaunchRequest,
  inlineJsBundleAgent,
} from '@fireline/client/managed-agent'
import {
  budget,
  contextInjection,
  trace,
} from '@fireline/client/middleware'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { launchAndStopManagedAgent } from '../shared/managed-agent-launch.js'

const controlStreamUrl = requiredEnv('FIRELINE_LAUNCH_CONTROL_STREAM_URL')
const outputRoot = process.env.FIRELINE_EXAMPLE_OUTPUT_ROOT ??
  join(process.cwd(), 'inline-js-local-output')
const runId = Date.now()

interface MatrixCase {
  readonly name: string
  readonly fsBackend: 'local' | 'streamFs'
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

  const request = createManagedAgentLaunchRequest({
    name: `inline-js-local-${entry.name}`,
    agent: await inlineJsBundleAgent({
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
    }),
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
      cwd: process.cwd(),
      mcpServers: [],
      prompt: `ping from external fireline-examples case ${entry.name}`,
    },
    wait: {
      until: 'session',
      timeoutMs: 60_000,
    },
  })

  const launch = await launchAndStopManagedAgent({
    controlStreamUrl,
    request,
    idempotencyKey: clientRequestId,
    requestedBy: 'examples/01-inline-js-local',
    stopReason: `matrix case ${entry.name} complete`,
    timeoutMs: 60_000,
  })

  const fileContents = await readFile(outputFile, 'utf8')

  return {
    case: entry.name,
    fsBackend: entry.fsBackend,
    middlewareKinds: entry.middleware.map((middleware) => middleware.kind),
    launchId: launch.row.launchId,
    clientRequestId: launch.row.clientRequestId,
    status: launch.row.status,
    controlStreamUrl,
    envelope: {
      type: launch.envelope?.type,
      key: launch.envelope?.key,
    },
    stop: {
      status: launch.stop.row?.status,
      envelope: {
        type: launch.stop.envelope.type,
        key: launch.stop.envelope.key,
      },
    },
    runtime: launch.row.runtime
      ? {
          runtimeId: launch.row.runtime.runtimeId,
          name: launch.row.runtime.name,
          provider: launch.row.runtime.provider,
          status: launch.row.runtime.status,
          acpUrl: launch.row.runtime.acp.url,
          state: launch.row.runtime.state,
        }
      : undefined,
    session: launch.row.startSession
      ? {
          acpSessionId: launch.row.startSession.acpSessionId,
          requestedStateStream: stateStream,
        }
      : undefined,
    localFs: {
      outputFile,
      contents: fileContents,
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
    throw new Error(`${name} is required. Configure the durable launch/control stream URL.`)
  }
  return value
}
