# Fireline Examples Discovery

This repository is a discovery spike, not a canonical examples repository and
not product-demo canon. Its job is to consume Fireline from outside the
Fireline source tree and expose friction before the public managed-agent
surface stabilizes.

Rules for this repo:

- Use installable/package-shaped Fireline refs only.
- Do not import from `../fireline`, `packages/*/src`, or unpublished source
  files.
- Do not use private Fireline subpaths unless the usage is logged as a blocker.
- Keep examples deliberately small until the consumption interface is stable.
- File Fireline code changes as separate beads; do not patch Fireline here.

Current checkpoint:

- `examples/01-inline-js-local` is TypeScript-authored and launches an inline
  JS local matrix by appending `fireline.launch_request` events through
  `@fireline/client/events`, observing `@fireline/state` launches, and
  stopping each launch with `fireline.launch_stop`.
- `examples/02-editable-agent-web` is a TypeScript/TSX app-shaped discovery
  example. It lets a user edit inline agent code, append a launch request,
  inspect launch/session/runtime coordinates from `collections.launches`, send
  a follow-up ACP prompt through `@fireline/client/acp-browser`, and stop the
  launch with `appendLaunchStop`.
- `examples/03-tanstack-shaped-app`, `examples/04-next-basic`, and
  `examples/05-next-open-cloudflare` are framework-shaped TypeScript discovery
  examples. They keep Fireline calls package-shaped and client-side while
  recording framework seams instead of canonizing product examples.
- `examples/06-flamecast-v3-shaped` is a black-box product-consumer
  characterization. It is not real Flamecast v3 code. It keeps a framework
  boundary separate from the Fireline adapter, generates a multi-file inline
  harness bundle, appends launch/stop through durable streams, observes
  `collections.launches`, and attaches to ACP for a follow-up prompt.
- `examples/07-server-worker-wrapper` is a server/Worker boundary pattern. The
  app-facing layer has no Fireline imports; the server wrapper owns auth,
  tenant checks, idempotency, launch/stop append, and launch observation.

Setup:

```sh
pnpm install
pnpm run check
```

The package refs are immutable git artifact refs from Fireline's pre-npm
artifact channel. They are package-shaped reviewer refs, not public npm
releases.

Run the baseline smoke from a scratch working directory so durable state does
not fan out under this repo. The app-facing configuration is the full
launch/control stream URL; the local runtime setup only makes sure the dev
daemon watches the same configured control stream.

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet.29.3.1-state
export FIRELINE_PORT=4485
export FIRELINE_STREAMS_PORT=7585
export FIRELINE_CONTROL_STREAM=fireline-examples-control
export FIRELINE_LAUNCH_CONTROL_STREAM_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream/${FIRELINE_CONTROL_STREAM}"
export FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_STATE_DIR/inline-js-local-output"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_LAUNCH_CONTROL_STREAM_URL="$FIRELINE_LAUNCH_CONTROL_STREAM_URL" \
    FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_EXAMPLE_OUTPUT_ROOT" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/01-inline-js-local/run.ts"
```

The `FIRELINE_BIN` and `FIRELINE_STREAMS_BIN` overrides were historical
checkpoint workarounds before `mono-oet.29.4` closed. Do not use them for the
package-shaped baseline after PR #210.

Run the editable-agent web app with a package-shaped Fireline runtime. The
local dev command starts Vite as a child of `fireline-v3-dev` so the app
receives the daemon's exact `FIRELINE_LAUNCH_CONTROL_STREAM_URL`:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-editable-agent-web-state
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run dev:editable-agent-web
```

Open `http://127.0.0.1:5173/` and click **Run**. The app pre-fills the
launch/control stream URL from the daemon handoff. If you intentionally run the
private Vite child script separately, it falls back to
`http://127.0.0.1:7474/v1/stream/fireline-examples-control`, probes the local
streams health endpoint, and shows a copyable one-line derivation:

```sh
export FIRELINE_LAUNCH_CONTROL_STREAM_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT:-7474}/v1/stream/${FIRELINE_CONTROL_STREAM:-fireline-examples-control}"
```

If a prior daemon is already running on the selected ports, the same command
reuses it through `fireline-v3-dev`. The wrapper creates/verifies the
launch/control stream, then exports the exact URL to the Vite app:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run dev:editable-agent-web --port 5193
```

Open `http://127.0.0.1:5193/` and click **Run**. If the UI shows
`Stream not found`, the selected launch/control URL does not match the reused
daemon. Paste the exact `FIRELINE_LAUNCH_CONTROL_STREAM_URL` printed/exported
by `fireline-v3-dev`, click **Use daemon default**, or restart with the
matching `--state-stream`.

If you intentionally use non-default ports with the one-command wrapper, set
the Fireline ports on the dev command:

```sh
FIRELINE_PORT=5537 FIRELINE_STREAMS_PORT=8574 \
pnpm run dev:editable-agent-web --port 5192
```

The app appends to the configured launch/control stream and observes the
`@fireline/state` launches collection. It stops through `appendLaunchStop`. It
does not call `/v1/launches` or use `@fireline/client/launch-control`.

Reviewer reproduce: fresh daemon runnable path:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-review-editable-fresh-state
rm -rf "$FIRELINE_STATE_DIR"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" FIRELINE_PORT=5537 FIRELINE_STREAMS_PORT=8574 \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run dev:editable-agent-web --port 5192
```

Open `http://127.0.0.1:5192/`, click **Run**, then click **Stop**. Expected:
the URL field matches
`http://127.0.0.1:8574/v1/stream/fireline-v3-dev-daemon`, the session
log reaches a running launch with ACP coordinates, and Stop observes
`stopped`.

Reviewer reproduce: prior daemon reuse:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-review-editable-reuse-state
mkdir -p "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" FIRELINE_PORT=5538 FIRELINE_STREAMS_PORT=8575 \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev
# In a second shell:
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" FIRELINE_PORT=5538 FIRELINE_STREAMS_PORT=8575 \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run dev:editable-agent-web --port 5193
```

Open `http://127.0.0.1:5193/`, click **Run**, then click **Stop**. With
Fireline PR #291 or newer, `fireline-v3-dev` creates/verifies the exported
launch/control stream before starting Vite, so the reused-daemon path should
reach a running launch and then `stopped`.

If a stale daemon or stream store from an older run is still bound to the same
ports, Run may time out or return `Stream not found`. Expected UI behavior: the
session log includes a recovery entry naming the missing stream and directs the
reviewer to paste the exact daemon URL, use the daemon default, or restart with
the matching `--state-stream`.

Framework-shaped checks:

```sh
pnpm run build:tanstack-shaped
pnpm run build:next-basic
pnpm run build:next-open-cloudflare
pnpm run build:opennext-cloudflare
```

The OpenNext/Cloudflare build uses the local adapter shape only. It is not a
deployment recipe.

Run the Flamecast-shaped characterization from scratch state:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet.29.3.3-state
export FIRELINE_PORT=4486
export FIRELINE_STREAMS_PORT=7586
export FIRELINE_CONTROL_STREAM=fireline-flamecast-shaped-control
export FLAMECAST_WORKSPACE_ID=workspace-characterization
export FLAMECAST_RUN_ID=run-001
export FLAMECAST_ATTEMPT_ID=attempt-1
export FLAMECAST_FOLLOW_UP_PROMPT="complete the generated Flamecast harness run"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    FLAMECAST_WORKSPACE_ID="$FLAMECAST_WORKSPACE_ID" \
    FLAMECAST_RUN_ID="$FLAMECAST_RUN_ID" \
    FLAMECAST_ATTEMPT_ID="$FLAMECAST_ATTEMPT_ID" \
    FLAMECAST_FOLLOW_UP_PROMPT="$FLAMECAST_FOLLOW_UP_PROMPT" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/06-flamecast-v3-shaped/src/run.ts"
```

Run the server/Worker wrapper pattern from scratch state:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-13-state
export FIRELINE_PORT=4601
export FIRELINE_STREAMS_PORT=7701
export FIRELINE_CONTROL_STREAM=fireline-server-wrapper-control
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    APP_AUTH_TOKEN="server-wrapper-demo-token" \
    APP_TENANT_ID="tenant-alpha" \
    APP_USER_ID="user-001" \
    APP_RUN_ID="server-wrapper-run-001" \
    APP_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/07-server-worker-wrapper/src/run.ts"
```
