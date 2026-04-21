import { EdgeVM, type EdgeContext } from '@edge-runtime/vm'
import { readFile } from 'node:fs/promises'

type FirelineEdgeContext = EdgeContext & {
  FIRELINE_VERCEL_EDGE_ENV?: Record<string, string | undefined>
}

const bundlePath = new URL('../../../dist/13-vercel-edge-runtime/edge.js', import.meta.url)
const bundle = await readFile(bundlePath, 'utf8')
const vm = new EdgeVM<FirelineEdgeContext>({
  extend(context) {
    const edgeContext = context as FirelineEdgeContext
    edgeContext.FIRELINE_VERCEL_EDGE_ENV = {
      FIRELINE_ENDPOINT: process.env.FIRELINE_ENDPOINT,
      FIRELINE_DURABLE_STREAMS_URL: process.env.FIRELINE_DURABLE_STREAMS_URL,
      FIRELINE_STREAMS_PORT: process.env.FIRELINE_STREAMS_PORT,
      FIRELINE_CONTROL_STREAM: process.env.FIRELINE_CONTROL_STREAM,
      VERCEL_EDGE_TENANT_ID: process.env.VERCEL_EDGE_TENANT_ID,
      VERCEL_EDGE_RUN_ID: process.env.VERCEL_EDGE_RUN_ID,
      VERCEL_EDGE_ATTEMPT_ID: process.env.VERCEL_EDGE_ATTEMPT_ID,
      VERCEL_EDGE_PROMPT: process.env.VERCEL_EDGE_PROMPT,
    }
    return edgeContext
  },
  initialCode: bundle,
})

const response = await vm.dispatchFetch(
  'https://fireline-examples.vercel.app/api/fireline-launch',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId: process.env.VERCEL_EDGE_TENANT_ID ?? 'tenant-vercel-edge',
      runId: process.env.VERCEL_EDGE_RUN_ID ?? `run-${Date.now()}`,
      attemptId: process.env.VERCEL_EDGE_ATTEMPT_ID ?? 'attempt-1',
      prompt: process.env.VERCEL_EDGE_PROMPT ?? 'Run the Vercel Edge Runtime example.',
    }),
  },
)
const text = await response.text()
if (!response.ok) {
  throw new Error(`local Vercel Edge Runtime returned ${response.status}: ${text}`)
}
console.log(text.trim())
