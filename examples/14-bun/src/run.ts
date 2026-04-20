import { handleBunLaunchRequest } from './launch.js'

const response = await handleBunLaunchRequest(new Request('http://127.0.0.1/api/fireline-launch', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    tenantId: process.env.BUN_EXAMPLE_TENANT_ID,
    runId: process.env.BUN_EXAMPLE_RUN_ID,
    attemptId: process.env.BUN_EXAMPLE_ATTEMPT_ID,
    prompt: process.env.BUN_EXAMPLE_PROMPT,
  }),
}))

const text = await response.text()
console.log(text)

if (!response.ok) {
  process.exitCode = 1
}
