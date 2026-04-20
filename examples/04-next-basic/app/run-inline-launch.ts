import {
  conductorSpec,
  createLaunchRequest,
  inlineBundleArtifact,
  jsModuleAgentForm,
  textPrompt,
} from '@fireline/client/spec'
import { appendAndObserveLaunch } from '../../shared/stream-launch'

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
  const spec = conductorSpec({
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
  const request = createLaunchRequest(spec, {
    clientRequestId,
    runtime: {
      name: options.example,
      provider: 'local',
    },
    startSession: {
      create: true,
      stateStream: clientRequestId,
      newSession: {
        cwd: '/',
        mcpServers: [],
      },
      prompt: textPrompt(options.prompt),
    },
    wait: {
      until: 'session',
      timeoutMs: 30_000,
    },
  })
  const result = await appendAndObserveLaunch({
    controlStreamUrl: options.controlStreamUrl,
    request,
    idempotencyKey: clientRequestId,
    requestedBy: `examples/${options.example}`,
    timeoutMs: 30_000,
  })
  result.db.close()
  return {
    launchId: result.row.launchId,
    status: result.row.status,
    controlStreamUrl: options.controlStreamUrl,
    envelope: {
      type: result.envelope.type,
      key: result.envelope.key,
    },
    runtime: result.row.runtime,
    session: result.row.startSession,
  }
}
