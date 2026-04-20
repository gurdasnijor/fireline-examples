import { budget, contextInjection, trace } from '@fireline/client/middleware'
import {
  createManagedAgentClient,
  createManagedAgentLaunchRequest,
  inlineJsBundleAgent,
  type ManagedAgentClient,
  type ManagedAgentLaunchHandle,
  type ManagedAgentStopResult,
} from '@fireline/client/managed-agent'

export type BrainPlacement = 'inline-js-local'
export type FilesystemPlacement = 'local' | 'streamFs'
export type MiddlewareChoice = 'trace' | 'contextInjection' | 'budget'
export type EditableAcpConnection =
  Awaited<ReturnType<ManagedAgentLaunchHandle<'editable-agent-web'>['connectBrowserAcp']>>
type EditableLaunchRow = NonNullable<ReturnType<ManagedAgentLaunchHandle<'editable-agent-web'>['current']>>

export interface EditableLaunchOptions {
  readonly controlStreamUrl: string
  readonly agentCode: string
  readonly initialPrompt: string
  readonly brainPlacement: BrainPlacement
  readonly filesystemPlacement: FilesystemPlacement
  readonly middleware: readonly MiddlewareChoice[]
}

export interface EditableLaunchResult {
  readonly envelope: NonNullable<ManagedAgentLaunchHandle<'editable-agent-web'>['requestEnvelope']>
  readonly row: EditableLaunchRow
  readonly handle: ManagedAgentLaunchHandle<'editable-agent-web'>
  readonly client: ManagedAgentClient
  readonly connectBrowserAcp: ManagedAgentLaunchHandle<'editable-agent-web'>['connectBrowserAcp']
  close(): void
}

export async function createEditableLaunch(options: EditableLaunchOptions): Promise<EditableLaunchResult> {
  const clientRequestId = `editable-agent-web-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const request = createManagedAgentLaunchRequest({
    name: 'editable-agent-web',
    agent: await inlineJsBundleAgent({
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
    clientRequestId,
    runtime: {
      name: 'editable-agent-web',
      provider: 'local',
      labels: {
        example: '02-editable-agent-web',
        mode: 'discovery',
      },
    },
    startSession: {
      stateStream: clientRequestId,
      create: true,
      cwd: '/',
      mcpServers: [],
      prompt: options.initialPrompt,
    },
    wait: {
      until: 'session',
      timeoutMs: 60_000,
    },
  })

  const client = createManagedAgentClient({
    launchControlStreamUrl: options.controlStreamUrl,
    requestedBy: 'examples/02-editable-agent-web',
    defaults: {
      wait: {
        until: 'session_ready',
        timeoutMs: 60_000,
      },
      stopReason: 'editable-agent-web stop requested',
    },
  })
  try {
    const handle = await client.launch(request, {
      idempotencyKey: clientRequestId,
      wait: {
        until: 'session_ready',
        timeoutMs: 60_000,
      },
    })
    const row = handle.current() ?? await handle.waitUntil('session_ready', { timeoutMs: 60_000 })
    const envelope = handle.requestEnvelope
    if (!envelope) {
      throw new Error(`Managed-agent launch ${handle.launchId} did not expose a request envelope`)
    }
    return {
      envelope,
      row,
      handle,
      client,
      connectBrowserAcp: handle.connectBrowserAcp,
      close() {
        handle.close()
        client.close()
      },
    }
  } catch (error) {
    client.close()
    throw error
  }
}

export async function stopEditableLaunch(options: {
  readonly launch: EditableLaunchResult
  readonly reason?: string
}): Promise<ManagedAgentStopResult & { readonly row: EditableLaunchRow }> {
  const stopped = await options.launch.handle.stop({
    clientRequestId: options.launch.row.clientRequestId,
    requestedBy: 'examples/02-editable-agent-web',
    reason: options.reason ?? 'editable-agent-web stop requested',
    wait: {
      until: 'terminal',
      timeoutMs: 60_000,
    },
  })
  const row = stopped.row ?? await options.launch.handle.waitUntil('terminal', { timeoutMs: 60_000 })
  return { ...stopped, row }
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
