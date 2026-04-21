import {
  Agent,
  Fireline,
  acp,
} from '@fireline/client/managed-agent'

interface RunInlineFirelineOptions {
  readonly endpoint: string
  readonly prompt: string
  readonly example: string
  readonly responsePrefix: string
}

export async function runInlineFireline(options: RunInlineFirelineOptions) {
  const clientRequestId = `${options.example}-${Date.now()}`
  const fireline = new Fireline({
    endpoint: options.endpoint,
    requestedBy: `examples/${options.example}`,
  })

  try {
    const agent = new Agent({
      id: options.example,
      entrypoint: await acp.inlineJsBundle({
        entrypoint: 'agent.mjs',
        files: [{
          path: 'agent.mjs',
          mediaType: 'text/javascript',
          content: `export default async function handle(ctx) {
  const text = ctx.prompt.find((block) => block.type === "text")?.text ?? ""
  await ctx.session.text(${JSON.stringify(options.responsePrefix)} + text)
  await ctx.session.complete()
}
`,
        }],
        provenance: {
          producer: 'fireline-examples-discovery',
          source: options.example,
          revision: clientRequestId,
        },
      }),
      sandbox: {
        provider: 'local',
        fsBackend: 'local',
        labels: {
          example: options.example,
          mode: 'discovery',
          tier: 'managed-agent',
        },
      },
    })

    const result = await fireline.run(agent, {
      prompt: options.prompt,
      cwd: '/',
      idempotencyKey: clientRequestId,
      requestedBy: `examples/${options.example}`,
    })

    return {
      endpoint: options.endpoint,
      launchId: result.launchId,
      sessionId: result.sessionId,
      stopReason: result.stopReason,
      response: result.response,
    }
  } finally {
    fireline.close()
  }
}
