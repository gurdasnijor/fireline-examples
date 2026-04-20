import { createDemoServerConfig, renderSummary } from './framework-boundary.js'
import { createServerWorkerWrapper } from './server-worker-wrapper.js'

const demo = createDemoServerConfig(process.env)
const wrapper = createServerWorkerWrapper({
  env: process.env,
  authToken: demo.authToken,
})

const launch = await wrapper.submitLaunch({
  authorization: `Bearer ${demo.authToken}`,
  actor: demo.actor,
  intent: demo.intent,
})

console.log(renderSummary(launch.summary))
