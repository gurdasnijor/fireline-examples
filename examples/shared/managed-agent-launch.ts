import {
  createManagedAgentClient,
  type ManagedAgentClient,
  type ManagedAgentHeaderProvider,
} from '@fireline/client/managed-agent'

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
