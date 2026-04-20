import { createHash } from 'node:crypto'

const mode = process.argv[2]

if (mode !== 'launch' && mode !== 'stop') {
  console.error('usage: node make-envelope.mjs <launch|stop>')
  process.exit(64)
}

const launchId = requiredEnv('FIRELINE_RAW_HTTP_LAUNCH_ID')
const clientRequestId = requiredEnv('FIRELINE_RAW_HTTP_CLIENT_REQUEST_ID')
const requestedBy = process.env.FIRELINE_RAW_HTTP_REQUESTED_BY ?? 'examples/07-curl-shell-raw-http'
const requestedAt = new Date().toISOString()

if (mode === 'launch') {
  const stateStream = requiredEnv('FIRELINE_RAW_HTTP_STATE_STREAM')
  const prompt = process.env.FIRELINE_RAW_HTTP_PROMPT ?? 'ping from raw Durable Streams HTTP'
  const timeoutMs = numberEnv('FIRELINE_RAW_HTTP_WAIT_TIMEOUT_MS', 60_000)
  const source = agentSource()
  const artifact = inlineBundleArtifact({
    entrypoint: 'agent.mjs',
    files: [{
      path: 'agent.mjs',
      mediaType: 'text/javascript',
      content: source,
    }],
    provenance: {
      producer: 'fireline-examples',
      source: 'examples/07-curl-shell-raw-http',
      revision: launchId,
    },
  })

  printJson({
    type: 'fireline.launch_request',
    key: `launch:${launchId}`,
    headers: { operation: 'insert' },
    value: {
      launchId,
      clientRequestId,
      idempotencyKey: clientRequestId,
      target: {
        kind: 'inlineConductorSpec',
        spec: {
          __fireline_brand: 'conductor_spec',
          name: 'curl-shell-raw-http',
          sandboxes: {
            default: {
              provider: 'local',
              fsBackend: 'local',
              labels: {
                example: '07-curl-shell-raw-http',
                mode: 'raw-http',
              },
            },
          },
          middleware: {
            __fireline_brand: 'middleware_chain',
            kind: 'middleware',
            chain: [],
          },
          agent: {
            __fireline_brand: 'agent_config',
            kind: 'agent',
            command: [],
            form: {
              __fireline_brand: 'agent_form_spec',
              kind: 'jsModule',
              artifact,
            },
          },
        },
      },
      startSession: {
        stateStream,
        create: true,
        prompt: [{ type: 'text', text: prompt }],
        newSession: {
          cwd: process.cwd(),
          mcpServers: [],
        },
      },
      runtime: {
        name: 'curl-shell-raw-http',
        provider: 'local',
        labels: {
          example: '07-curl-shell-raw-http',
          mode: 'raw-http',
        },
      },
      wait: {
        until: 'session',
        timeoutMs,
      },
      requestedAt,
      requestedBy,
    },
  })
} else {
  const stopId = process.env.FIRELINE_RAW_HTTP_STOP_ID ?? `stop-${Date.now()}`
  printJson({
    type: 'fireline.launch_stop',
    key: `launch:${launchId}/stop:${stopId}`,
    headers: { operation: 'insert' },
    value: {
      launchId,
      stopId,
      requestedAt,
      requestedBy,
      clientRequestId,
      reason: process.env.FIRELINE_RAW_HTTP_STOP_REASON ?? 'raw HTTP example complete',
    },
  })
}

function agentSource() {
  return `
export default async function handle(ctx) {
  const promptText = Array.isArray(ctx.prompt)
    ? ctx.prompt.map((block) => block && typeof block.text === "string"
      ? block.text
      : JSON.stringify(block)).join("\\n")
    : ""
  await ctx.session.text("raw Durable Streams HTTP launch received: " + promptText)
  await ctx.session.complete()
}
`.trimStart()
}

function inlineBundleArtifact(input) {
  const files = input.files
    .map((file) => {
      const contentBase64 = Buffer.from(file.content, 'utf8').toString('base64')
      return {
        path: normalizePath(file.path),
        contentBase64,
        mediaType: file.mediaType ?? 'text/javascript',
        sha256: sha256Hex(Buffer.from(file.content, 'utf8')),
      }
    })
    .sort((left, right) => left.path.localeCompare(right.path))
  const artifact = {
    kind: 'inlineBundle',
    entrypoint: normalizePath(input.entrypoint),
    files,
    provenance: {
      producer: input.provenance.producer,
      createdAt: new Date().toISOString(),
      source: input.provenance.source,
      revision: input.provenance.revision,
    },
  }
  return {
    ...artifact,
    integrity: `sha256:${sha256Hex(Buffer.from(stableJson({
      kind: artifact.kind,
      entrypoint: artifact.entrypoint,
      files: artifact.files.map((file) => ({
        path: file.path,
        mediaType: file.mediaType,
        sha256: file.sha256,
      })),
      provenance: {
        producer: artifact.provenance.producer,
        source: artifact.provenance.source,
        revision: artifact.provenance.revision,
      },
    }), 'utf8'))}`,
  }
}

function normalizePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.split('/').some((part) => part === '' || part === '.' || part === '..')
  ) {
    throw new Error(`invalid inline bundle path: ${String(value)}`)
  }
  return value
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function numberEnv(name, fallback) {
  const value = process.env[name]
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`)
  }
  return parsed
}
