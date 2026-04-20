import { readdir, readFile } from 'node:fs/promises'
const root = new URL('..', import.meta.url)
const allowedInternal = new Set([
  '@fireline/client/internal/js-module-runner',
])
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
const violations: string[] = []

for await (const file of walk(root)) {
  if (!isCheckedFile(file)) continue
  const text = await readFile(file, 'utf8')
  const relative = file.replace(root.pathname, '')

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
  }
  for (const specifier of firelineSpecifiers(text)) {
    if (specifier.includes('/internal/') && !allowedInternal.has(specifier)) {
      violations.push(`${relative}: private Fireline subpath ${specifier}`)
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

if (violations.length > 0) {
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log('surface check passed')

async function* walk(dirUrl: URL): AsyncGenerator<string> {
  for (const entry of await readdir(dirUrl, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === 'dist' ||
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
  return /\.(mjs|js|ts|tsx|md|json)$/.test(path)
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
