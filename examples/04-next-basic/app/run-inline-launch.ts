import {
  agentDefinition,
  inlineBundleArtifact,
  jsModuleAgentForm,
  launchSpec,
  newSessionRequest,
  textPrompt,
} from '@fireline/client/spec'
import { launchAndStopManagedAgent } from '../../shared/managed-agent-launch'

export async function runInlineLaunch(options: {
  readonly controlStreamUrl: string
  readonly prompt: string
  readonly example: string
}) {
  const clientRequestId = `${options.example}-${Date.now()}`
  const artifact = await inlineBundleArtifact({
    entrypoint: 'agent.mjs',
    files: [{
      path: 'agent.mjs',
      mediaType: 'text/javascript',
      content: `export default async function handle(ctx) {
  const text = ctx.prompt.find((block) => block.type === "text")?.text ?? ""
  await ctx.session.text("Next-shaped agent heard: " + text)
  await ctx.session.complete()
}
`,
    }],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: options.example,
      revision: clientRequestId,
    },
  })
  const spec = agentDefinition({
    name: options.example,
    agent: jsModuleAgentForm({ artifact }),
    sandbox: {
      provider: 'local',
      fsBackend: 'local',
      labels: {
        example: options.example,
        mode: 'discovery',
      },
    },
  })
  const request = launchSpec(spec, {
    clientRequestId,
    runtime: {
      name: options.example,
      provider: 'local',
    },
    startSession: {
      create: true,
      stateStream: clientRequestId,
      newSession: newSessionRequest({
        cwd: '/',
        mcpServers: [],
      }),
      prompt: textPrompt(options.prompt),
    },
    wait: {
      until: 'session',
      timeoutMs: 60_000,
    },
  })
  const result = await launchAndStopManagedAgent({
    controlStreamUrl: options.controlStreamUrl,
    request,
    idempotencyKey: clientRequestId,
    requestedBy: `examples/${options.example}`,
    stopReason: `${options.example} smoke complete`,
    timeoutMs: 60_000,
  })
  return {
    launchId: result.row.launchId,
    status: result.row.status,
    controlStreamUrl: options.controlStreamUrl,
    envelope: {
      type: result.envelope?.type,
      key: result.envelope?.key,
    },
    stop: {
      status: result.stop.row?.status,
      envelope: {
        type: result.stop.envelope.type,
        key: result.stop.envelope.key,
      },
    },
    runtime: result.row.runtime,
    session: result.row.startSession,
  }
}
