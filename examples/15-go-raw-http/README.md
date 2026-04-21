# Go Raw Durable Streams HTTP

This is a plain Go raw Durable Streams HTTP consumer. It does not use a
Fireline Go SDK, Fireline packages, Fireline source imports, legacy launch
HTTP endpoints, or launch-control HTTP.

The example builds `fireline.launch_request` and `fireline.launch_stop`
envelopes locally, appends them with `net/http`, and observes first-class
`fireline.launch` rows by reading the configured Durable Streams URL.

## Fresh Daemon

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-go-raw-fresh-state
export FIRELINE_PORT=4626
export FIRELINE_STREAMS_PORT=7726
export FIRELINE_CONTROL_STREAM=fireline-go-raw-control
export FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_STATE_DIR/output"
rm -rf "$FIRELINE_STATE_DIR"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
future-runtime-dev-after-mono-ug3b \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_EXAMPLE_OUTPUT_ROOT" \
    go run "$FIRELINE_EXAMPLES_ROOT/examples/15-go-raw-http/main.go"
```

Expected: JSON summary with `example: "15-go-raw-http"`, a launch row that
reached `session_ready`, final `status: "stopped"`, and artifact paths under
`$FIRELINE_EXAMPLE_OUTPUT_ROOT/15-go-raw-http/<run-id>/`.

## Prior Daemon Reuse

Start the daemon once:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-go-raw-reuse-state
export FIRELINE_PORT=4627
export FIRELINE_STREAMS_PORT=7727
export FIRELINE_CONTROL_STREAM=fireline-go-raw-control
export FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_STATE_DIR/output"
rm -rf "$FIRELINE_STATE_DIR"
mkdir -p "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
future-runtime-dev-after-mono-ug3b \
  --state-stream "$FIRELINE_CONTROL_STREAM"
```

In a second shell, reuse it:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-go-raw-reuse-state
export FIRELINE_PORT=4627
export FIRELINE_STREAMS_PORT=7727
export FIRELINE_CONTROL_STREAM=fireline-go-raw-control
export FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_STATE_DIR/output"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
future-runtime-dev-after-mono-ug3b \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_EXAMPLE_OUTPUT_ROOT" \
    go run "$FIRELINE_EXAMPLES_ROOT/examples/15-go-raw-http/main.go"
```

Expected: the historical runtime dev wrapper reports reused daemon/streams health checks, and
the Go program returns the same JSON shape as the fresh-daemon run.

## Configuration

- `FIRELINE_LAUNCH_CONTROL_STREAM_URL`: exact Durable Streams append/read URL.
- `FIRELINE_DURABLE_STREAMS_URL`: base URL ending in `/v1/stream`; the example
  appends `/<FIRELINE_CONTROL_STREAM>`.
- `FIRELINE_CONTROL_STREAM`: control stream name. Defaults to
  `fireline-go-raw-control`.
- `FIRELINE_STREAMS_PORT`: local streams port when deriving
  `http://127.0.0.1:<port>/v1/stream/<control-stream>`.
- `FIRELINE_GO_RAW_*`: example-only overrides for run id, launch id,
  client-request id, state stream, requested-by, prompt, timeout, stop id, and
  stop reason.
- `FIRELINE_EXAMPLE_OUTPUT_ROOT`: artifact output root. Use `/tmp` scratch
  paths for reviewer runs.
