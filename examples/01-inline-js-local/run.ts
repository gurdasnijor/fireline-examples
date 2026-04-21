import {
  Agent,
  Fireline,
  acp,
} from '@fireline/client/managed-agent'
import {
  budget,
  contextInjection,
  trace,
} from '@fireline/client/middleware'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const endpoint = requiredEnv('FIRELINE_ENDPOINT')
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
  const outputDir = join(outputRoot, entry.name)
  const outputFile = join(outputDir, 'agent-output.txt')
  await mkdir(outputDir, { recursive: true })

  const fireline = new Fireline({
    endpoint,
    requestedBy: 'examples/01-inline-js-local',
  })

  try {
    const agent = new Agent({
      id: `inline-js-local-${entry.name}`,
      entrypoint: await acp.inlineJsBundle({
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
          tier: 'managed-agent',
        },
      },
      middleware: entry.middleware,
      defaults: {
        cwd: process.cwd(),
      },
    })

    const result = await fireline.run(agent, {
      prompt: `ping from external fireline-examples case ${entry.name}`,
      idempotencyKey: clientRequestId,
      requestedBy: 'examples/01-inline-js-local',
    })
    const fileContents = await readFile(outputFile, 'utf8')

    return {
      case: entry.name,
      fsBackend: entry.fsBackend,
      middlewareKinds: entry.middleware.map((middleware) => middleware.kind),
      endpoint,
      launchId: result.launchId,
      sessionId: result.sessionId,
      stopReason: result.stopReason,
      response: result.response,
      localFs: {
        outputFile,
        contents: fileContents,
      },
    }
  } finally {
    fireline.close()
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
    "prompt=" + (ctx.prompt.find((block) => block.type === "text")?.text ?? ""),
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
    throw new Error(`${name} is required. Configure the Fireline endpoint.`)
  }
  return value
}
