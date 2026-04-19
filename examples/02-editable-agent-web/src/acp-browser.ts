import {
  ClientSideConnection,
  PROTOCOL_VERSION,
  type Client,
  type PromptResponse,
  type SessionNotification,
  type Stream,
} from '@fireline/client/acp'

export interface BrowserAcpSession {
  readonly prompt: (sessionId: string, text: string) => Promise<PromptResponse>
  readonly close: () => void
}

export async function connectBrowserAcp(options: {
  readonly url: string
  readonly onUpdate: (notification: SessionNotification) => void
}): Promise<BrowserAcpSession> {
  const socket = new WebSocket(options.url)
  await waitForOpen(socket)

  const connection = new ClientSideConnection((): Client => ({
    async requestPermission() {
      return { outcome: { outcome: 'cancelled' } }
    },
    async sessionUpdate(notification) {
      options.onUpdate(notification)
    },
  }), websocketStream(socket))

  await connection.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientInfo: {
      name: 'fireline-examples-editable-agent-web',
      version: '0.0.0',
    },
    clientCapabilities: {
      fs: {
        readTextFile: false,
        writeTextFile: false,
      },
    },
  })

  return {
    prompt(sessionId, text) {
      return connection.prompt({
        sessionId,
        prompt: [{ type: 'text', text }],
      })
    },
    close() {
      socket.close()
    },
  }
}

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve()
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(new Error('ACP WebSocket failed to open')), { once: true })
  })
}

function websocketStream(socket: WebSocket): Stream {
  let closed = false
  let readableClosed = false
  const closeReadable = (controller: ReadableStreamDefaultController<unknown>) => {
    if (readableClosed) return
    readableClosed = true
    try {
      controller.close()
    } catch {
      // Some WebSocket implementations can deliver close after the stream is
      // already errored or cancelled.
    }
  }
  return {
    readable: new ReadableStream({
      start(controller) {
        socket.addEventListener('message', async (event) => {
          try {
            controller.enqueue(JSON.parse(await messageText(event.data)))
          } catch (error) {
            readableClosed = true
            controller.error(error)
          }
        })
        socket.addEventListener('close', () => {
          closed = true
          closeReadable(controller)
        }, { once: true })
        socket.addEventListener('error', () => {
          readableClosed = true
          controller.error(new Error('ACP WebSocket stream error'))
        }, { once: true })
      },
      cancel() {
        readableClosed = true
      },
    }),
    writable: new WritableStream({
      write(message) {
        if (socket.readyState !== WebSocket.OPEN) {
          throw new Error('ACP WebSocket is not open')
        }
        socket.send(JSON.stringify(message))
      },
      close() {
        if (!closed) socket.close()
      },
      abort() {
        if (!closed) socket.close()
      },
    }),
  }
}

async function messageText(data: unknown): Promise<string> {
  if (typeof data === 'string') return data
  if (data instanceof Blob) return data.text()
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data)
  throw new Error('Unsupported ACP WebSocket message type')
}
