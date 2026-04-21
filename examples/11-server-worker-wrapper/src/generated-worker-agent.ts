import { acp } from '@fireline/client/managed-agent'
import type { AppLaunchIntent } from './framework-boundary.js'

export async function createWorkerAgentBundle(options: {
  readonly revision: string
  readonly intent: AppLaunchIntent
}) {
  return await acp.inlineJsBundle({
    entrypoint: 'worker-entry.mjs',
    files: [
      {
        path: 'worker-entry.mjs',
        mediaType: 'text/javascript',
        content: workerEntrySource(),
      },
      {
        path: 'tenant-policy.mjs',
        mediaType: 'text/javascript',
        content: tenantPolicySource(options.intent),
      },
    ],
    provenance: {
      producer: 'fireline-examples-discovery',
      source: 'examples/11-server-worker-wrapper/generated-worker-agent',
      revision: options.revision,
    },
  })
}

function workerEntrySource(): string {
  return `
import { describeTenantRun } from './tenant-policy.mjs'

export default async function handle(ctx) {
  const result = describeTenantRun(ctx.prompt)
  await ctx.session.text(result)
  await ctx.session.complete()
}
`.trimStart()
}

function tenantPolicySource(intent: AppLaunchIntent): string {
  return `
export function describeTenantRun(prompt) {
  const intent = ${JSON.stringify(intent, null, 2)}
  return [
    'tenant=' + intent.tenantId,
    'document=' + intent.documentId,
    'run=' + intent.runId,
    'attempt=' + intent.attemptId,
    'title=' + intent.title,
    'prompt=' + normalizePrompt(prompt),
    'status=complete',
  ].join('\\n')
}

function normalizePrompt(prompt) {
  if (!Array.isArray(prompt)) return ''
  return prompt.map((part) => {
    if (part && part.type === 'text') return part.text
    return ''
  }).join('\\n').trim()
}
`.trimStart()
}
