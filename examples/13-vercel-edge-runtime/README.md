# Vercel Edge Runtime

Discovery-only Vercel Edge Runtime example. It models an Edge function that
owns the Fireline call path for one request:

1. derive the Fireline endpoint from deployment environment;
2. build an `Agent` with `acp.inlineJsBundle(...)`;
3. open a session through `fireline.session(...)`;
4. wait for `session_ready` and read the session snapshot;
5. stop through `session.stop(...)`;
6. return a compact JSON response to the application caller.

This is not a public Vercel deployment recipe and not a Fireline API wrapper.
The Edge bundle avoids Node built-ins and uses documented package subpaths
only. The local smoke runner uses `@edge-runtime/vm` to execute the bundled
handler in a Vercel Edge-like Web Runtime.

## Files

- `src/edge.ts`: Vercel Edge-style route handler. It imports
  `@fireline/client/managed-agent`, `new Fireline({ endpoint })`, `new Agent(...)`,
  `fireline.session(...)`, and `session.stop(...)`.
- `src/run-local.ts`: local E2E runner that loads the built Edge bundle into
  `@edge-runtime/vm` and dispatches one request.
- `vite.config.ts`: local bundling config for the Edge handler.

The handler uses `acp.inlineJsBundle(...)` only to build the inline agent
fixture. Normal lifecycle flow stays on `fireline.session(...)` and
`session.stop(...)` instead of launch-handle APIs or Tier 3 spec/events/state
subpaths.

## Reviewer Reproduce

The repo uses package-shaped git artifact refs in `package.json`, not Fireline
source imports or local tarballs.

Cheap checks:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" install --frozen-lockfile
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run build:vercel-edge-runtime
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run check:surface
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsc --noEmit --pretty false
```

Fresh-daemon scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-11/fresh-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4614 \
FIRELINE_STREAMS_PORT=7714 \
future-runtime-dev-after-mono-ug3b \
  --state-stream fireline-vercel-edge-fresh -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7714/v1/stream" \
    FIRELINE_CONTROL_STREAM="fireline-vercel-edge-fresh" \
    VERCEL_EDGE_RUN_ID="fresh-daemon-run-001" \
    VERCEL_EDGE_ATTEMPT_ID="attempt-1" \
    sh -c 'pnpm --dir "$EX" run build:vercel-edge-runtime >/dev/null && pnpm --dir "$EX" exec tsx "$EX/examples/13-vercel-edge-runtime/src/run-local.ts"'
```

Prior-daemon reuse scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-11/reuse-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4615 \
FIRELINE_STREAMS_PORT=7715 \
future-runtime-dev-after-mono-ug3b \
  --state-stream fireline-vercel-edge-reuse
```

In another shell:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7715/v1/stream" \
  FIRELINE_CONTROL_STREAM="fireline-vercel-edge-reuse" \
  VERCEL_EDGE_RUN_ID="reuse-daemon-run-001" \
  VERCEL_EDGE_ATTEMPT_ID="attempt-1" \
  sh -c 'pnpm --dir "$EX" run build:vercel-edge-runtime >/dev/null && pnpm --dir "$EX" exec tsx "$EX/examples/13-vercel-edge-runtime/src/run-local.ts"'
```

Both runs should print JSON with `ok: true`, `edgeRuntime:
"edge-runtime"`, `launchStatus: "session_ready"`, and `stopStatus:
"stopped"`.

If the fresh-daemon wrapper keeps the local daemon alive after printing the
JSON result, stop it with Ctrl-C. The example has already completed once the
JSON result reaches `stopStatus: "stopped"`.

## Local Evidence

BE3 `mono-oet.29.3.11` ran these checks from branch
`be3/mono-oet-29-3-11-vercel-edge`:

```sh
pnpm run build:vercel-edge-runtime
pnpm run check:surface
pnpm exec tsc --noEmit --pretty false
```

Fresh-daemon E2E:

```sh
FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-11/fresh-state \
FIRELINE_PORT=4614 \
FIRELINE_STREAMS_PORT=7714 \
FIRELINE_CONTROL_STREAM=fireline-vercel-edge-fresh \
VERCEL_EDGE_RUN_ID=fresh-daemon-run-001 \
VERCEL_EDGE_ATTEMPT_ID=attempt-1 \
pnpm --dir /Users/gnijor/gurdasnijor/fireline-examples run smoke:vercel-edge-runtime
```

Result: `ok: true`, `edgeRuntime: "edge-runtime"`, `launchStatus:
"session_ready"`, and `stopStatus: "stopped"`. Log:
`/tmp/fireline-mono-oet-29-3-11/fresh.log`.

Prior-daemon reuse E2E used `/tmp/fireline-mono-oet-29-3-11/reuse-state`,
ports `4615` and `7715`, control stream `fireline-vercel-edge-reuse`, then
ran the built Edge bundle through `@edge-runtime/vm`.

Result: `ok: true`, `edgeRuntime: "edge-runtime"`, `launchStatus:
"session_ready"`, and `stopStatus: "stopped"`. Logs:
`/tmp/fireline-mono-oet-29-3-11/reuse-daemon.log` and
`/tmp/fireline-mono-oet-29-3-11/reuse-run.log`.
