# Server/Worker Wrapper Pattern

This example shows a framework server or Worker owning the Fireline boundary.
The application sends a small app-facing request to the wrapper; the wrapper
validates auth, creates a stable idempotency key, appends
`new Fireline({ endpoint })`, creates a `new Agent(...)`, opens a session, and
stops it through `@fireline/client/managed-agent`.

It is not a new Fireline API. It is consumer-authored adapter code for apps
that need tenant policy, secrets, or idempotency to stay server-side.

## Boundaries

- `src/framework-boundary.ts` has app-facing types and env parsing. It imports
  no Fireline packages.
- `src/server-worker-wrapper.ts` is the server/Worker boundary. It is the only
  file in this example that imports Fireline packages.
- `src/run.ts` simulates an app calling the wrapper with a bearer token.

The wrapper requires `FIRELINE_ENDPOINT` as the exact app-facing Fireline stream
endpoint. In local dev, `fireline runtime dev --launch-control-stream ... --`
injects that endpoint into the example command.

`APP_RUN_ID` and `APP_ATTEMPT_ID` are product coordinates. Retries of the same
attempt should reuse both values; a new attempt should change
`APP_ATTEMPT_ID`. The wrapper uses these coordinates to build a stable
`clientRequestId` / idempotency key.

The wrapper uses the current Tier 1 managed-agent surface for normal lifecycle
flow.

## Reviewer Reproduce

This branch uses package-shaped git artifact refs, not local `/tmp` tarballs:

- `@fireline/client`: `fireline-client-artifact-e1e80ebf80285aa3bff04ab7f7d27ae018135798`
- `@fireline/runtime`: `fireline-runtime-artifact-96489bb3b55124c2d313282e723a775d7fe8c9dd`

Install and run cheap checks:

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
export STATE=/tmp/fireline-mono-oet-29-3-13/fresh-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 4601 \
  --streams-port 7701 \
  --launch-control-stream fireline-server-wrapper-fresh -- \
  env APP_AUTH_TOKEN="server-wrapper-demo-token" \
    APP_TENANT_ID="tenant-alpha" \
    APP_USER_ID="user-001" \
    APP_RUN_ID="fresh-daemon-run-001" \
    APP_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$EX" exec tsx \
      "$EX/examples/11-server-worker-wrapper/src/run.ts"
```

Prior-daemon reuse scenario:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-oet-29-3-13/reuse-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 4602 \
  --streams-port 7702 \
  --launch-control-stream fireline-server-wrapper-reuse -- \
  sh -c 'sleep 300'
```

Leave that holder running. In another shell:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-oet-29-3-13/reuse-state
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 4602 \
  --streams-port 7702 \
  --launch-control-stream fireline-server-wrapper-reuse -- \
  env APP_AUTH_TOKEN="server-wrapper-demo-token" \
    APP_TENANT_ID="tenant-alpha" \
    APP_USER_ID="user-001" \
    APP_RUN_ID="reuse-daemon-run-001" \
    APP_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$EX" exec tsx \
      "$EX/examples/11-server-worker-wrapper/src/run.ts"
```

Both runs should print JSON with `accepted: true`,
`launchStatus: "session_ready"`, and `stopStatus: "stopped"`.

Validated 2026-04-21 evidence:

- Fresh daemon: launch `90b6ebc7-9f1e-45b8-b612-fa05f8420053`,
  `clientRequestId`
  `launch:server-wrapper:tenant-alpha:doc-local-001:mono-irzz-wave-b-11-fresh:attempt-1`,
  ACP session `jsmod-637771e4-73af-4e8c-9c69-4501b585aec8`,
  `accepted: true`, `launchStatus: "session_ready"`,
  `stopStatus: "stopped"`. Artifacts:
  `/tmp/fireline-mono-irzz-wave-b-11-fresh`.
- Prior daemon reuse: launch `d95b8f5f-821b-4011-8e60-f39311b13c23`,
  `clientRequestId`
  `launch:server-wrapper:tenant-alpha:doc-local-001:mono-irzz-wave-b-11-reuse:attempt-1`,
  ACP session `jsmod-2eab2cb5-cb50-4843-a63e-e349a03c48c4`,
  `accepted: true`, `launchStatus: "session_ready"`,
  `stopStatus: "stopped"`. Artifacts:
  `/tmp/fireline-mono-irzz-wave-b-11-reuse`.
