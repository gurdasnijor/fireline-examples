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
- `examples/08-cloudflare-worker-direct` is a direct Cloudflare Worker
  discovery example. It uses Worker-safe `@fireline/client/spec`,
  `@fireline/client/events`, and `@fireline/state` imports without Next.js or
  OpenNext.

Setup:

```sh
pnpm install
pnpm run check
```

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

Run the editable-agent web app with a package-shaped Fireline runtime:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet.29.3.1-state
export FIRELINE_PORT=4485
export FIRELINE_STREAMS_PORT=7585
export FIRELINE_CONTROL_STREAM=fireline-examples-control
export FIRELINE_LAUNCH_CONTROL_STREAM_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream/${FIRELINE_CONTROL_STREAM}"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM"
```

In another shell:

```sh
VITE_FIRELINE_LAUNCH_CONTROL_STREAM_URL="$FIRELINE_LAUNCH_CONTROL_STREAM_URL" \
  pnpm run dev:editable-agent-web
```

Open `http://127.0.0.1:5173/`. The app appends to the configured
launch/control stream and observes the `@fireline/state` launches collection.
It stops through `appendLaunchStop`. It does not call `/v1/launches` or use
`@fireline/client/launch-control`.

Framework-shaped checks:

```sh
pnpm run build:tanstack-shaped
pnpm run build:next-basic
pnpm run build:next-open-cloudflare
pnpm run build:opennext-cloudflare
```

The OpenNext/Cloudflare build uses the local adapter shape only. It is not a
deployment recipe.

Run the direct Cloudflare Worker example with local Fireline defaults:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-worker-direct-state
export FIRELINE_CONTROL_STREAM=fireline-worker-direct-control
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM"
```

In another shell:

```sh
pnpm run dev:cloudflare-worker-direct
curl -sS -X POST http://127.0.0.1:8787/demo \
  -H 'content-type: application/json' \
  --data '{"prompt":"run the direct Worker example"}'
```

The Worker derives the local launch/control stream URL from the default
`FIRELINE_STREAMS_PORT` and `FIRELINE_CONTROL_STREAM`. For custom ports or
stream names, pass explicit Wrangler vars:

```sh
pnpm dlx wrangler@4.83.0 dev \
  --config examples/08-cloudflare-worker-direct/wrangler.toml \
  --port 8787 \
  --var FIRELINE_STREAMS_PORT:8581 \
  --var FIRELINE_CONTROL_STREAM:fireline-worker-direct-control \
  --var FIRELINE_DURABLE_STREAMS_URL:http://127.0.0.1:8581/v1/stream \
  --var FIRELINE_LAUNCH_CONTROL_STREAM_URL:http://127.0.0.1:8581/v1/stream/fireline-worker-direct-control
```

Shell environment variables alone do not override Wrangler `[vars]`; use
`--var` for scratch ports or non-default stream names.

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
