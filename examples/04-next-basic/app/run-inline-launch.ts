import {
  conductorSpec,
  createLaunchRequest,
  inlineBundleArtifact,
  jsModuleAgentForm,
  textPrompt,
} from '@fireline/client/spec'
import { FirelineLaunchControlClient } from '@fireline/client/launch-control'

export async function runInlineLaunch(options: {
  readonly launchUrl: string
  readonly durableStreamsUrl: string
  readonly prompt: string
  readonly example: string
}) {
  const clientRequestId = `${options.example}-${Date.now()}`
  const client = new FirelineLaunchControlClient({
    launchUrl: options.launchUrl,
    durableStreamsUrl: options.durableStreamsUrl,
    launchStateStream: 'fireline-v3-dev-daemon',
  })
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
  const created = await client.create(createLaunchRequest(spec, {
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
  }), {
    idempotencyKey: clientRequestId,
  })
  const result = created.result ? created : await client.awaitLaunchResult({
    launch: created,
    timeoutMs: 30_000,
  })
  const stopped = await client.stop({ launch: result })
  return {
    launchId: result.launchId,
    status: result.status,
    waitCoordinates: result.waitCoordinates,
    runtime: result.runtime,
    session: result.startSession,
    stopped: stopped.status,
  }
}
