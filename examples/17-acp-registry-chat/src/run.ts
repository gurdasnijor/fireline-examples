import {
  acpRegistry,
  type ResolveAcpRegistryOptions,
} from '@fireline/client'
import {
  Agent,
  Fireline,
  type ManagedAgentSessionHandle,
} from '@fireline/client/managed-agent'
import {
  budget,
  contextInjection,
  trace,
} from '@fireline/client/middleware'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface RegistryChatEnv {
  readonly FIRELINE_ENDPOINT?: string
  readonly FIRELINE_DURABLE_STREAMS_URL?: string
  readonly FIRELINE_STREAMS_PORT?: string
  readonly FIRELINE_CONTROL_STREAM?: string
  readonly ACP_REGISTRY_CHAT_RUN_ID?: string
  readonly ACP_REGISTRY_CHAT_ATTEMPT_ID?: string
  readonly ACP_REGISTRY_CHAT_INITIAL_PROMPT?: string
  readonly ACP_REGISTRY_CHAT_FOLLOW_UP_PROMPT?: string
}

interface RegistryChatConfig {
  readonly controlStream: string
  readonly endpoint: string
  readonly requestedBy: string
}

const exampleId = '17-acp-registry-chat'
const registryAgentId = 'fireline-example-registry-echo'
const registryAgentVersion = '0.0.1'
const defaultControlStream = 'fireline-acp-registry-chat-control'
const defaultStreamsPort = '7474'
const requestedBy = `examples/${exampleId}`

const summary = await runRegistryChat(process.env)
console.log(JSON.stringify(summary, null, 2))

async function runRegistryChat(env: RegistryChatEnv) {
  const config = deriveConfig(env)
  const input = normalizeInput(env)
  const clientRequestId = stableClientRequestId(input)
  const registryAgent = await acpRegistry(registryAgentId, {
    catalog: registryCatalog(),
    transport: 'command',
  } satisfies ResolveAcpRegistryOptions)
  const fireline = new Fireline({
    endpoint: config.endpoint,
    requestedBy: config.requestedBy,
  })
  const agent = new Agent({
    id: registryAgentId,
    entrypoint: registryAgent,
    sandbox: {
      provider: 'local',
      fsBackend: 'streamFs',
      labels: {
        example: exampleId,
        source: 'acp-registry-fixture',
      },
    },
    middleware: {
      kind: 'middleware',
      chain: [
        trace({
          streamName: `audit:${exampleId}`,
          includeMethods: ['session/new', 'session/prompt'],
        }),
        contextInjection({
          prependText: 'Registry chat example context: reply in one short sentence.',
          placement: 'prepend',
        }),
        budget({ tokens: 10_000 }),
      ],
    },
    defaults: {
      prompt: input.initialPrompt,
      cwd: process.cwd(),
      mcpServers: [],
      runtime: {
        name: exampleId,
        provider: 'local',
        labels: {
          example: exampleId,
          registryAgentId,
        },
      },
      wait: {
        until: 'session',
        timeoutMs: 60_000,
      },
    },
  })

  let session: ManagedAgentSessionHandle | undefined
  try {
    session = await fireline.session(agent, {
      idempotencyKey: clientRequestId,
      requestedBy: config.requestedBy,
    })
    const snapshot = await session.waitUntil('session_ready', { timeoutMs: 60_000 })
    const followUp = await session.chat(input.followUpPrompt)
    const afterChat = session.current()
    const stop = await session.stop({
      clientRequestId,
      requestedBy: config.requestedBy,
      reason: 'ACP registry chat example complete',
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
      registry: {
        agentId: registryAgentId,
        version: registryAgentVersion,
        transport: 'command',
        command: registryAgent.command,
      },
      launchId: session.launchId,
      sessionId: afterChat.sessionId ?? snapshot.sessionId,
      sessionStatus: afterChat.status,
      requiredActions: afterChat.requiredActions.map((action) => action.type),
      followUp: {
        stopReason: followUp.stopReason,
        text: extractResponseText(followUp.response),
      },
      stopId: stop.envelope.value.stopId,
      stopStatus: (stop.row ?? afterChat).status,
    }
  } finally {
    session?.close()
    fireline.close()
  }
}

function extractResponseText(response: Record<string, unknown>): string {
  const content = response.content
  if (Array.isArray(content)) {
    return content
      .map((entry) => {
        if (entry && typeof entry === 'object' && 'type' in entry && 'text' in entry) {
          const textEntry = entry as { type?: unknown; text?: unknown }
          return textEntry.type === 'text' && typeof textEntry.text === 'string' ? textEntry.text : ''
        }
        return ''
      })
      .filter(Boolean)
      .join('')
  }
  return ''
}

function registryCatalog() {
  return {
    agents: [{
      id: registryAgentId,
      version: registryAgentVersion,
      distribution: {
        command: {
          command: process.execPath,
          args: [registryAgentPath()],
        },
      },
    }],
  }
}

function registryAgentPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../registry-agent.mjs')
}

function deriveConfig(env: RegistryChatEnv): RegistryChatConfig {
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

function normalizeInput(env: RegistryChatEnv) {
  return {
    runId: env.ACP_REGISTRY_CHAT_RUN_ID ?? `run-${Date.now()}`,
    attemptId: env.ACP_REGISTRY_CHAT_ATTEMPT_ID ?? 'attempt-1',
    initialPrompt: env.ACP_REGISTRY_CHAT_INITIAL_PROMPT ??
      'Start a registry-selected ACP chat session.',
    followUpPrompt: env.ACP_REGISTRY_CHAT_FOLLOW_UP_PROMPT ??
      'Reply with the registry id you were launched from.',
  }
}

function stableClientRequestId(input: ReturnType<typeof normalizeInput>): string {
  return [
    'launch',
    exampleId,
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
