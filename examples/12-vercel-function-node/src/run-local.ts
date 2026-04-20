import { createServer } from 'node:http'
import handler from '../api/fireline-launch.js'

const server = createServer((req, res) => {
  void handler(req, res)
})

await new Promise<void>((resolve) => {
  server.listen(0, '127.0.0.1', resolve)
})

try {
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('expected local server address')
  }
  const response = await fetch(`http://127.0.0.1:${address.port}/api/fireline-launch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId: process.env.VERCEL_FUNCTION_TENANT_ID ?? 'tenant-vercel-node',
      runId: process.env.VERCEL_FUNCTION_RUN_ID ?? `run-${Date.now()}`,
      attemptId: process.env.VERCEL_FUNCTION_ATTEMPT_ID ?? 'attempt-1',
      prompt: process.env.VERCEL_FUNCTION_PROMPT ?? 'Run the Vercel Function Node example.',
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`local Vercel function returned ${response.status}: ${text}`)
  }
  console.log(text.trim())
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}
