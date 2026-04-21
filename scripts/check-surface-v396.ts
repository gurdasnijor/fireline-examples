import { access, readdir, readFile } from 'node:fs/promises'

const root = new URL('..', import.meta.url)

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
] as const

const bridgeNameBans = [
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

const managedAgentSpecifier = '@fireline/client/managed-agent'
const violations: string[] = []
const skippedDirs: string[] = []

for (const exampleDir of tier1Examples) {
  if (!(await exists(new URL(exampleDir, root)))) {
    skippedDirs.push(exampleDir)
    continue
  }
  const files = await collectCheckedFiles(new URL(exampleDir, root))
  let aggregate = ''
  let sawManagedAgentImport = false

  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const relative = file.replace(root.pathname, '')
    aggregate += `\n${text}`

    for (const bridgeName of bridgeNameBans) {
      if (text.includes(bridgeName)) {
        violations.push(`${relative}: future Tier 1 example must not use bridge helper ${bridgeName}`)
      }
    }

    for (const specifier of importSpecifiers(text)) {
      if (specifier === managedAgentSpecifier) {
        sawManagedAgentImport = true
      }
      if (tier3SpecifierBans.includes(specifier as (typeof tier3SpecifierBans)[number])) {
        violations.push(`${relative}: future Tier 1 example must not import Tier 3 escape hatch ${specifier}`)
      }
      if (sharedHelperBans.includes(specifier as (typeof sharedHelperBans)[number])) {
        violations.push(`${relative}: future Tier 1 example must not use shared/stream-launch`)
      }
    }
  }

  if (!sawManagedAgentImport) {
    violations.push(`${exampleDir}: future Tier 1 example must import ${managedAgentSpecifier}`)
  }

  if (!aggregate.includes('new Fireline(')) {
    violations.push(`${exampleDir}: future Tier 1 example must construct new Fireline({ endpoint })`)
  }
  if (!aggregate.includes('new Agent(')) {
    violations.push(`${exampleDir}: future Tier 1 example must construct new Agent(...)`)
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
  if (!(await exists(new URL(exampleDir, root)))) {
    skippedDirs.push(exampleDir)
    continue
  }
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

if (skippedDirs.length > 0) {
  console.error(`skipped missing example directories: ${skippedDirs.join(', ')}`)
}

console.log('v396 surface check passed')

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
    ) {
      continue
    }

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
  return /\.(mjs|js|ts|tsx)$/.test(path)
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

async function exists(url: URL): Promise<boolean> {
  try {
    await access(url)
    return true
  } catch {
    return false
  }
}
