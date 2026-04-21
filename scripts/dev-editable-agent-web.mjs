#!/usr/bin/env node
import { spawn } from 'node:child_process'

const args = process.argv.slice(2)
const fireline = process.env.FIRELINE_RUNTIME_DEV ?? 'fireline'
const controlStream = process.env.FIRELINE_CONTROL_STREAM ?? process.env.FIRELINE_DAEMON_STATE_STREAM
const wrapperArgs = ['runtime', 'dev']

if (process.env.FIRELINE_PORT) {
  wrapperArgs.push('--port', process.env.FIRELINE_PORT)
}

if (process.env.FIRELINE_STREAMS_PORT) {
  wrapperArgs.push('--streams-port', process.env.FIRELINE_STREAMS_PORT)
}

if (controlStream) {
  wrapperArgs.push('--launch-control-stream', controlStream)
}

wrapperArgs.push('--', 'pnpm', 'run', 'dev:editable-agent-web:vite', ...args)

const child = spawn(fireline, wrapperArgs, {
  stdio: 'inherit',
  env: process.env,
  shell: false,
})

child.on('error', (error) => {
  console.error(`dev:editable-agent-web: failed to start ${fireline} runtime dev: ${error.message}`)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
