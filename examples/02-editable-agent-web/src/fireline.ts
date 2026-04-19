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
import { FirelineLaunchControlClient, type LaunchEnvelope } from '@fireline/client/launch-control'
import { budget, contextInjection, trace } from '@fireline/client/middleware'

export type BrainPlacement = 'inline-js-local'
export type FilesystemPlacement = 'local' | 'streamFs'
export type MiddlewareChoice = 'trace' | 'contextInjection' | 'budget'

export interface EditableLaunchOptions {
  readonly launchUrl: string
  readonly agentCode: string
  readonly initialPrompt: string
  readonly brainPlacement: BrainPlacement
  readonly filesystemPlacement: FilesystemPlacement
  readonly middleware: readonly MiddlewareChoice[]
}

export interface EditableLaunchResult {
  readonly client: FirelineLaunchControlClient
  readonly created: LaunchEnvelope
  readonly result: LaunchEnvelope
}

export async function createEditableLaunch(options: EditableLaunchOptions): Promise<EditableLaunchResult> {
  const clientRequestId = `editable-agent-web-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const client = new FirelineLaunchControlClient({
    launchUrl: options.launchUrl,
  })
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
  return { client, created, result }
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
