import { budget, contextInjection, trace } from '@fireline/client/middleware'
import {
  Agent,
  Fireline,
  acp,
  type ManagedAgentChatResult,
  type ManagedAgentSessionHandle,
  type ManagedAgentSessionSnapshot,
  type ManagedAgentStopResult,
} from '@fireline/client/managed-agent'

export type BrainPlacement = 'inline-js-local'
export type FilesystemPlacement = 'local' | 'streamFs'
export type MiddlewareChoice = 'trace' | 'contextInjection' | 'budget'
export type EditableSessionSnapshot = ManagedAgentSessionSnapshot

export interface EditableLaunchOptions {
  readonly endpoint: string
  readonly agentCode: string
  readonly initialPrompt: string
  readonly brainPlacement: BrainPlacement
  readonly filesystemPlacement: FilesystemPlacement
  readonly middleware: readonly MiddlewareChoice[]
}

export interface EditableLaunchResult {
  readonly fireline: Fireline
  readonly session: ManagedAgentSessionHandle
  readonly initialResponse: ManagedAgentChatResult
  current(): EditableSessionSnapshot
  subscribe(callback: (snapshot: EditableSessionSnapshot) => void): { unsubscribe(): void }
  close(): void
}

export async function createEditableLaunch(options: EditableLaunchOptions): Promise<EditableLaunchResult> {
  const clientRequestId = `editable-agent-web-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const fireline = new Fireline({
    endpoint: options.endpoint,
    requestedBy: 'examples/02-editable-agent-web',
    defaults: {
      wait: {
        until: 'session_ready',
        timeoutMs: 60_000,
      },
      stopReason: 'editable-agent-web stop requested',
    },
  })
  let session: ManagedAgentSessionHandle | undefined
  try {
    const agent = new Agent({
      id: 'editable-agent-web',
      entrypoint: await acp.inlineJsBundle({
        entrypoint: 'agent.mjs',
        files: [{
          path: 'agent.mjs',
          mediaType: 'text/javascript',
          content: options.agentCode,
        }],
        provenance: {
          producer: 'fireline-examples-discovery',
          source: 'examples/02-editable-agent-web',
          revision: clientRequestId,
        },
      }),
      sandbox: {
        provider: 'local',
        fsBackend: options.filesystemPlacement,
        labels: {
          example: '02-editable-agent-web',
          mode: 'discovery',
          brain: options.brainPlacement,
          fsBackend: options.filesystemPlacement,
        },
      },
      middleware: middlewareChain(options.middleware),
      defaults: {
        runtime: {
          name: 'editable-agent-web',
          provider: 'local',
          labels: {
            example: '02-editable-agent-web',
            mode: 'discovery',
          },
        },
        wait: {
          until: 'session',
          timeoutMs: 60_000,
        },
      },
    })
    session = await fireline.session(agent, {
      cwd: '/',
      mcpServers: [],
      idempotencyKey: clientRequestId,
      requestedBy: 'examples/02-editable-agent-web',
      advanced: {
        startSession: {
          create: true,
        },
      },
    })
    const activeSession = session
    const initialResponse = await activeSession.chat(options.initialPrompt, {
      wait: {
        until: 'session_ready',
        timeoutMs: 60_000,
      },
    })
    return {
      fireline,
      session: activeSession,
      initialResponse,
      current() {
        return activeSession.current()
      },
      subscribe(callback) {
        return activeSession.subscribe(callback)
      },
      close() {
        activeSession.close()
        fireline.close()
      },
    }
  } catch (error) {
    session?.close()
    fireline.close()
    throw error
  }
}

export async function stopEditableLaunch(options: {
  readonly launch: EditableLaunchResult
  readonly reason?: string
}): Promise<ManagedAgentStopResult & { readonly snapshot: EditableSessionSnapshot }> {
  const stopped = await options.launch.session.stop({
    requestedBy: 'examples/02-editable-agent-web',
    reason: options.reason ?? 'editable-agent-web stop requested',
    wait: {
      until: 'terminal',
      timeoutMs: 60_000,
    },
  })
  const snapshot = await options.launch.session.waitUntil('terminal', { timeoutMs: 60_000 })
  return { ...stopped, snapshot }
}

function middlewareChain(choices: readonly MiddlewareChoice[]) {
  return {
    kind: 'middleware' as const,
    chain: choices.map((choice) => {
      switch (choice) {
        case 'trace':
          return trace({
            streamName: 'audit:editable-agent-web',
            includeMethods: ['session/new', 'session/prompt'],
          })
        case 'contextInjection':
          return contextInjection({
            prependText: 'Discovery web app context: answer in one short paragraph.',
            placement: 'prepend',
          })
        case 'budget':
          return budget({ tokens: 100_000 })
      }
    }),
  }
}
