# Server/Worker Wrapper Pattern

This example shows a framework server or Worker owning the Fireline boundary.
The application sends a small app-facing request to the wrapper; the wrapper
validates auth, creates a stable idempotency key, appends
`fireline.launch_request`, observes launch state, and appends
`fireline.launch_stop` through `@fireline/client/managed-agent`.

It is not a new Fireline API. It is consumer-authored adapter code for apps
that need tenant policy, secrets, or idempotency to stay server-side.

## Boundaries

- `src/framework-boundary.ts` has app-facing types and env parsing. It imports
  no Fireline packages.
- `src/server-worker-wrapper.ts` is the server/Worker boundary. It is the only
  file in this example that imports Fireline packages.
- `src/run.ts` simulates an app calling the wrapper with a bearer token.

The wrapper accepts `FIRELINE_LAUNCH_CONTROL_STREAM_URL` when the deployment
already has the exact launch/control stream URL. Otherwise it treats
`FIRELINE_DURABLE_STREAMS_URL` as the durable streams append base ending in
`/v1/stream` and appends `/<FIRELINE_CONTROL_STREAM>`. For local dev without
that base URL, it derives
`http://127.0.0.1:<FIRELINE_STREAMS_PORT>/v1/stream/<FIRELINE_CONTROL_STREAM>`.

`APP_RUN_ID` and `APP_ATTEMPT_ID` are product coordinates. Retries of the same
attempt should reuse both values; a new attempt should change
`APP_ATTEMPT_ID`. The wrapper uses these coordinates to build a stable
`clientRequestId` / idempotency key.

The wrapper uses managed-agent request and inline bundle builders instead of
Tier 3 spec/events/state subpaths for normal lifecycle flow.

## Reviewer Reproduce

This branch uses package-shaped git artifact refs, not local `/tmp` tarballs:

- `@fireline/client`: `fireline-client-artifact-e1e80ebf80285aa3bff04ab7f7d27ae018135798`
- `@fireline/state`: `fireline-state-artifact-e1e80ebf80285aa3bff04ab7f7d27ae018135798`
- `@fireline/runtime`: `fireline-runtime-artifact-96489bb3b55124c2d313282e723a775d7fe8c9dd`

Install and run cheap checks:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" install --frozen-lockfile
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run check:surface
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsc --noEmit --pretty false
```

Fresh-daemon scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-13/fresh-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4601 \
FIRELINE_STREAMS_PORT=7701 \
pnpm --dir "$EX" exec fireline-v3-dev \
  --state-stream fireline-server-wrapper-fresh -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7701/v1/stream" \
    FIRELINE_CONTROL_STREAM="fireline-server-wrapper-fresh" \
    APP_AUTH_TOKEN="server-wrapper-demo-token" \
    APP_TENANT_ID="tenant-alpha" \
    APP_USER_ID="user-001" \
    APP_RUN_ID="fresh-daemon-run-001" \
    APP_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$EX" exec tsx \
      "$EX/examples/11-server-worker-wrapper/src/run.ts"
```

Prior-daemon reuse scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-13/reuse-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4602 \
FIRELINE_STREAMS_PORT=7702 \
pnpm --dir "$EX" exec fireline-v3-dev \
  --state-stream fireline-server-wrapper-reuse
```

In another shell:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7702/v1/stream" \
  FIRELINE_CONTROL_STREAM="fireline-server-wrapper-reuse" \
  APP_AUTH_TOKEN="server-wrapper-demo-token" \
  APP_TENANT_ID="tenant-alpha" \
  APP_USER_ID="user-001" \
  APP_RUN_ID="reuse-daemon-run-001" \
  APP_ATTEMPT_ID="attempt-1" \
  pnpm --dir "$EX" exec tsx \
    "$EX/examples/11-server-worker-wrapper/src/run.ts"
```

Both runs should print JSON with `accepted: true`,
`launchStatus: "session_ready"`, and `stopStatus: "stopped"`.

Validated 2026-04-20 evidence:

- Fresh daemon: launch `ab7869e4-c9c1-4d25-b6df-690d232b37f2`,
  `clientRequestId`
  `launch:server-wrapper:tenant-alpha:doc-local-001:fresh-daemon-run-001:attempt-1`,
  ACP session `jsmod-ecea90e5-6999-4abe-8fea-e89d45c26296`,
  `accepted: true`, `launchStatus: "session_ready"`,
  `stopStatus: "stopped"`.
- Prior daemon reuse: launch `4e8a1a6d-2562-4954-b2be-3410251e4d6e`,
  `clientRequestId`
  `launch:server-wrapper:tenant-alpha:doc-local-001:reuse-daemon-run-001:attempt-1`,
  ACP session `jsmod-6f27243e-abe2-4772-8575-39fe5f30e869`,
  `accepted: true`, `launchStatus: "session_ready"`,
  `stopStatus: "stopped"`.
