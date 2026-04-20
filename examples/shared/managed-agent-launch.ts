import {
  createManagedAgentClient,
  type ManagedAgentHeaderProvider,
} from '@fireline/client/managed-agent'
import type { CreateLaunchRequest } from '@fireline/client/spec'

export interface ManagedExampleLaunchOptions<Name extends string = string> {
  readonly controlStreamUrl: string
  readonly headers?: ManagedAgentHeaderProvider
  readonly request: CreateLaunchRequest<Name>
  readonly idempotencyKey?: string
  readonly requestedBy: string
  readonly stopReason: string
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

export async function launchAndStopManagedAgent<Name extends string = string>(
  options: ManagedExampleLaunchOptions<Name>,
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
