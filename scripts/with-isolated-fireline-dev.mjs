#!/usr/bin/env node
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const rawArgs = process.argv.slice(2)
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs
const separator = args.indexOf('--')

if (separator === -1 || separator === args.length - 1) {
  usage('expected command after --')
}

const optionArgs = args.slice(0, separator)
const commandArgs = args.slice(separator + 1)

let label = ''
let firelinePort = ''
let streamsPort = ''
let controlStream = ''
let stateDir = ''
let artifactRoot = ''
let reuse = false

for (let index = 0; index < optionArgs.length; index += 1) {
  const arg = optionArgs[index]
  switch (arg) {
    case '--label':
      label = requireValue(arg, optionArgs[++index])
      break
    case '--fireline-port':
      firelinePort = requireValue(arg, optionArgs[++index])
      break
    case '--streams-port':
      streamsPort = requireValue(arg, optionArgs[++index])
      break
    case '--control-stream':
      controlStream = requireValue(arg, optionArgs[++index])
      break
    case '--state-dir':
      stateDir = requireValue(arg, optionArgs[++index])
      break
    case '--artifact-root':
      artifactRoot = requireValue(arg, optionArgs[++index])
      break
    case '--reuse':
      reuse = true
      break
    default:
      usage(`unknown option ${arg}`)
  }
}

if (!label) {
  usage('missing required --label')
}

const safeLabel = label.replace(/[^a-zA-Z0-9._-]+/g, '-')
const artifactDir = resolve(artifactRoot || `/tmp/fireline-mono-v396-${safeLabel}`)
const resolvedStateDir = resolve(stateDir || `${artifactDir}/state`)
const resolvedFirelinePort = firelinePort || process.env.FIRELINE_PORT || '5540'
const resolvedStreamsPort = streamsPort || process.env.FIRELINE_STREAMS_PORT || '8580'
const resolvedControlStream =
  controlStream || process.env.FIRELINE_CONTROL_STREAM || `fireline-v396-${safeLabel}`

if (!reuse) {
  await rm(resolvedStateDir, { recursive: true, force: true })
}
await mkdir(resolvedStateDir, { recursive: true })
await mkdir(artifactDir, { recursive: true })

const env = {
  ...process.env,
  FIRELINE_STATE_DIR: resolvedStateDir,
  FIRELINE_PORT: resolvedFirelinePort,
  FIRELINE_EXAMPLE_ARTIFACT_ROOT: artifactDir,
}

await writeFile(
  `${artifactDir}/env.json`,
  `${JSON.stringify(
    {
      label: safeLabel,
      reuse,
      command: commandArgs,
      FIRELINE_STATE_DIR: env.FIRELINE_STATE_DIR,
      FIRELINE_PORT: env.FIRELINE_PORT,
      FIRELINE_STREAMS_PORT: resolvedStreamsPort,
      FIRELINE_CONTROL_STREAM: resolvedControlStream,
      FIRELINE_ENDPOINT: 'injected by fireline runtime dev',
    },
    null,
    2,
  )}\n`,
)

const fireline = env.FIRELINE_RUNTIME_DEV ?? 'fireline'
const wrapperArgs = [
  'runtime',
  'dev',
  '--port',
  resolvedFirelinePort,
  '--streams-port',
  resolvedStreamsPort,
  '--launch-control-stream',
  resolvedControlStream,
  '--',
  ...commandArgs,
]

console.error(
  [
    `artifactRoot=${artifactDir}`,
    `stateDir=${resolvedStateDir}`,
    `FIRELINE_PORT=${resolvedFirelinePort}`,
    `FIRELINE_STREAMS_PORT=${resolvedStreamsPort}`,
    `FIRELINE_CONTROL_STREAM=${resolvedControlStream}`,
    'FIRELINE_ENDPOINT=<injected by fireline runtime dev>',
  ].join('\n'),
)

const child = spawn(fireline, wrapperArgs, {
  stdio: 'inherit',
  env,
  shell: false,
})

child.on('error', (error) => {
  console.error(`with-isolated-fireline: failed to start ${fireline} runtime dev: ${error.message}`)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

function requireValue(flag, value) {
  if (!value) {
    usage(`missing value for ${flag}`)
  }
  return value
}

function usage(message) {
  if (message) {
    console.error(`with-isolated-fireline: ${message}`)
  }
  console.error(
    [
      'usage:',
      '  pnpm run with:isolated-fireline -- --label <name> [--reuse] [--fireline-port <port>] [--streams-port <port>] [--control-stream <name>] [--state-dir <dir>] [--artifact-root <dir>] -- <command> [args...]',
    ].join('\n'),
  )
  process.exit(1)
}
