# Rust Raw HTTP

This example is a Rust external consumer for Fireline's raw Durable Streams
HTTP launch/control surface. It uses `reqwest`, `tokio`, and `serde_json`
against HTTP only: no Fireline Rust crates, no Fireline source imports, no
`@fireline/client`, and no retired launch HTTP route.

The flow is:

1. derive `FIRELINE_LAUNCH_CONTROL_STREAM_URL` from explicit config, a durable
   streams base URL, or local `FIRELINE_STREAMS_PORT` plus `FIRELINE_CONTROL_STREAM`;
2. build a JSON `fireline.launch_request` envelope with a local inline JS
   module agent bundle;
3. append the request with raw HTTP `POST`;
4. observe first-class `fireline.launch` rows on the same stream as the raw
   backing rows for `collections.launches`;
5. append `fireline.launch_stop` with `POST`;
6. observe the stopped `fireline.launch` row.

Run it with the local runtime helper:

```sh
pnpm run smoke:rust-raw-http
```

The script derives these defaults when they are not set:

- `FIRELINE_CONTROL_STREAM=fireline-rust-raw-control`
- `FIRELINE_STREAMS_PORT=7474`
- `FIRELINE_LAUNCH_CONTROL_STREAM_URL=http://127.0.0.1:$FIRELINE_STREAMS_PORT/v1/stream/$FIRELINE_CONTROL_STREAM`
- `FIRELINE_RUST_RAW_RUN_ID=<utc timestamp>-<pid>`
- `FIRELINE_RUST_RAW_LAUNCH_ID=rust-raw-$FIRELINE_RUST_RAW_RUN_ID`
- `FIRELINE_RUST_RAW_CLIENT_REQUEST_ID=launch:rust-raw:$FIRELINE_RUST_RAW_RUN_ID`
- `FIRELINE_RUST_RAW_STATE_STREAM=rust-raw-session-$FIRELINE_RUST_RAW_RUN_ID`

Generated request, stop, response, and observation files are written under
`${FIRELINE_EXAMPLE_OUTPUT_ROOT:-${TMPDIR:-/tmp}/fireline-examples}` so the
example does not create persistent repo state by default. Cargo output should
also stay outside the repo by setting `CARGO_TARGET_DIR`.

## Reviewer Recipe

Fresh daemon:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples-be3-mono-oet-29-3-9-rust-raw-http
export FIRELINE_CONTROL_STREAM=fireline-rust-raw-review-fresh
export FIRELINE_STREAMS_PORT=7593
export FIRELINE_PORT=7793
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-9-fresh-state
export FIRELINE_EXAMPLE_OUTPUT_ROOT=/tmp/fireline-mono-oet-29-3-9-fresh-output
export CARGO_TARGET_DIR=/tmp/fireline-mono-oet-29-3-9-target
export FIRELINE_LOG=/tmp/fireline-mono-oet-29-3-9-fresh.log
rm -rf "$FIRELINE_STATE_DIR" "$FIRELINE_EXAMPLE_OUTPUT_ROOT" "$CARGO_TARGET_DIR"
pnpm run smoke:rust-raw-http > "$FIRELINE_LOG" 2>&1
code=$?
kill $(ps -axo pid,command | awk "/$FIRELINE_CONTROL_STREAM|--port $FIRELINE_STREAMS_PORT|--port $FIRELINE_PORT/ && !/awk/ { print \\$1 }") 2>/dev/null || true
test "$code" -eq 0
grep -q '"status": "stopped"' "$FIRELINE_LOG"
grep -q '"launchAppendNextOffset": "' "$FIRELINE_LOG"
grep -q '"stopAppendNextOffset": "' "$FIRELINE_LOG"
tail -n 40 "$FIRELINE_LOG"
```

Reuse one already-running daemon for two launches:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples-be3-mono-oet-29-3-9-rust-raw-http
export FIRELINE_CONTROL_STREAM=fireline-rust-raw-review-reuse
export FIRELINE_STREAMS_PORT=7594
export FIRELINE_PORT=7794
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-9-reuse-state
export FIRELINE_EXAMPLE_OUTPUT_ROOT=/tmp/fireline-mono-oet-29-3-9-reuse-output
export CARGO_TARGET_DIR=/tmp/fireline-mono-oet-29-3-9-target
export FIRELINE_LOG=/tmp/fireline-mono-oet-29-3-9-reuse.log
rm -rf "$FIRELINE_STATE_DIR" "$FIRELINE_EXAMPLE_OUTPUT_ROOT" "$CARGO_TARGET_DIR"
future-runtime-dev-after-mono-ug3b --state-stream "$FIRELINE_CONTROL_STREAM" -- sh -c \
  'cargo run --quiet --manifest-path examples/10-rust-raw-http/Cargo.toml && FIRELINE_RUST_RAW_RUN_ID=reuse-second cargo run --quiet --manifest-path examples/10-rust-raw-http/Cargo.toml' \
  > "$FIRELINE_LOG" 2>&1
code=$?
kill $(ps -axo pid,command | awk "/$FIRELINE_CONTROL_STREAM|--port $FIRELINE_STREAMS_PORT|--port $FIRELINE_PORT/ && !/awk/ { print \\$1 }") 2>/dev/null || true
test "$code" -eq 0
test "$(grep -c '"status": "stopped"' "$FIRELINE_LOG")" -ge 2
grep -q 'rust-raw-reuse-second' "$FIRELINE_LOG"
tail -n 60 "$FIRELINE_LOG"
```

Expected output includes JSON summaries with `"status": "stopped"`,
non-empty `launchAppendNextOffset` and `stopAppendNextOffset`, and artifact
paths under the configured `/tmp/fireline-mono-oet-29-3-9-*` output root.

To point at a provisioned stream instead, set the exact stream URL:

```sh
FIRELINE_LAUNCH_CONTROL_STREAM_URL='https://streams.example.com/v1/stream/app-launch-control' \
  cargo run --manifest-path examples/10-rust-raw-http/Cargo.toml
```

If a deployment gives only a Durable Streams append base, pass the base and an
explicit stream name:

```sh
FIRELINE_DURABLE_STREAMS_URL='https://streams.example.com/v1/stream' \
FIRELINE_CONTROL_STREAM='app-launch-control' \
  cargo run --manifest-path examples/10-rust-raw-http/Cargo.toml
```
