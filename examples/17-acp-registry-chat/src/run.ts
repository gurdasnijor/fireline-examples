import {
  acpRegistry,
  type ResolveAcpRegistryOptions,
} from '@fireline/client'
import {
  createManagedAgentLaunchRequest,
} from '@fireline/client/managed-agent'
import {
  budget,
  contextInjection,
  trace,
} from '@fireline/client/middleware'
import {
  launchManagedAgent,
  stopManagedAgent,
  type ManagedAgentLaunchRow,
} from '../../shared/managed-agent-launch.js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

interface RegistryChatEnv {
  readonly FIRELINE_LAUNCH_CONTROL_STREAM_URL?: string
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
  readonly controlStreamUrl: string
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
  const request = createManagedAgentLaunchRequest({
    name: registryAgentId,
    agent: registryAgent,
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
    clientRequestId,
    runtime: {
      name: exampleId,
      provider: 'local',
      labels: {
        example: exampleId,
        registryAgentId,
      },
    },
    startSession: {
      stateStream: sessionStateStream(input),
      create: true,
      cwd: process.cwd(),
      mcpServers: [],
      prompt: input.initialPrompt,
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
    timeoutMs: 60_000,
  })
  const followUp = await promptLaunchedSession({
    handle: launch.handle,
    row: launch.row,
    prompt: input.followUpPrompt,
  })
  const stop = await stopManagedAgent({
    handle: launch.handle,
    clientRequestId,
    requestedBy: config.requestedBy,
    reason: 'ACP registry chat example complete',
    timeoutMs: 60_000,
  }).finally(() => launch.handle.close())

  return {
    ok: true,
    example: exampleId,
    controlStream: config.controlStream,
    registry: {
      agentId: registryAgentId,
      version: registryAgentVersion,
      transport: 'command',
      command: registryAgent.command,
    },
    launchId: launch.row.launchId,
    clientRequestId: launch.row.clientRequestId,
    launchStatus: launch.row.status,
    runtime: launch.row.runtime
      ? {
          runtimeId: launch.row.runtime.runtimeId,
          acpUrl: launch.row.runtime.acp.url,
        }
      : undefined,
    session: launch.row.startSession
      ? {
          acpSessionId: launch.row.startSession.acpSessionId,
        }
      : undefined,
    followUp,
    stopId: stop.stopId,
    stopStatus: stop.row.status,
  }
}

async function promptLaunchedSession(options: {
  readonly handle: Awaited<ReturnType<typeof launchManagedAgent>>['handle']
  readonly row: ManagedAgentLaunchRow
  readonly prompt: string
}) {
  const acpUrl = options.row.runtime?.acp.url
  const sessionId = options.row.startSession?.acpSessionId
  if (!acpUrl || !sessionId) {
    throw new Error(`Launch ${options.row.launchId} did not expose ACP session coordinates`)
  }
  const chunks: string[] = []
  const acp = await options.handle.connectBrowserAcp({
    clientName: 'fireline-examples-acp-registry-chat',
    clientVersion: '0.0.0',
    onSessionUpdate(notification) {
      const update = notification.update
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
        chunks.push(update.content.text)
      }
    },
  })
  try {
    const result = await acp.connection.prompt({
      sessionId,
      prompt: textPrompt(options.prompt),
    })
    return {
      stopReason: result.stopReason,
      text: chunks.join(''),
    }
  } finally {
    await acp.close()
  }
}

function textPrompt(text: string) {
  return [{ type: 'text' as const, text }]
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

function sessionStateStream(input: ReturnType<typeof normalizeInput>): string {
  return [
    exampleId,
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
  return value.replace(/\/+$/, '')
}
