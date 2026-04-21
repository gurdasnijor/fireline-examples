'use client'

import { useState } from 'react'
import { runInlineLaunch } from './run-inline-launch'

export default function Page() {
  const [endpoint, setEndpoint] = useState(process.env.NEXT_PUBLIC_FIRELINE_ENDPOINT ?? '')
  const [prompt, setPrompt] = useState('Hello from OpenNext on Cloudflare shape.')
  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState('No launch yet.')

  async function run() {
    setBusy(true)
    try {
      const result = await runInlineLaunch({
        endpoint,
        prompt,
        example: '05-next-open-cloudflare',
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
      <h1>OpenNext Cloudflare-shaped Fireline app</h1>
      <p className="note">
        Fireline calls stay in the client bundle for this checkpoint. Server
        and Worker code must not import Node-only Fireline runtime surfaces.
      </p>
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
