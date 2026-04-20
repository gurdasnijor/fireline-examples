import { inlineJsBundleAgent } from '@fireline/client/managed-agent'
import type { FlamecastComposition } from './framework-boundary.js'

export interface GeneratedHarnessOptions {
  readonly revision: string
  readonly composition: FlamecastComposition
}

export async function createGeneratedHarnessAgent(options: GeneratedHarnessOptions) {
  return await inlineJsBundleAgent({
    entrypoint: 'adapter-entry.mjs',
    files: [
      {
        path: 'adapter-entry.mjs',
        mediaType: 'text/javascript',
        content: adapterEntrySource(),
      },
      {
        path: 'runtime-shim.mjs',
        mediaType: 'text/javascript',
        content: runtimeShimSource(),
      },
      {
        path: 'user-harness.mjs',
        mediaType: 'text/javascript',
        content: userHarnessSource(options.composition),
      },
      {
        path: 'framework-boundary.mjs',
        mediaType: 'text/javascript',
        content: frameworkBoundarySource(),
      },
    ],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: 'examples/06-flamecast-v3-shaped/generated-harness',
      revision: options.revision,
    },
  })
}

function adapterEntrySource(): string {
  return `
import { createRuntimeContext } from './runtime-shim.mjs'
import { createCompositionHarness } from './user-harness.mjs'
import { normalizePrompt } from './framework-boundary.mjs'

export default async function handle(ctx) {
  const runtime = createRuntimeContext(ctx)
  const harness = createCompositionHarness(runtime)
  const prompt = normalizePrompt(ctx.prompt)
  const result = await harness.handlePrompt(prompt)
  await ctx.session.text(result.text)
  if (result.complete) {
    await ctx.session.complete()
  }
}
`.trimStart()
}

function runtimeShimSource(): string {
  return `
export function createRuntimeContext(ctx) {
  return {
    workspaceId: process.env.FLAMECAST_WORKSPACE_ID ?? 'unknown-workspace',
    sceneCount: Number.parseInt(process.env.FLAMECAST_SCENE_COUNT ?? '0', 10),
    tone: process.env.FLAMECAST_TONE ?? 'brief',
    writeEvent(message) {
      return ctx.session.text('[flamecast-runtime] ' + message)
    },
  }
}
`.trimStart()
}

function userHarnessSource(composition: FlamecastComposition): string {
  return `
export function createCompositionHarness(runtime) {
  const composition = ${JSON.stringify(composition, null, 2)}
  return {
    async handlePrompt(prompt) {
      const shouldComplete = /complete|final/i.test(prompt)
      await runtime.writeEvent('workspace=' + runtime.workspaceId)
      return {
        complete: shouldComplete,
        text: [
          'title=' + composition.title,
          'scenes=' + composition.sceneCount,
          'tone=' + composition.tone,
          'prompt=' + prompt,
          shouldComplete ? 'status=complete' : 'status=ready',
        ].join('\\n'),
      }
    },
  }
}
`.trimStart()
}

function frameworkBoundarySource(): string {
  return `
export function normalizePrompt(prompt) {
  if (!Array.isArray(prompt)) return ''
  return prompt.map((part) => {
    if (part && part.type === 'text') return part.text
    return ''
  }).join('\\n').trim()
}
`.trimStart()
}
