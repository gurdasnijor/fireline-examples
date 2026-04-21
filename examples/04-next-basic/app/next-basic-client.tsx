'use client'

import { useState } from 'react'
import { runInlineLaunch } from './run-inline-launch'

export function NextBasicClient(props: { readonly initialEndpoint: string }) {
  const [endpoint, setEndpoint] = useState(props.initialEndpoint)
  const [prompt, setPrompt] = useState('Hello from straightforward Next.')
  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState('No launch yet.')

  async function run() {
    setBusy(true)
    try {
      const result = await runInlineLaunch({
        endpoint,
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
      <p className="eyebrow">Tier 1 managed-agent path</p>
      <h1>Next-shaped Fireline app</h1>
      <section className="controls">
        <label>
          Fireline endpoint
          <input
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
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
