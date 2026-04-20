'use client'

import { useState } from 'react'
import { runInlineLaunch } from './run-inline-launch'

export default function Page() {
  const [controlStreamUrl, setControlStreamUrl] = useState('')
  const [prompt, setPrompt] = useState('Hello from straightforward Next.')
  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState('No launch yet.')

  async function run() {
    setBusy(true)
    try {
      const result = await runInlineLaunch({
        controlStreamUrl,
        prompt,
        example: '04-next-basic',
      })
      setOutput(JSON.stringify(result, null, 2))
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main>
      <p className="eyebrow">Discovery, not canonical</p>
      <h1>Next-shaped Fireline app</h1>
      <section className="controls">
        <label>
          Launch/control stream URL
          <input
            value={controlStreamUrl}
            onChange={(event) => setControlStreamUrl(event.target.value)}
            placeholder="http://127.0.0.1:7474/v1/stream/fireline-examples-control"
          />
        </label>
        <label>
          Prompt
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <button type="button" onClick={run} disabled={busy}>Run</button>
      </section>
      <pre>{output}</pre>
    </main>
  )
}
