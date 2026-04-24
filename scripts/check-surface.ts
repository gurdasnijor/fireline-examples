import { readdir, readFile } from 'node:fs/promises'

const root = new URL('..', import.meta.url)

const targetExampleBans = [
  {
    pattern: /@fireline\/client\/launch-control/,
    message: 'target examples must not import @fireline/client/launch-control',
  },
  {
    pattern: /\/v1\/launches/,
    message: 'target examples must not use the HTTP launch endpoint',
  },
  {
    pattern: /FIRELINE_LAUNCH_URL/,
    message: 'target examples must not use FIRELINE_LAUNCH_URL',
  },
] as const

const tier2Examples = [
  'examples/07-curl-shell-raw-http/',
  'examples/09-python-raw-http/',
  'examples/10-rust-raw-http/',
  'examples/15-go-raw-http/',
] as const

const tier1Examples = [
  'examples/01-inline-js-local/',
  'examples/02-editable-agent-web/',
  'examples/03-tanstack-shaped-app/',
  'examples/04-next-basic/',
  'examples/05-next-open-cloudflare/',
  'examples/06-flamecast-v3-shaped/',
  'examples/08-cloudflare-worker-direct/',
  'examples/11-server-worker-wrapper/',
  'examples/12-vercel-function-node/',
  'examples/13-vercel-edge-runtime/',
  'examples/14-bun/',
  'examples/16-deno/',
  'examples/17-acp-registry-chat/',
  'examples/18-middleware-stack/',
  'examples/19-tanstack-planner-team-demo/',
] as const

const tier3EscapeHatchExamples = [] as const

const normalPathVocabularyBans = [
  'createManagedAgentClient',
  'createManagedAgentLaunchRequest',
  'launchAgent(',
  'launchAgent<',
  'ManagedAgentLaunchHandle',
  'launchControlStreamUrl',
] as const

const tier3SpecifierBans = [
  '@fireline/client/spec',
  '@fireline/client/events',
  '@fireline/client/acp-browser',
  '@fireline/state',
] as const

const sharedHelperBans = [
  '../shared/stream-launch',
  '../shared/stream-launch.js',
  '../../shared/stream-launch',
  '../../shared/stream-launch.js',
  '../shared/managed-agent-launch',
  '../shared/managed-agent-launch.js',
  '../../shared/managed-agent-launch',
  '../../shared/managed-agent-launch.js',
  '../shared/run-inline-fireline',
  '../shared/run-inline-fireline.js',
  '../../shared/run-inline-fireline',
  '../../shared/run-inline-fireline.js',
] as const

const staleSurfaceBans = [
  'fireline-v3-dev',
  'FIRELINE_V3_DEV',
  '--state-stream',
  'VITE_FIRELINE_STREAMS_PORT',
  'VITE_FIRELINE_CONTROL_STREAM',
] as const

const managedAgentSpecifier = '@fireline/client/managed-agent'
const managedAgentLifecycleBans = new Set([
  '@fireline/client/events',
  '@fireline/client/acp-browser',
  '@fireline/state',
])
const violations: string[] = []

for await (const file of walk(root)) {
  if (!isCheckedFile(file)) continue
  const text = await readFile(file, 'utf8')
  const relative = file.replace(root.pathname, '')

  if (!relative.startsWith('scripts/check-surface')) {
    for (const stale of staleSurfaceBans) {
      if (text.includes(stale)) {
        violations.push(`${relative}: stale Fireline dev surface ${stale}`)
      }
    }
  }

  for (const specifier of importSpecifiers(text)) {
    if (specifier.includes('../fireline') || specifier.includes('..\\/fireline')) {
      violations.push(`${relative}: must not import from ../fireline`)
    }
    if (/packages\/[^'"\s]+\/src/.test(specifier)) {
      violations.push(`${relative}: must not import Fireline package src paths`)
    }
    if (specifier.includes('flamecast-v3')) {
      violations.push(`${relative}: must not import real flamecast-v3 modules`)
    }
    if (
      relative.startsWith('examples/08-cloudflare-worker-direct/') ||
      relative === 'examples/13-vercel-edge-runtime/src/edge.ts' ||
      relative === 'examples/16-deno/main.ts'
    ) {
      if (isNodeBuiltinSpecifier(specifier)) {
        violations.push(`${relative}: Worker/Edge handler must not import Node builtin ${specifier}`)
      }
      if (specifier === 'next' || specifier.includes('@opennextjs/')) {
        violations.push(`${relative}: Worker/Edge handler must not import Next/OpenNext`)
      }
    }
  }

  for (const specifier of firelineSpecifiers(text)) {
    if (specifier.includes('/internal/')) {
      violations.push(`${relative}: private Fireline subpath ${specifier}`)
    }
    if (
      isTier3EscapeHatchExample(relative) &&
      managedAgentLifecycleBans.has(specifier)
    ) {
      violations.push(
        `${relative}: Tier 3 escape-hatch examples should not use direct lifecycle subpath ${specifier}`,
      )
    }
    if (
      relative.startsWith('examples/') &&
      specifier === '@fireline/client' &&
      /import\s*{[^}]*\b(createManagedAgentClient|createManagedAgentLaunchRequest|launchAgent|ManagedAgent[A-Za-z]*|Fireline|Agent)\b[^}]*}\s*from\s+['"]@fireline\/client['"]/s.test(text)
    ) {
      violations.push(`${relative}: managed-agent helpers must import @fireline/client/managed-agent, not the root barrel`)
    }
  }

  if (relative.startsWith('examples/')) {
    for (const ban of targetExampleBans) {
      if (ban.pattern.test(text)) {
        violations.push(`${relative}: ${ban.message}`)
      }
    }
  }
}

for (const exampleDir of tier1Examples) {
  const files = await collectCheckedFiles(new URL(exampleDir, root))
  let aggregate = ''
  let sawManagedAgentImport = false

  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const relative = file.replace(root.pathname, '')
    aggregate += `\n${text}`

    for (const bridgeName of normalPathVocabularyBans) {
      if (text.includes(bridgeName)) {
        violations.push(`${relative}: Tier 1 example must not use bridge vocabulary ${bridgeName}`)
      }
    }

    for (const specifier of importSpecifiers(text)) {
      if (specifier === managedAgentSpecifier) {
        sawManagedAgentImport = true
      }
      if (tier3SpecifierBans.includes(specifier as (typeof tier3SpecifierBans)[number])) {
        violations.push(`${relative}: current Tier 1 example must not import Tier 3 escape hatch ${specifier}`)
      }
      if (sharedHelperBans.includes(specifier as (typeof sharedHelperBans)[number])) {
        violations.push(`${relative}: current Tier 1 example must not use shared lifecycle helper ${specifier}`)
      }
    }
  }

  if (!sawManagedAgentImport) {
    violations.push(`${exampleDir}: Tier 1 example must import ${managedAgentSpecifier}`)
  }

  if (!aggregate.includes('new Fireline(')) {
    violations.push(`${exampleDir}: Tier 1 example must construct new Fireline({ endpoint })`)
  }
  if (!aggregate.includes('new Agent(')) {
    violations.push(`${exampleDir}: Tier 1 example must construct new Agent(...)`)
  }
  const hasRunFlow = aggregate.includes('.run(')
  const hasSessionFlow = aggregate.includes('.session(') &&
    aggregate.includes('.stop(')
  if (!hasRunFlow && !hasSessionFlow) {
    violations.push(
      `${exampleDir}: Tier 1 example must use fireline.run(...) or fireline.session(...) with session.stop(...)`,
    )
  }
}

for (const exampleDir of tier2Examples) {
  const files = await collectCheckedFiles(new URL(exampleDir, root))
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const relative = file.replace(root.pathname, '')
    if (text.includes(managedAgentSpecifier)) {
      violations.push(`${relative}: Tier 2 example should remain protocol/raw and must not import managed-agent`)
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log('surface check passed')

async function collectCheckedFiles(dirUrl: URL): Promise<string[]> {
  const files: string[] = []
  for await (const file of walk(dirUrl)) {
    if (isCheckedFile(file)) {
      files.push(file)
    }
  }
  return files
}

async function* walk(dirUrl: URL): AsyncGenerator<string> {
  for (const entry of await readdir(dirUrl, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
      entry.name === 'target' ||
      entry.name === '.next' ||
      entry.name === '.open-next'
    ) continue
    const child = new URL(entry.name, dirUrl)
    if (entry.isDirectory()) {
      yield* walk(new URL(`${entry.name}/`, dirUrl))
      continue
    }
    if (entry.isFile()) {
      yield child.pathname
    }
  }
}

function isCheckedFile(path: string): boolean {
  return /\.(mjs|js|ts|tsx|rs|go|md|json|toml)$/.test(path)
}

function* importSpecifiers(text: string): Generator<string> {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      yield match[1]
    }
  }
}

function* firelineSpecifiers(text: string): Generator<string> {
  const pattern = /['"](@fireline\/[^'"]+)['"]/g
  let match
  while ((match = pattern.exec(text)) !== null) {
    yield match[1]
  }
}

function isNodeBuiltinSpecifier(specifier: string): boolean {
  const bare = specifier.replace(/^node:/, '')
  return [
    'assert',
    'buffer',
    'child_process',
    'crypto',
    'fs',
    'http',
    'https',
    'net',
    'os',
    'path',
    'process',
    'stream',
    'tls',
    'url',
    'util',
    'zlib',
  ].includes(bare)
}

function isTier3EscapeHatchExample(relative: string): boolean {
  return tier3EscapeHatchExamples.some((prefix) => relative.startsWith(prefix))
}
