import { useMemo, useRef, useState } from 'react'
import { connectBrowserAcp, type BrowserAcpSession } from './acp-browser.js'
import {
  createEditableLaunch,
  type BrainPlacement,
  type EditableLaunchResult,
  type FilesystemPlacement,
  type MiddlewareChoice,
} from './fireline.js'

const defaultAgentCode = `export default async function handle(ctx) {
  const textBlock = ctx.prompt.find((block) => block.type === "text")
  const text = textBlock?.text ?? "(no text prompt)"
  await ctx.session.text("Editable agent heard: " + text)
  await ctx.session.complete()
}
`

interface LogEntry {
  readonly at: string
  readonly kind: string
  readonly text: string
}

export function App() {
  const [launchUrl, setLaunchUrl] = useState('http://127.0.0.1:4464/v1/launches')
  const [durableStreamsUrl, setDurableStreamsUrl] = useState('http://127.0.0.1:7501/v1/stream')
  const [brainPlacement, setBrainPlacement] = useState<BrainPlacement>('inline-js-local')
  const [filesystemPlacement, setFilesystemPlacement] = useState<FilesystemPlacement>('local')
  const [middleware, setMiddleware] = useState<readonly MiddlewareChoice[]>(['trace'])
  const [agentCode, setAgentCode] = useState(defaultAgentCode)
  const [initialPrompt, setInitialPrompt] = useState('Say hello from the editable agent.')
  const [chatPrompt, setChatPrompt] = useState('Can you respond to a second prompt?')
  const [result, setResult] = useState<EditableLaunchResult | undefined>()
  const [status, setStatus] = useState('Idle')
  const [logs, setLogs] = useState<readonly LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const acp = useRef<BrowserAcpSession | undefined>(undefined)

  const launch = result?.result
  const acpSessionId = launch?.startSession?.acpSessionId
  const canChat = Boolean(acp.current && acpSessionId && !busy)
  const canStop = Boolean(launch && !busy)
  const coordinates = useMemo(() => launch ? JSON.stringify({
    launchId: launch.launchId,
    status: launch.status,
    waitCoordinates: launch.waitCoordinates,
    launchState: launch.launchState,
    runtime: launch.runtime && {
      runtimeId: launch.runtime.runtimeId,
      acpUrl: launch.runtime.acp.url,
      state: launch.runtime.state,
    },
    startSession: launch.startSession,
  }, null, 2) : 'No launch yet.', [launch])

  async function run() {
    await withBusy(async () => {
      closeAcp()
      setResult(undefined)
      setLogs([])
      addLog('launch', 'Creating launch and waiting for session coordinates.')
      const next = await createEditableLaunch({
        launchUrl,
        durableStreamsUrl,
        agentCode,
        initialPrompt,
        brainPlacement,
        filesystemPlacement,
        middleware,
      })
      setResult(next)
      addLog('launch', `Launch ${next.result.launchId} reached ${next.result.status}.`)
      if (next.result.runtime?.acp.url) {
        acp.current = await connectBrowserAcp({
          url: next.result.runtime.acp.url,
          onUpdate(notification) {
            addLog('session/update', summarizeUpdate(notification))
          },
        })
        addLog('acp', 'Connected to the runtime ACP endpoint.')
      } else {
        addLog('acp', 'No runtime ACP URL returned.')
      }
    }, 'Running')
  }

  async function sendPrompt() {
    if (!acp.current || !acpSessionId) return
    await withBusy(async () => {
      addLog('user', chatPrompt)
      const response = await acp.current!.prompt(acpSessionId, chatPrompt)
      addLog('prompt/result', `stopReason=${response.stopReason}`)
    }, 'Sending prompt')
  }

  async function stop() {
    if (!result) return
    await withBusy(async () => {
      closeAcp()
      const stopped = await result.client.stop({ launch: result.result })
      addLog('stop', `Launch ${stopped.launchId} returned ${stopped.status}.`)
      setResult({ ...result, result: stopped })
    }, 'Stopping')
  }

  async function withBusy(work: () => Promise<void>, label: string) {
    setBusy(true)
    setStatus(label)
    try {
      await work()
      setStatus('Idle')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addLog('error', message)
      setStatus('Error')
    } finally {
      setBusy(false)
    }
  }

  function addLog(kind: string, text: string) {
    setLogs((current) => [...current, {
      at: new Date().toLocaleTimeString(),
      kind,
      text,
    }])
  }

  function closeAcp() {
    acp.current?.close()
    acp.current = undefined
  }

  return (
    <main className="app">
      <section className="workbench">
        <div className="topline">
          <div>
            <p className="eyebrow">Discovery, not canonical</p>
            <h1>Editable Fireline Agent</h1>
          </div>
          <div className="status" aria-live="polite">{status}</div>
        </div>

        <div className="control-grid">
          <label>
            Launch endpoint
            <input value={launchUrl} onChange={(event) => setLaunchUrl(event.target.value)} />
          </label>
          <label>
            Durable streams endpoint
            <input value={durableStreamsUrl} onChange={(event) => setDurableStreamsUrl(event.target.value)} />
          </label>
          <label>
            Brain placement
            <select value={brainPlacement} onChange={(event) => setBrainPlacement(event.target.value as BrainPlacement)}>
              <option value="inline-js-local">Inline JS module, local runtime</option>
              <option disabled>Remote brain placement, not supported in this checkpoint</option>
              <option disabled>Registry ACP agent, separate discovery path</option>
            </select>
          </label>
          <label>
            Hands and filesystem
            <select value={filesystemPlacement} onChange={(event) => setFilesystemPlacement(event.target.value as FilesystemPlacement)}>
              <option value="local">Local filesystem backend</option>
              <option value="streamFs">Stream filesystem backend</option>
              <option disabled>Docker/provider-backed hands, not supported in this checkpoint</option>
              <option disabled>Remote hands placement, not supported in this checkpoint</option>
            </select>
          </label>
        </div>

        <fieldset className="middleware">
          <legend>Middleware</legend>
          <Choice label="Trace" value="trace" selected={middleware} onChange={setMiddleware} />
          <Choice label="Context injection" value="contextInjection" selected={middleware} onChange={setMiddleware} />
          <Choice label="Budget" value="budget" selected={middleware} onChange={setMiddleware} />
          <label className="disabled-choice"><input type="checkbox" disabled /> Approval, webhook, Telegram, memory, secrets, and external tools are logged as unsupported stubs.</label>
        </fieldset>

        <label className="editor-label">
          Agent module
          <textarea className="editor" value={agentCode} onChange={(event) => setAgentCode(event.target.value)} spellCheck={false} />
        </label>

        <div className="prompt-row">
          <label>
            Initial prompt
            <input value={initialPrompt} onChange={(event) => setInitialPrompt(event.target.value)} />
          </label>
          <button type="button" onClick={run} disabled={busy}>Run</button>
        </div>

        <div className="prompt-row">
          <label>
            Chat prompt
            <input value={chatPrompt} onChange={(event) => setChatPrompt(event.target.value)} />
          </label>
          <button type="button" onClick={sendPrompt} disabled={!canChat}>Send</button>
          <button type="button" onClick={stop} disabled={!canStop}>Stop</button>
        </div>
      </section>

      <section className="output">
        <div>
          <h2>Coordinates</h2>
          <pre>{coordinates}</pre>
        </div>
        <div>
          <h2>Session Log</h2>
          <ol className="log">
            {logs.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span>{entry.at}</span>
                <strong>{entry.kind}</strong>
                <p>{entry.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  )
}

function Choice(props: {
  readonly label: string
  readonly value: MiddlewareChoice
  readonly selected: readonly MiddlewareChoice[]
  readonly onChange: (next: readonly MiddlewareChoice[]) => void
}) {
  const checked = props.selected.includes(props.value)
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => props.onChange(checked
          ? props.selected.filter((choice) => choice !== props.value)
          : [...props.selected, props.value])}
      />
      {props.label}
    </label>
  )
}

function summarizeUpdate(notification: unknown): string {
  if (!notification || typeof notification !== 'object') return String(notification)
  const update = 'update' in notification ? notification.update : undefined
  if (!update || typeof update !== 'object') return JSON.stringify(notification)
  const kind = 'sessionUpdate' in update ? String(update.sessionUpdate) : 'update'
  if ('content' in update && update.content && typeof update.content === 'object' && 'text' in update.content) {
    return `${kind}: ${String(update.content.text)}`
  }
  return `${kind}: ${JSON.stringify(update)}`
}
