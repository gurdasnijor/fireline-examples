# Vercel Edge Runtime

Current Tier 1 Vercel Edge Runtime example. It models an Edge function that
owns the Fireline call path for one request through `Fireline`, `Agent`, and a
managed-agent session:

1. read `FIRELINE_ENDPOINT` from deployment environment;
2. build an `Agent` with `acp.inlineJsBundle(...)`;
3. open a session through `fireline.session(...)`;
4. wait for `session_ready` and read the session snapshot;
5. stop through `session.stop(...)`;
6. return a compact JSON response to the application caller.

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
`session.stop(...)`. `FIRELINE_ENDPOINT` is the app-facing endpoint consumed by
`new Fireline({ endpoint })`; the Edge handler does not derive an endpoint from
stream pieces.

## Reviewer Reproduce

Cheap checks:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
pnpm --dir "$EX" install --frozen-lockfile
pnpm --dir "$EX" run build:vercel-edge-runtime
pnpm --dir "$EX" run check:surface
pnpm --dir "$EX" run check:surface:v396
pnpm --dir "$EX" run typecheck
```

Fresh-daemon scenario:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-irzz-wave-b-13-fresh/state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 5613 \
  --streams-port 8613 \
  --launch-control-stream fireline-vercel-edge-fresh -- \
  sh -c 'pnpm --dir "$EX" run build:vercel-edge-runtime >/dev/null && VERCEL_EDGE_RUN_ID=fresh-daemon-run-001 VERCEL_EDGE_ATTEMPT_ID=attempt-1 pnpm --dir "$EX" exec tsx "$EX/examples/13-vercel-edge-runtime/src/run-local.ts"'
```

Prior-daemon reuse scenario:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-irzz-wave-b-13-reuse/state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 5614 \
  --streams-port 8614 \
  --launch-control-stream fireline-vercel-edge-reuse -- \
  sh -c 'sleep 600'
```

In another shell:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-irzz-wave-b-13-reuse/state
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 5614 \
  --streams-port 8614 \
  --launch-control-stream fireline-vercel-edge-reuse -- \
  sh -c 'pnpm --dir "$EX" run build:vercel-edge-runtime >/dev/null && VERCEL_EDGE_RUN_ID=reuse-daemon-run-001 VERCEL_EDGE_ATTEMPT_ID=attempt-1 pnpm --dir "$EX" exec tsx "$EX/examples/13-vercel-edge-runtime/src/run-local.ts"'
```

Both runs should print JSON with `ok: true`, `edgeRuntime:
"edge-runtime"`, `sessionStatus: "session_ready"`, and `stopStatus:
"stopped"`.

## Wave B Evidence

Fresh-daemon and prior-daemon reuse artifacts are written under
`/tmp/fireline-mono-irzz-wave-b-13-*` during local validation.
