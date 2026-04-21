# Vercel Function Node Runtime

Current Tier 1 Vercel Functions Node-runtime example. It models a serverless
Node function that owns the Fireline call path for one request through
`Fireline`, `Agent`, and a managed-agent session:

1. derive the Fireline endpoint from deployment environment;
2. create a `new Fireline({ endpoint })` client;
3. create a `new Agent(...)`;
4. open the session through `fireline.session(...)`;
5. stop through `session.stop(...)`;
6. return a compact JSON response to the application caller.

It is a Node serverless consumer shape. Node built-ins are permitted, but the
normal Fireline lifecycle path should stay on `@fireline/client/managed-agent`.

## Files

- `api/fireline-launch.ts`: Vercel-style Node function handler. It imports
  `IncomingMessage` and `ServerResponse` types from Node,
  `@fireline/client/managed-agent`, and the Tier 1 managed-agent classes.
- `src/run-local.ts`: local E2E runner that starts a Node HTTP server around
  the handler and sends one request.

The handler uses the current Tier 1 managed-agent surface for normal lifecycle
flow.

## Reviewer Reproduce

The repo uses package-shaped git artifact refs in `package.json`, not Fireline
source imports or local tarballs.

Cheap checks:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" install --frozen-lockfile
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run check:surface
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsc --noEmit --pretty false
```

Fresh-daemon scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-12/fresh-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4612 \
FIRELINE_STREAMS_PORT=7712 \
future-runtime-dev-after-mono-ug3b \
  --state-stream fireline-vercel-function-fresh -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7712/v1/stream" \
    FIRELINE_CONTROL_STREAM="fireline-vercel-function-fresh" \
    VERCEL_FUNCTION_RUN_ID="fresh-daemon-run-001" \
    VERCEL_FUNCTION_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$EX" exec tsx \
      "$EX/examples/12-vercel-function-node/src/run-local.ts"
```

Prior-daemon reuse scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-12/reuse-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4613 \
FIRELINE_STREAMS_PORT=7713 \
future-runtime-dev-after-mono-ug3b \
  --state-stream fireline-vercel-function-reuse
```

In another shell:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7713/v1/stream" \
  FIRELINE_CONTROL_STREAM="fireline-vercel-function-reuse" \
  VERCEL_FUNCTION_RUN_ID="reuse-daemon-run-001" \
  VERCEL_FUNCTION_ATTEMPT_ID="attempt-1" \
  pnpm --dir "$EX" exec tsx \
    "$EX/examples/12-vercel-function-node/src/run-local.ts"
```

Both runs should print JSON with `ok: true`, `launchStatus: "session_ready"`,
and `stopStatus: "stopped"`.

Validated 2026-04-20 evidence:

- Fresh daemon: launch `294a2186-26a4-42ff-81b8-bfead1ec5dc7`,
  `clientRequestId`
  `launch:vercel-function-node:tenant-vercel-node:fresh-daemon-run-001:attempt-1`,
  ACP session `jsmod-694228a2-33f0-4f6e-8b9e-9fa2402f1c24`,
  `ok: true`, `launchStatus: "session_ready"`, `stopStatus: "stopped"`.
- Prior daemon reuse: launch `3f740242-4a89-4392-b736-0d81f146034f`,
  `clientRequestId`
  `launch:vercel-function-node:tenant-vercel-node:reuse-daemon-run-001:attempt-1`,
  ACP session `jsmod-50251cf0-e802-48f9-990d-398f5c9608cf`,
  `ok: true`, `launchStatus: "session_ready"`, `stopStatus: "stopped"`.
