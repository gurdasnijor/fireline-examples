import {
  createManagedAgentClient,
  type ManagedAgentClient,
  type ManagedAgentFetch,
  type ManagedAgentHeaderProvider,
  type ManagedAgentLaunchHandle,
} from '@fireline/client/managed-agent'

export type ManagedAgentLaunchRow =
  NonNullable<ReturnType<ManagedAgentLaunchHandle['current']>>

type ManagedAgentLaunchRequest = Parameters<ManagedAgentClient['launch']>[0]

export interface ManagedExampleLaunchOptions {
  readonly controlStreamUrl: string
  readonly headers?: ManagedAgentHeaderProvider
  readonly request: ManagedAgentLaunchRequest
  readonly idempotencyKey?: string
  readonly requestedBy: string
  readonly stopReason: string
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

export interface ManagedAgentLaunchOptions {
  readonly controlStreamUrl: string
  readonly headers?: ManagedAgentHeaderProvider
  readonly fetch?: ManagedAgentFetch
  readonly request: ManagedAgentLaunchRequest
  readonly idempotencyKey?: string
  readonly requestedBy: string
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

export interface ManagedAgentLaunchResult {
  readonly handle: ManagedAgentLaunchHandle
  readonly row: ManagedAgentLaunchRow
}

export interface ManagedAgentStopOptions {
  readonly handle: ManagedAgentLaunchHandle
  readonly clientRequestId?: string
  readonly requestedBy: string
  readonly reason?: string
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

export interface ManagedAgentObserveOptions {
  readonly controlStreamUrl: string
  readonly headers?: ManagedAgentHeaderProvider
  readonly fetch?: ManagedAgentFetch
  readonly launchId: string
  readonly requestedBy?: string
  readonly signal?: AbortSignal
}

export interface ManagedAgentStopResult {
  readonly row: ManagedAgentLaunchRow
  readonly stopId: string
}

export async function launchAndStopManagedAgent(
  options: ManagedExampleLaunchOptions,
) {
  const client = createManagedAgentClient({
    launchControlStreamUrl: options.controlStreamUrl,
    headers: options.headers,
    requestedBy: options.requestedBy,
    signal: options.signal,
    defaults: {
      stopReason: options.stopReason,
    },
  })

  const handle = await client.launch(options.request, {
    idempotencyKey: options.idempotencyKey,
    wait: false,
  })

  try {
    const row = await handle.waitUntil('session_ready', {
      timeoutMs: options.timeoutMs ?? 60_000,
      signal: options.signal,
    })
    const stop = await handle.stop({
      clientRequestId: row.clientRequestId,
      reason: options.stopReason,
      wait: {
        until: 'terminal',
        timeoutMs: options.timeoutMs ?? 60_000,
        signal: options.signal,
      },
    })
    return {
      envelope: handle.requestEnvelope,
      row,
      stop,
    }
  } finally {
    handle.close()
    client.close()
  }
}

export async function launchManagedAgent(
  options: ManagedAgentLaunchOptions,
): Promise<ManagedAgentLaunchResult> {
  const client = createManagedAgentClient({
    launchControlStreamUrl: options.controlStreamUrl,
    headers: options.headers,
    fetch: options.fetch,
    signal: options.signal,
    requestedBy: options.requestedBy,
  })
  try {
    const handle = await client.launch(options.request, {
      idempotencyKey: options.idempotencyKey ?? options.request.clientRequestId,
      requestedBy: options.requestedBy,
      wait: {
        until: 'session_ready',
        timeoutMs: options.timeoutMs ?? 60_000,
        signal: options.signal,
      },
    })
    const row = handle.current() ?? await handle.waitUntil('session_ready', {
      timeoutMs: options.timeoutMs ?? 60_000,
      signal: options.signal,
    })
    return { handle, row }
  } catch (error) {
    client.close()
    throw error
  }
}

export async function stopManagedAgent(
  options: ManagedAgentStopOptions,
): Promise<ManagedAgentStopResult> {
  const stop = await options.handle.stop({
    clientRequestId: options.clientRequestId,
    requestedBy: options.requestedBy,
    reason: options.reason,
    wait: {
      until: 'terminal',
      timeoutMs: options.timeoutMs ?? 60_000,
      signal: options.signal,
    },
  })
  if (!stop.row) {
    throw new Error(`Launch ${options.handle.launchId} stop did not reach terminal state`)
  }
  if (stop.row.status === 'failed') {
    throw new Error(stop.row.error?.message ?? `Launch ${stop.row.launchId} failed while stopping`)
  }
  return {
    row: stop.row,
    stopId: stop.envelope.value.stopId,
  }
}

export function observeManagedAgent(
  options: ManagedAgentObserveOptions,
): ManagedAgentLaunchHandle {
  const client = createManagedAgentClient({
    launchControlStreamUrl: options.controlStreamUrl,
    headers: options.headers,
    fetch: options.fetch,
    signal: options.signal,
    requestedBy: options.requestedBy,
  })
  const handle = client.observeLaunch(options.launchId, {
    headers: options.headers,
    fetch: options.fetch,
    signal: options.signal,
  })
  const closeHandle = handle.close.bind(handle)
  return Object.assign(handle, {
    close() {
      closeHandle()
      client.close()
    },
  })
}

export function closeManagedAgentHandle(handle: ManagedAgentLaunchHandle | undefined): void {
  handle?.close()
}
