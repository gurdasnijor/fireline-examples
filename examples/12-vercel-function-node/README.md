# Vercel Function Node Runtime

Current Tier 1 Vercel Functions Node-runtime example. It models a serverless
Node function that owns the Fireline call path for one request through
`Fireline`, `Agent`, and a managed-agent session:

1. read the app-facing Fireline endpoint from `FIRELINE_ENDPOINT`;
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
In local dev, `fireline runtime dev --launch-control-stream ... --` injects
`FIRELINE_ENDPOINT` into the example command.

## Reviewer Reproduce

The repo uses package-shaped git artifact refs in `package.json`, not Fireline
source imports or local tarballs.

Cheap checks:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
pnpm install --frozen-lockfile
pnpm run check:surface
pnpm exec tsc --noEmit --pretty false
```

Fresh-daemon scenario:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-oet-29-3-12/fresh-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 4612 \
  --streams-port 7712 \
  --launch-control-stream fireline-vercel-function-fresh -- \
  env VERCEL_FUNCTION_RUN_ID="fresh-daemon-run-001" \
    VERCEL_FUNCTION_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$EX" exec tsx \
      "$EX/examples/12-vercel-function-node/src/run-local.ts"
```

Prior-daemon reuse scenario:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-oet-29-3-12/reuse-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 4613 \
  --streams-port 7713 \
  --launch-control-stream fireline-vercel-function-reuse -- \
  sh -c 'sleep 300'
```

Leave that holder running. In another shell:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-oet-29-3-12/reuse-state
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 4613 \
  --streams-port 7713 \
  --launch-control-stream fireline-vercel-function-reuse -- \
  env VERCEL_FUNCTION_RUN_ID="reuse-daemon-run-001" \
    VERCEL_FUNCTION_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$EX" exec tsx \
      "$EX/examples/12-vercel-function-node/src/run-local.ts"
```

Both runs should print JSON with `ok: true`, `launchStatus: "session_ready"`,
and `stopStatus: "stopped"`.

Validated 2026-04-21 evidence:

- Fresh daemon: launch `4b7f70b6-b021-499b-85a0-d4853a246774`,
  `clientRequestId`
  `launch:vercel-function-node:tenant-vercel-node:mono-irzz-wave-b-12-fresh:attempt-1`,
  ACP session `jsmod-d489fbef-0a3d-4dfb-890c-5469135b3eb9`,
  `ok: true`, `launchStatus: "session_ready"`, `stopStatus: "stopped"`.
  Artifacts: `/tmp/fireline-mono-irzz-wave-b-12-fresh`.
- Prior daemon reuse: launch `029efb93-a12d-4a28-8cfd-c2fb0babd86a`,
  `clientRequestId`
  `launch:vercel-function-node:tenant-vercel-node:mono-irzz-wave-b-12-reuse:attempt-1`,
  ACP session `jsmod-a9e883a1-6536-4749-8f8c-06cd1e8ce9fd`,
  `ok: true`, `launchStatus: "session_ready"`, `stopStatus: "stopped"`.
  Artifacts: `/tmp/fireline-mono-irzz-wave-b-12-reuse`.
