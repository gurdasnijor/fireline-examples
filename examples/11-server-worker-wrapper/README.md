# Server/Worker Wrapper Pattern

This current Tier 1 example shows a framework server or Worker owning the
Fireline boundary.
The application sends a small app-facing request to the wrapper; the wrapper
validates auth, creates a stable idempotency key, creates
`new Fireline({ endpoint })`, creates `new Agent(...)`, opens a session with
`fireline.session(...)`, and stops it with `session.stop(...)`.

It is not a new Fireline API. It is consumer-authored adapter code for apps
that need tenant policy, secrets, or idempotency to stay server-side.

## Boundaries

- `src/framework-boundary.ts` has app-facing types and env parsing. It imports
  no Fireline packages.
- `src/server-worker-wrapper.ts` is the server/Worker boundary. It is the only
  file in this example that imports Fireline packages.
- `src/run.ts` simulates an app calling the wrapper with a bearer token.

The wrapper accepts `FIRELINE_ENDPOINT` when the deployment already has the
exact Fireline stream endpoint. Otherwise it treats
`FIRELINE_DURABLE_STREAMS_URL` as the durable streams append base ending in
`/v1/stream` and appends `/<FIRELINE_CONTROL_STREAM>`. For local dev without
that base URL, it derives
`http://127.0.0.1:<FIRELINE_STREAMS_PORT>/v1/stream/<FIRELINE_CONTROL_STREAM>`.

`APP_RUN_ID` and `APP_ATTEMPT_ID` are product coordinates. Retries of the same
attempt should reuse both values; a new attempt should change
`APP_ATTEMPT_ID`. The wrapper uses these coordinates to build a stable
`clientRequestId` / idempotency key.

The wrapper keeps normal lifecycle flow on the Tier 1 managed-agent surface.

## Reviewer Reproduce

This branch uses package-shaped git artifact refs, not local `/tmp` tarballs.

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
