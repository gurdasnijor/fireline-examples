const options = parseArgs(process.argv.slice(2))
const deadline = Date.now() + options.timeoutMs

while (Date.now() < deadline) {
  const rows = await readLaunchRows(options.streamUrl)
  const row = rows
    .filter((candidate) => candidate.launchId === options.launchId)
    .at(-1)

  if (row) {
    if (row.status === 'failed') {
      throw new Error(row.error?.message ?? `Launch ${options.launchId} failed`)
    }
    if (matches(row, options.until)) {
      process.stdout.write(`${JSON.stringify(row, null, 2)}\n`)
      process.exit(0)
    }
  }

  await sleep(options.intervalMs)
}

throw new Error(`Timed out waiting for ${options.launchId} to reach ${options.until}`)

async function readLaunchRows(streamUrl) {
  const response = await fetchWithTimeout(streamUrl, 10_000)
  if (response.status === 404) return []
  if (!response.ok) {
    throw new Error(`GET ${streamUrl} failed with ${response.status}: ${await response.text()}`)
  }
  const text = await response.text()
  return parseValues(text)
    .flatMap(expandDurableStreamValue)
    .filter((event) => event?.type === 'fireline.launch' && event.value)
    .map((event) => event.value)
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

function matches(row, until) {
  switch (until) {
    case 'observed':
      return true
    case 'runtime':
      return Boolean(row.runtime) || ['running', 'session_ready', 'stopping', 'stopped'].includes(row.status)
    case 'session':
      return Boolean(row.startSession) || row.status === 'session_ready' || row.status === 'stopped'
    case 'stopped':
      return row.status === 'stopped'
    default:
      throw new Error(`unsupported --until ${until}`)
  }
}

function parseValues(text) {
  const trimmed = text.trim()
  if (!trimmed) return []
  try {
    return [JSON.parse(trimmed)]
  } catch {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (lines.length > 1) {
      return lines.map((line) => JSON.parse(line))
    }
    return parseConcatenatedJson(trimmed)
  }
}

function parseConcatenatedJson(text) {
  const values = []
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{' || char === '[') {
      if (depth === 0) start = index
      depth += 1
      continue
    }
    if (char === '}' || char === ']') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        values.push(JSON.parse(text.slice(start, index + 1)))
        start = -1
      }
    }
  }

  if (values.length === 0) {
    throw new Error('Durable stream response was not parseable JSON')
  }
  return values
}

function expandDurableStreamValue(value) {
  if (Array.isArray(value)) return value.flatMap(expandDurableStreamValue)
  if (!value || typeof value !== 'object') return []
  if (value.type && value.value) return [value]
  if (Array.isArray(value.events)) return value.events.flatMap(expandDurableStreamValue)
  if (Array.isArray(value.entries)) return value.entries.flatMap(expandDurableStreamValue)
  if (Array.isArray(value.items)) return value.items.flatMap(expandDurableStreamValue)
  if (Array.isArray(value.chunks)) return value.chunks.flatMap(expandDurableStreamValue)
  if (typeof value.data === 'string') return parseValues(value.data).flatMap(expandDurableStreamValue)
  if (Array.isArray(value.data)) return value.data.flatMap(expandDurableStreamValue)
  return []
}

function parseArgs(args) {
  const values = new Map()
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index]
    const value = args[index + 1]
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error('usage: node observe-launches.mjs --stream-url URL --launch-id ID --until observed|runtime|session|stopped [--timeout-ms N]')
    }
    values.set(key.slice(2), value)
    index += 1
  }
  return {
    streamUrl: required(values, 'stream-url'),
    launchId: required(values, 'launch-id'),
    until: values.get('until') ?? 'observed',
    timeoutMs: positiveInt(values.get('timeout-ms') ?? '60000', 'timeout-ms'),
    intervalMs: positiveInt(values.get('interval-ms') ?? '250', 'interval-ms'),
  }
}

function required(values, key) {
  const value = values.get(key)
  if (!value) throw new Error(`--${key} is required`)
  return value
}

function positiveInt(value, label) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${label} must be a positive integer`)
  }
  return parsed
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
