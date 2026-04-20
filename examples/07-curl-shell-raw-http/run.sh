#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
CONTROL_STREAM=${FIRELINE_CONTROL_STREAM:-fireline-curl-shell-raw-control}
STREAMS_PORT=${FIRELINE_STREAMS_PORT:-7474}
RUN_ID=${FIRELINE_RAW_HTTP_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}
OUTPUT_ROOT=${FIRELINE_EXAMPLE_OUTPUT_ROOT:-${TMPDIR:-/tmp}/fireline-examples}
WORK_DIR="$OUTPUT_ROOT/07-curl-shell-raw-http/$RUN_ID"

stream_next_offset() {
  awk 'tolower($1) == "stream-next-offset:" { print $2 }' "$1" | tr -d '\r'
}

if [ "${FIRELINE_LAUNCH_CONTROL_STREAM_URL:-}" ]; then
  STREAM_URL=$FIRELINE_LAUNCH_CONTROL_STREAM_URL
elif [ "${FIRELINE_DURABLE_STREAMS_URL:-}" ]; then
  STREAM_BASE=${FIRELINE_DURABLE_STREAMS_URL%/}
  STREAM_URL="$STREAM_BASE/$CONTROL_STREAM"
else
  STREAM_URL="http://127.0.0.1:$STREAMS_PORT/v1/stream/$CONTROL_STREAM"
fi

export FIRELINE_RAW_HTTP_LAUNCH_ID=${FIRELINE_RAW_HTTP_LAUNCH_ID:-raw-http-$RUN_ID}
export FIRELINE_RAW_HTTP_CLIENT_REQUEST_ID=${FIRELINE_RAW_HTTP_CLIENT_REQUEST_ID:-launch:raw-http:$RUN_ID}
export FIRELINE_RAW_HTTP_STATE_STREAM=${FIRELINE_RAW_HTTP_STATE_STREAM:-raw-http-session-$RUN_ID}
export FIRELINE_RAW_HTTP_REQUESTED_BY=${FIRELINE_RAW_HTTP_REQUESTED_BY:-examples/07-curl-shell-raw-http}
export FIRELINE_RAW_HTTP_WAIT_TIMEOUT_MS=${FIRELINE_RAW_HTTP_WAIT_TIMEOUT_MS:-60000}

mkdir -p "$WORK_DIR"

launch_json="$WORK_DIR/launch-request.json"
stop_json="$WORK_DIR/launch-stop.json"
launch_headers="$WORK_DIR/launch-response.headers"
stop_headers="$WORK_DIR/stop-response.headers"
launch_body="$WORK_DIR/launch-response.body"
stop_body="$WORK_DIR/stop-response.body"
observed_launch="$WORK_DIR/observed-launch.json"
observed_stop="$WORK_DIR/observed-stop.json"

node "$SCRIPT_DIR/make-envelope.mjs" launch > "$launch_json"

printf 'append fireline.launch_request to %s\n' "$STREAM_URL"
curl -fsS -X POST "$STREAM_URL" \
  -D "$launch_headers" \
  -o "$launch_body" \
  -H 'Content-Type: application/json' \
  --data-binary @"$launch_json"
printf 'launch append next offset: %s\n' "$(stream_next_offset "$launch_headers")"

printf 'observe collections.launches row for %s\n' "$FIRELINE_RAW_HTTP_LAUNCH_ID"
node "$SCRIPT_DIR/observe-launches.mjs" \
  --stream-url "$STREAM_URL" \
  --launch-id "$FIRELINE_RAW_HTTP_LAUNCH_ID" \
  --until session \
  --timeout-ms "$FIRELINE_RAW_HTTP_WAIT_TIMEOUT_MS" \
  > "$observed_launch"
cat "$observed_launch"

node "$SCRIPT_DIR/make-envelope.mjs" stop > "$stop_json"

printf 'append fireline.launch_stop to %s\n' "$STREAM_URL"
curl -fsS -X POST "$STREAM_URL" \
  -D "$stop_headers" \
  -o "$stop_body" \
  -H 'Content-Type: application/json' \
  --data-binary @"$stop_json"
printf 'stop append next offset: %s\n' "$(stream_next_offset "$stop_headers")"

printf 'observe stopped collections.launches row for %s\n' "$FIRELINE_RAW_HTTP_LAUNCH_ID"
node "$SCRIPT_DIR/observe-launches.mjs" \
  --stream-url "$STREAM_URL" \
  --launch-id "$FIRELINE_RAW_HTTP_LAUNCH_ID" \
  --until stopped \
  --timeout-ms "$FIRELINE_RAW_HTTP_WAIT_TIMEOUT_MS" \
  > "$observed_stop"
cat "$observed_stop"

printf 'raw HTTP example artifacts: %s\n' "$WORK_DIR"
