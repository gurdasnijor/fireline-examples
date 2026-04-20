import { appendLaunchRequest, type LaunchRequestEnvelope } from '@fireline/client/events'
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
  const db = createFirelineDB({
    stateStreamUrl: options.controlStreamUrl,
    headers: options.headers ? { ...options.headers } : undefined,
    signal: options.signal,
  })
  try {
    await db.preload()
    const row = await waitForLaunchRow({
      db,
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
    return { envelope, row, db }
  } catch (error) {
    db.close()
    throw error
  }
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
    const subscription = options.db.collections.launches.subscribe((rows) => {
      const row = rows.find((candidate) =>
        matchesLaunchId(candidate, options.launchId) && options.predicate(candidate)
      )
      if (!row) return
      cleanup()
      resolve(row)
    })
    const cleanup = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(poll)
      subscription.unsubscribe()
      options.signal?.removeEventListener('abort', abort)
    }

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
    matchesLaunchId(row, launchId) && predicate(row)
  )
}

function matchesLaunchId(row: LaunchRow, launchId: string): boolean {
  return row.launchId === launchId || row.launchId === `launch:${launchId}`
}

function abortError(): Error {
  const error = new Error('Launch observation aborted')
  error.name = 'AbortError'
  return error
}
