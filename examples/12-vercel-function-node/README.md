# Vercel Function Node Runtime

Current Tier 1 Vercel Functions Node-runtime example. It models a serverless
Node function that owns the Fireline call path for one request:

1. derive the Fireline endpoint from deployment environment;
2. create a `new Fireline({ endpoint })` client;
3. create a `new Agent(...)`;
4. open the session through `fireline.session(...)`;
5. stop through `session.stop(...)`;
6. return a compact JSON response to the application caller.

This is not a public Vercel deployment recipe and not a Fireline API wrapper.
It is a Node serverless consumer shape. Node built-ins are permitted, but the
normal Fireline lifecycle path should stay on `@fireline/client/managed-agent`.

## Files

- `api/fireline-launch.ts`: Vercel-style Node function handler. It imports
  `IncomingMessage` and `ServerResponse` types from Node,
  `@fireline/client/managed-agent`, and the Tier 1 managed-agent classes.
- `src/run-local.ts`: local E2E runner that starts a Node HTTP server around
  the handler and sends one request.

The handler keeps normal lifecycle flow on the Tier 1 managed-agent surface.

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
pnpm --dir "$EX" exec fireline-v3-dev \
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
pnpm --dir "$EX" exec fireline-v3-dev \
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
