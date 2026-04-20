import {
  conductorSpec,
  createLaunchRequest,
  inlineBundleArtifact,
  jsModuleAgentForm,
  textPrompt,
  type LaunchConductorSpec,
  type MiddlewareChain,
  type SandboxSpec,
} from '@fireline/client/spec'
import { budget, contextInjection, trace } from '@fireline/client/middleware'
import type { FirelineDB, LaunchRow } from '@fireline/state'
import {
  appendAndObserveLaunch,
  appendAndObserveLaunchStop,
  type StreamLaunchStopResult,
} from '../../shared/stream-launch.js'

export type BrainPlacement = 'inline-js-local'
export type FilesystemPlacement = 'local' | 'streamFs'
export type MiddlewareChoice = 'trace' | 'contextInjection' | 'budget'

export interface EditableLaunchOptions {
  readonly controlStreamUrl: string
  readonly agentCode: string
  readonly initialPrompt: string
  readonly brainPlacement: BrainPlacement
  readonly filesystemPlacement: FilesystemPlacement
  readonly middleware: readonly MiddlewareChoice[]
}

export interface EditableLaunchResult {
  readonly envelope: Awaited<ReturnType<typeof appendAndObserveLaunch>>['envelope']
  readonly row: LaunchRow
  readonly db: FirelineDB
}

export async function createEditableLaunch(options: EditableLaunchOptions): Promise<EditableLaunchResult> {
  const clientRequestId = `editable-agent-web-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const spec = await editableSpec(options, clientRequestId)
  const request = createLaunchRequest(spec, {
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
      newSession: {
        cwd: '/',
        mcpServers: [],
      },
      prompt: textPrompt(options.initialPrompt),
    },
    wait: {
      until: 'session',
      timeoutMs: 60_000,
    },
  })

  const result = await appendAndObserveLaunch({
    controlStreamUrl: options.controlStreamUrl,
    request,
    idempotencyKey: clientRequestId,
    requestedBy: 'examples/02-editable-agent-web',
    timeoutMs: 60_000,
  })
  return result
}

export async function stopEditableLaunch(options: {
  readonly controlStreamUrl: string
  readonly launch: EditableLaunchResult
  readonly reason?: string
}): Promise<StreamLaunchStopResult> {
  return await appendAndObserveLaunchStop({
    controlStreamUrl: options.controlStreamUrl,
    launchId: options.launch.row.launchId,
    clientRequestId: options.launch.row.clientRequestId,
    requestedBy: 'examples/02-editable-agent-web',
    reason: options.reason ?? 'editable-agent-web stop requested',
    timeoutMs: 60_000,
  })
}

async function editableSpec(
  options: EditableLaunchOptions,
  clientRequestId: string,
): Promise<LaunchConductorSpec<'editable-agent-web'>> {
  const artifact = await inlineBundleArtifact({
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
  })
  const sandbox: SandboxSpec = {
    provider: 'local',
    fsBackend: options.filesystemPlacement,
    labels: {
      example: '02-editable-agent-web',
      mode: 'discovery',
      brain: options.brainPlacement,
      fsBackend: options.filesystemPlacement,
    },
  }
  return conductorSpec({
    name: 'editable-agent-web',
    agent: jsModuleAgentForm({ artifact }),
    sandbox,
    middleware: middlewareChain(options.middleware),
  })
}

function middlewareChain(choices: readonly MiddlewareChoice[]): MiddlewareChain {
  return {
    kind: 'middleware',
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
