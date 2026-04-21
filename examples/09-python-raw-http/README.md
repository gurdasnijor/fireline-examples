# Python Raw HTTP

This example is a Python external consumer for Fireline's raw Durable Streams
HTTP launch/control surface. It uses Python stdlib only: no `@fireline/client`,
no TypeScript helper package, no Fireline source imports, and no retired
launch HTTP route.

The flow is:

1. derive `FIRELINE_ENDPOINT` from explicit config, a durable
   streams base URL, or local `FIRELINE_STREAMS_PORT` plus `FIRELINE_CONTROL_STREAM`;
2. build a JSON `fireline.launch_request` envelope with a local inline JS
   module agent bundle;
3. append the request with `urllib.request` `POST`;
4. observe first-class `fireline.launch` rows on the same stream as the raw
   backing rows for `collections.launches`;
5. append `fireline.launch_stop` with `POST`;
6. observe the stopped `fireline.launch` row.

Run it with the local runtime helper:

```sh
pnpm run smoke:python-raw-http
```

The script derives these defaults when they are not set:

- `FIRELINE_CONTROL_STREAM=fireline-python-raw-control`
- `FIRELINE_STREAMS_PORT=7474`
- `FIRELINE_ENDPOINT=http://127.0.0.1:$FIRELINE_STREAMS_PORT/v1/stream/$FIRELINE_CONTROL_STREAM`
- `FIRELINE_PYTHON_RAW_RUN_ID=<utc timestamp>-<pid>`
- `FIRELINE_PYTHON_RAW_LAUNCH_ID=python-raw-$FIRELINE_PYTHON_RAW_RUN_ID`
- `FIRELINE_PYTHON_RAW_CLIENT_REQUEST_ID=launch:python-raw:$FIRELINE_PYTHON_RAW_RUN_ID`
- `FIRELINE_PYTHON_RAW_STATE_STREAM=python-raw-session-$FIRELINE_PYTHON_RAW_RUN_ID`

Generated request, stop, response, and observation files are written under
`${FIRELINE_EXAMPLE_OUTPUT_ROOT:-${TMPDIR:-/tmp}/fireline-examples}` so the
example does not create persistent repo state by default.

## Reviewer Recipe

Fresh daemon:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples-be3-mono-oet-29-3-8-python-raw-http
export FIRELINE_CONTROL_STREAM=fireline-python-raw-review-fresh
export FIRELINE_STREAMS_PORT=7588
export FIRELINE_PORT=7788
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-8-fresh-state
export FIRELINE_EXAMPLE_OUTPUT_ROOT=/tmp/fireline-mono-oet-29-3-8-fresh-output
export FIRELINE_LOG=/tmp/fireline-mono-oet-29-3-8-fresh.log
rm -rf "$FIRELINE_STATE_DIR" "$FIRELINE_EXAMPLE_OUTPUT_ROOT"
pnpm run smoke:python-raw-http > "$FIRELINE_LOG" 2>&1
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
cd /Users/gnijor/gurdasnijor/fireline-examples-be3-mono-oet-29-3-8-python-raw-http
export FIRELINE_CONTROL_STREAM=fireline-python-raw-review-reuse
export FIRELINE_STREAMS_PORT=7589
export FIRELINE_PORT=7789
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-8-reuse-state
export FIRELINE_EXAMPLE_OUTPUT_ROOT=/tmp/fireline-mono-oet-29-3-8-reuse-output
export FIRELINE_LOG=/tmp/fireline-mono-oet-29-3-8-reuse.log
rm -rf "$FIRELINE_STATE_DIR" "$FIRELINE_EXAMPLE_OUTPUT_ROOT"
fireline runtime dev --launch-control-stream "$FIRELINE_CONTROL_STREAM" -- sh -c \
  'python3 examples/09-python-raw-http/run.py && FIRELINE_PYTHON_RAW_RUN_ID=reuse-second python3 examples/09-python-raw-http/run.py' \
  > "$FIRELINE_LOG" 2>&1
code=$?
kill $(ps -axo pid,command | awk "/$FIRELINE_CONTROL_STREAM|--port $FIRELINE_STREAMS_PORT|--port $FIRELINE_PORT/ && !/awk/ { print \\$1 }") 2>/dev/null || true
test "$code" -eq 0
test "$(grep -c '"status": "stopped"' "$FIRELINE_LOG")" -ge 2
grep -q 'python-raw-reuse-second' "$FIRELINE_LOG"
tail -n 60 "$FIRELINE_LOG"
```

Expected output includes JSON summaries with `"status": "stopped"`,
non-empty `launchAppendNextOffset` and `stopAppendNextOffset`, and artifact
paths under the configured `/tmp/fireline-mono-oet-29-3-8-*` output root.

To point at a provisioned stream instead, set the exact stream URL:

```sh
FIRELINE_ENDPOINT='https://streams.example.com/v1/stream/app-launch-control' \
  python3 examples/09-python-raw-http/run.py
```

If a deployment gives only a Durable Streams append base, pass the base and an
explicit stream name:

```sh
FIRELINE_DURABLE_STREAMS_URL='https://streams.example.com/v1/stream' \
FIRELINE_CONTROL_STREAM='app-launch-control' \
  python3 examples/09-python-raw-http/run.py
```
