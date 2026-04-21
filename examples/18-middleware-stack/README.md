# Middleware Stack Example

This example validates the package-shaped middleware builder surface from
outside the Fireline source tree. It builds a normal stream-native launch with
`trace(...)`, `contextInjection(...)`, and `budget(...)`, then opens a session
through `fireline.session(...)` and stops it through `session.stop(...)`.

It deliberately does not use `memory()`, approval gates, webhook/Telegram
subscribers, retired HTTP launch helpers, or Fireline
internals.

The launch path uses `new Fireline({ endpoint })`, `new Agent(...)`, and
`acp.inlineJsBundle(...)` for the fixture agent payload. The middleware
builders remain the focused surface under test.

## Run

Fresh daemon:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-30-fresh-state
export FIRELINE_PORT=4630
export FIRELINE_STREAMS_PORT=7730
export FIRELINE_CONTROL_STREAM=fireline-middleware-stack-control
rm -rf "$FIRELINE_STATE_DIR"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
future-runtime-dev-after-mono-ug3b \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    MIDDLEWARE_STACK_RUN_ID="middleware-stack-run-001" \
    MIDDLEWARE_STACK_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/18-middleware-stack/src/run.ts"
```

Prior daemon reuse:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-30-reuse-state
export FIRELINE_PORT=4631
export FIRELINE_STREAMS_PORT=7731
export FIRELINE_CONTROL_STREAM=fireline-middleware-stack-control
mkdir -p "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
future-runtime-dev-after-mono-ug3b \
  --state-stream "$FIRELINE_CONTROL_STREAM"
# In a second shell:
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
MIDDLEWARE_STACK_RUN_ID="middleware-stack-reuse-001" \
MIDDLEWARE_STACK_ATTEMPT_ID="attempt-1" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
  "$FIRELINE_EXAMPLES_ROOT/examples/18-middleware-stack/src/run.ts"
```

Expected output includes:

- `ok: true`
- `middlewareKinds: ["trace", "contextInjection", "budget"]`
- a running launch row with runtime and session coordinates
- `stopStatus: "stopped"`
