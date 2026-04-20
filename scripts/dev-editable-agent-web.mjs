#!/usr/bin/env node
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const firelineV3Dev = process.env.FIRELINE_V3_DEV ?? 'fireline-v3-dev'
const controlStream = process.env.FIRELINE_CONTROL_STREAM ?? process.env.FIRELINE_DAEMON_STATE_STREAM
const wrapperArgs = []

if (controlStream) {
  wrapperArgs.push('--state-stream', controlStream)
}

wrapperArgs.push('--', 'pnpm', 'run', 'dev:editable-agent-web:vite', ...args)

const child = spawn(firelineV3Dev, wrapperArgs, {
  stdio: 'inherit',
  env: process.env,
  shell: false,
})

child.on('error', (error) => {
  console.error(`dev:editable-agent-web: failed to start ${firelineV3Dev}: ${error.message}`)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
