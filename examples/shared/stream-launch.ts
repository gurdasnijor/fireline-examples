import {
  appendLaunchRequest,
  appendLaunchStop,
  type LaunchRequestEnvelope,
  type LaunchStopEnvelope,
} from '@fireline/client/events'
import type { CreateLaunchRequest } from '@fireline/client/spec'
import { createFirelineDB, type FirelineDB, type LaunchRow } from '@fireline/state'

export interface StreamLaunchOptions<Name extends string = string> {
  readonly controlStreamUrl: string
  readonly headers?: Readonly<Record<string, string>>
  readonly request: CreateLaunchRequest<Name>
  readonly idempotencyKey?: string
  readonly requestedBy: string
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

export interface StreamLaunchResult<Name extends string = string> {
  readonly envelope: LaunchRequestEnvelope<Name>
  readonly row: LaunchRow
  readonly db: FirelineDB
}

export interface StreamLaunchStopOptions {
  readonly controlStreamUrl: string
  readonly headers?: Readonly<Record<string, string>>
  readonly launchId: string
  readonly clientRequestId?: string
  readonly requestedBy: string
  readonly reason?: string
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

export interface StreamLaunchStopResult {
  readonly envelope: LaunchStopEnvelope
  readonly row: LaunchRow
}

export async function appendAndObserveLaunch<Name extends string = string>(
  options: StreamLaunchOptions<Name>,
): Promise<StreamLaunchResult<Name>> {
  const envelope = await appendLaunchRequest({
    streamUrl: options.controlStreamUrl,
    headers: options.headers,
    request: options.request,
    idempotencyKey: options.idempotencyKey,
    requestedBy: options.requestedBy,
  })
  const row = await waitForLaunchRowSnapshot({
    stateStreamUrl: options.controlStreamUrl,
    headers: options.headers,
    launchId: envelope.value.launchId,
    timeoutMs: options.timeoutMs ?? 30_000,
    signal: options.signal,
    predicate: (candidate) => {
      if (candidate.status === 'failed' || candidate.status === 'stopped') return true
      return Boolean(candidate.runtime && candidate.startSession)
    },
  })
  if (row.status === 'failed') {
    throw new Error(row.error?.message ?? `Launch ${row.launchId} failed`)
  }
  const db = createFirelineDB({
    stateStreamUrl: options.controlStreamUrl,
    headers: options.headers ? { ...options.headers } : undefined,
    signal: options.signal,
  })
  try {
    await db.preload()
    return { envelope, row, db }
  } catch (error) {
    db.close()
    throw error
  }
}

export async function appendAndObserveLaunchStop(
  options: StreamLaunchStopOptions,
): Promise<StreamLaunchStopResult> {
  const envelope = await appendLaunchStop({
    streamUrl: options.controlStreamUrl,
    headers: options.headers,
    launchId: options.launchId,
    clientRequestId: options.clientRequestId,
    requestedBy: options.requestedBy,
    reason: options.reason,
  })
  const row = await waitForLaunchRowSnapshot({
    stateStreamUrl: options.controlStreamUrl,
    headers: options.headers,
    launchId: options.launchId,
    timeoutMs: options.timeoutMs ?? 30_000,
    signal: options.signal,
    predicate: (candidate) => candidate.status === 'stopped' || candidate.status === 'failed',
  })
  if (row.status === 'failed') {
    throw new Error(row.error?.message ?? `Launch ${row.launchId} failed while stopping`)
  }
  return { envelope, row }
}

async function waitForLaunchRowSnapshot(options: {
  readonly stateStreamUrl: string
  readonly headers?: Readonly<Record<string, string>>
  readonly launchId: string
  readonly timeoutMs: number
  readonly predicate: (row: LaunchRow) => boolean
  readonly signal?: AbortSignal
}): Promise<LaunchRow> {
  const deadline = Date.now() + options.timeoutMs
  while (Date.now() < deadline) {
    if (options.signal?.aborted) throw abortError()
    const db = createFirelineDB({
      stateStreamUrl: options.stateStreamUrl,
      headers: options.headers ? { ...options.headers } : undefined,
      signal: options.signal,
    })
    try {
      await db.preload()
      const row = findMatchingLaunch(db, options.launchId, options.predicate)
      if (row) return row
    } finally {
      db.close()
    }
    await sleep(250, options.signal)
  }
  throw new Error(`Timed out waiting for launch ${options.launchId}`)
}

export async function waitForLaunchRow(options: {
  readonly db: FirelineDB
  readonly launchId: string
  readonly timeoutMs: number
  readonly predicate: (row: LaunchRow) => boolean
  readonly signal?: AbortSignal
}): Promise<LaunchRow> {
  const existing = findMatchingLaunch(options.db, options.launchId, options.predicate)
  if (existing) return existing

  return await new Promise((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out waiting for launch ${options.launchId}`))
    }, options.timeoutMs)
    const abort = () => {
      cleanup()
      reject(abortError())
    }
    let subscription: { unsubscribe(): void } | undefined
    const poll = setInterval(() => {
      void options.db.preload()
        .then(() => {
          const row = findMatchingLaunch(options.db, options.launchId, options.predicate)
          if (!row) return
          cleanup()
          resolve(row)
        })
        .catch((error) => {
          cleanup()
          reject(error)
        })
    }, 250)
    const cleanup = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(poll)
      subscription?.unsubscribe()
      options.signal?.removeEventListener('abort', abort)
    }
    subscription = options.db.collections.launches.subscribe((rows) => {
      const row = rows.find((candidate) =>
        candidate.launchId === options.launchId && options.predicate(candidate)
      )
      if (!row) return
      cleanup()
      resolve(row)
    })

    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
  })
}

function findMatchingLaunch(
  db: FirelineDB,
  launchId: string,
  predicate: (row: LaunchRow) => boolean,
): LaunchRow | undefined {
  return db.collections.launches.toArray.find((row) =>
    row.launchId === launchId && predicate(row)
  )
}

function abortError(): Error {
  const error = new Error('Launch observation aborted')
  error.name = 'AbortError'
  return error
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    const abort = () => {
      clearTimeout(timeout)
      cleanup()
      reject(abortError())
    }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
  })
}
