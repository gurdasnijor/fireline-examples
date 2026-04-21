# Runtime E2E Sweep

Branch: `be4/examples-runtime-e2e-sweep`
Base: `main` at `7e3003dbf8e7eec47c3b4324ab1c1098274b7adc`

## Static Checks

Run from `/private/tmp/fireline-examples-be4-runtime-e2e`:

```sh
pnpm install --frozen-lockfile
pnpm run check:surface
pnpm run check:surface:v396
pnpm run typecheck
pnpm run build:vercel-edge-runtime
git diff --check
```

Result: all passed.

Owned runtime/server surface audit:

```sh
rg -n "Discovery-only|Tier 3|until.*cutover|until.*land|not a public|not a Fireline API wrapper|launch-handle|launch-control|retired|FIRELINE_LAUNCH_CONTROL_STREAM_URL|createManagedAgentClient|createManagedAgentLaunchRequest|ManagedAgentLaunchHandle|launchAgent|launchControlStreamUrl|bridge env|bridge vocabulary" \
  examples/08-cloudflare-worker-direct \
  examples/11-server-worker-wrapper \
  examples/12-vercel-function-node \
  examples/13-vercel-edge-runtime \
  examples/14-bun \
  examples/16-deno \
  examples/17-acp-registry-chat \
  examples/18-middleware-stack \
  -g '*.{ts,tsx,js,md,toml}'
```

Result: no matches.

## E2E Result

Every runtime/server example reached a ready session and a stopped row in both
fresh-daemon and prior-daemon reuse scenarios.

| Example | Fresh artifact | Reuse artifact | Result |
| --- | --- | --- | --- |
| 08 Cloudflare Worker direct | `/tmp/fireline-examples-runtime-e2e-08-fresh` | `/tmp/fireline-examples-runtime-e2e-08-reuse` | `launchStatus: "session_ready"`, `stopStatus: "stopped"` |
| 11 server/Worker wrapper | `/tmp/fireline-examples-runtime-e2e-11-fresh` | `/tmp/fireline-examples-runtime-e2e-11-reuse` | `launchStatus: "session_ready"`, `stopStatus: "stopped"` |
| 12 Vercel Function Node | `/tmp/fireline-examples-runtime-e2e-12-fresh` | `/tmp/fireline-examples-runtime-e2e-12-reuse` | `launchStatus: "session_ready"`, `stopStatus: "stopped"` |
| 13 Vercel Edge | `/tmp/fireline-examples-runtime-e2e-13-fresh` | `/tmp/fireline-examples-runtime-e2e-13-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |
| 14 Bun | `/tmp/fireline-examples-runtime-e2e-14-fresh` | `/tmp/fireline-examples-runtime-e2e-14-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |
| 16 Deno | `/tmp/fireline-examples-runtime-e2e-16-fresh` | `/tmp/fireline-examples-runtime-e2e-16-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |
| 17 ACP registry chat | `/tmp/fireline-examples-runtime-e2e-17-fresh` | `/tmp/fireline-examples-runtime-e2e-17-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |
| 18 middleware stack | `/tmp/fireline-examples-runtime-e2e-18-fresh` | `/tmp/fireline-examples-runtime-e2e-18-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |

The Vercel Edge bundle build log is at
`/tmp/fireline-examples-runtime-e2e-edge-build.log`.

## Command Shape

Fresh one-shot examples used:

```sh
FIRELINE_STATE_DIR=<artifact>/state \
pnpm exec fireline-v3-dev \
  --fireline-port <port> \
  --streams-port <streams-port> \
  --state-stream <stream> -- \
  env FIRELINE_ENDPOINT="http://127.0.0.1:<streams-port>/v1/stream/<stream>" \
    <example command>
```

Prior-daemon reuse examples started the daemon first:

```sh
FIRELINE_STATE_DIR=<artifact>/state \
pnpm exec fireline-v3-dev \
  --fireline-port <port> \
  --streams-port <streams-port> \
  --state-stream <stream> -- sleep 180
```

Then ran the example in a second process with:

```sh
FIRELINE_ENDPOINT="http://127.0.0.1:<streams-port>/v1/stream/<stream>" \
  <example command>
```

Cloudflare Worker direct used the same daemon pattern plus Wrangler:

```sh
pnpm dlx wrangler@4.83.0 dev \
  --config examples/08-cloudflare-worker-direct/wrangler.toml \
  --ip 127.0.0.1 \
  --port <worker-port> \
  --local \
  --show-interactive-dev-session=false \
  --var FIRELINE_ENDPOINT:http://127.0.0.1:<streams-port>/v1/stream/<stream>
```

Then:

```sh
curl -fsS -X POST "http://127.0.0.1:<worker-port>/demo" \
  -H "content-type: application/json" \
  --data '{"prompt":"Run runtime E2E"}'
```

## Notes

- No Fireline source imports were introduced.
- No Tier 2 raw examples were modified or run for this sweep.
- Owned READMEs now describe these examples as current Tier 1
  `Fireline`/`Agent`/session examples.
