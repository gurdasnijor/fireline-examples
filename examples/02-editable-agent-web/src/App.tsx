import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createEditableLaunch,
  stopEditableLaunch,
  type BrainPlacement,
  type EditableLaunchResult,
  type EditableSessionSnapshot,
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

const defaultEndpoint = envValue(import.meta.env.VITE_FIRELINE_ENDPOINT) ?? ''
const localDevCommand = 'pnpm run dev:editable-agent-web'

interface LogEntry {
  readonly at: string
  readonly kind: string
  readonly text: string
}

export function App() {
  const [endpoint, setEndpoint] = useState(defaultEndpoint)
  const [daemonStatus, setDaemonStatus] = useState('Checking Fireline endpoint...')
  const [recoveryHint, setRecoveryHint] = useState<string | undefined>()
  const [brainPlacement, setBrainPlacement] = useState<BrainPlacement>('inline-js-local')
  const [filesystemPlacement, setFilesystemPlacement] = useState<FilesystemPlacement>('local')
  const [middleware, setMiddleware] = useState<readonly MiddlewareChoice[]>(['trace'])
  const [agentCode, setAgentCode] = useState(defaultAgentCode)
  const [initialPrompt, setInitialPrompt] = useState('Say hello from the editable agent.')
  const [chatPrompt, setChatPrompt] = useState('Can you respond to a second prompt?')
  const [result, setResult] = useState<EditableLaunchResult | undefined>()
  const [snapshot, setSnapshot] = useState<EditableSessionSnapshot | undefined>()
  const [status, setStatus] = useState('Idle')
  const [logs, setLogs] = useState<readonly LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const resultRef = useRef<EditableLaunchResult | undefined>(undefined)
  const subscription = useRef<{ unsubscribe(): void } | undefined>(undefined)

  const canChat = Boolean(result && snapshot?.sessionId && !busy)
  const canStop = Boolean(result && !busy)
  const coordinates = useMemo(() => snapshot ? JSON.stringify({
    endpoint,
    launchId: snapshot.launchId,
    sessionId: snapshot.sessionId,
    status: snapshot.status,
    requiredActions: snapshot.requiredActions,
  }, null, 2) : 'No session yet.', [endpoint, snapshot])

  useEffect(() => {
    let cancelled = false
    void probeLocalEndpoint(endpoint).then((status) => {
      if (!cancelled) setDaemonStatus(status)
    })
    return () => {
      cancelled = true
    }
  }, [endpoint])

  useEffect(() => () => {
    closeLaunchResources({ updateState: false })
  }, [])

  useEffect(() => {
    resultRef.current = result
  }, [result])

  async function run() {
    await withBusy(async () => {
      closeLaunchResources()
      setSnapshot(undefined)
      setLogs([])
      addLog('launch', 'Creating Fireline session and sending the initial prompt.')
      setRecoveryHint(undefined)
      const next = await createEditableLaunch({
        endpoint,
        agentCode,
        initialPrompt,
        brainPlacement,
        filesystemPlacement,
        middleware,
      })
      setResult(next)
      setSnapshot(next.current())
      subscription.current = next.subscribe((current) => {
        setSnapshot(current)
      })
      const current = next.current()
      addLog('session', `Launch ${current.launchId ?? '(pending)'} reached ${current.status ?? 'unknown'}.`)
      if (current.sessionId) {
        addLog('session', `Session ${current.sessionId} is ready on ${endpoint}.`)
      }
      addLog('chat', summarizeChatResult('Initial prompt', next.initialResponse))
    }, 'Running')
  }

  async function sendPrompt() {
    if (!result || !snapshot?.sessionId) return
    await withBusy(async () => {
      addLog('user', chatPrompt)
      const response = await result.session.chat(chatPrompt, {
        wait: {
          until: 'session_ready',
          timeoutMs: 60_000,
        },
      })
      setSnapshot(result.current())
      addLog('chat', summarizeChatResult('Follow-up prompt', response))
    }, 'Sending prompt')
  }

  async function stopLaunch() {
    if (!result) return
    await withBusy(async () => {
      addLog('stop', `Stopping launch ${snapshot?.launchId ?? '(pending)'}.`)
      const stopped = await stopEditableLaunch({
        launch: result,
        reason: 'Stopped from editable-agent-web UI',
      })
      setSnapshot(stopped.snapshot)
      closeLaunchResources()
      addLog('stop', `Launch ${stopped.snapshot.launchId ?? '(pending)'} reached ${stopped.snapshot.status ?? 'unknown'}.`)
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
      const recovery = explainLaunchError(error, endpoint)
      if (recovery) {
        setRecoveryHint(recovery)
        addLog('recovery', recovery)
      }
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

  function closeLaunchResources(options: { updateState?: boolean } = {}) {
    subscription.current?.unsubscribe()
    subscription.current = undefined
    resultRef.current?.close()
    resultRef.current = undefined
    if (options.updateState !== false) {
      setResult(undefined)
    }
  }

  return (
    <main className="app">
      <section className="workbench">
        <div className="topline">
          <div>
            <p className="eyebrow">Tier 1 managed-agent discovery</p>
            <h1>Editable Fireline Agent</h1>
          </div>
          <div className="status" aria-live="polite">{status}</div>
        </div>

        <div className="control-grid">
          <div className="stream-config">
            <label>
              Fireline endpoint
              <input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                aria-describedby="stream-config-help"
              />
            </label>
            <p id="stream-config-help">
              {daemonStatus}
            </p>
            {recoveryHint && <p className="recovery-hint">{recoveryHint}</p>}
            <div className="stream-actions">
              <button type="button" onClick={() => setEndpoint(defaultEndpoint)}>
                Use injected endpoint
              </button>
              <button type="button" onClick={() => void navigator.clipboard?.writeText(defaultEndpoint)}>
                Copy endpoint
              </button>
            </div>
            <code className="command-line">{localDevCommand}</code>
          </div>
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
          <button type="button" onClick={stopLaunch} disabled={!canStop}>Stop</button>
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

async function probeLocalEndpoint(endpoint: string): Promise<string> {
  if (!endpoint.trim()) {
    return `No endpoint injected. Start this app with: ${localDevCommand}.`
  }
  try {
    const endpointUrl = new URL(endpoint)
    const healthUrl = new URL('/healthz', endpointUrl.origin)
    const streamProbe = await fetch(endpoint, { method: 'GET', cache: 'no-store' })
    const streamName = streamNameFromUrl(endpoint)
    if (streamProbe.ok) {
      return `Endpoint ${streamName ?? endpointUrl.href} is readable.`
    }
    if (streamProbe.status === 404) {
      return [
        `Endpoint ${streamName ?? endpointUrl.href} is not readable yet.`,
        `Restart with ${localDevCommand} so fireline runtime dev exports an appendable FIRELINE_ENDPOINT.`,
      ].join(' ')
    }
    return `Endpoint probe returned HTTP ${streamProbe.status}. Health endpoint: ${healthUrl.href}.`
  } catch (error) {
    return error instanceof Error
      ? `Endpoint probe failed: ${error.message}. Start this app with: ${localDevCommand}.`
      : `Endpoint probe failed. Start this app with: ${localDevCommand}.`
  }
}

function explainLaunchError(error: unknown, controlStreamUrl: string): string | undefined {
  const message = error instanceof Error ? error.message : String(error)
  if (!/404|Stream not found/i.test(message)) return undefined
  const missingStream = streamNameFromMessage(message) ?? streamNameFromUrl(controlStreamUrl) ?? '<stream>'
  return [
    `Fireline endpoint ${missingStream} was not found by durable streams.`,
    'This usually means editable-agent-web is pointed at a stream the reused daemon is not watching.',
    `Restart through ${localDevCommand} so fireline runtime dev exports an appendable FIRELINE_ENDPOINT.`,
  ].join(' ')
}

function streamNameFromMessage(message: string): string | undefined {
  const match = /Stream not found:\s*([^\s"'<>]+)/i.exec(message)
  return match?.[1]
}

function streamNameFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    const marker = '/v1/stream/'
    const index = url.pathname.indexOf(marker)
    if (index < 0) return undefined
    const encoded = url.pathname.slice(index + marker.length)
    return decodeURIComponent(encoded)
  } catch {
    return undefined
  }
}

function envValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
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

function summarizeChatResult(label: string, response: {
  readonly sessionId: string
  readonly stopReason?: string
  readonly response: Record<string, unknown>
}): string {
  return [
    `${label}: session ${response.sessionId}.`,
    `stopReason=${response.stopReason ?? 'unknown'}.`,
    `response=${summarizePayload(response.response)}`,
  ].join(' ')
}

function summarizePayload(value: unknown): string {
  try {
    const json = JSON.stringify(value)
    if (!json) return 'null'
    return json.length > 220 ? `${json.slice(0, 217)}...` : json
  } catch {
    return String(value)
  }
}
