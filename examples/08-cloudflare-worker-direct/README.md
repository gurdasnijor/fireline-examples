# Cloudflare Worker Direct

Discovery-only direct Worker consumer. This is not an OpenNext or Next.js
adapter path. The Worker imports only package-shaped Fireline APIs:

- `@fireline/client/spec`
- `@fireline/client/events`
- `@fireline/state`

Run the local Fireline daemon from scratch state:

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

Run the Worker in another shell:

```sh
pnpm dlx wrangler@4.83.0 dev --config examples/08-cloudflare-worker-direct/wrangler.toml
```

The Worker derives the launch/control stream URL from the same defaults used by
the daemon:

```sh
export FIRELINE_LAUNCH_CONTROL_STREAM_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT:-7474}/v1/stream/${FIRELINE_CONTROL_STREAM:-fireline-worker-direct-control}"
```

For custom ports or stream names, pass `FIRELINE_STREAMS_PORT`,
`FIRELINE_CONTROL_STREAM`, `FIRELINE_DURABLE_STREAMS_URL`, or the exact
`FIRELINE_LAUNCH_CONTROL_STREAM_URL` through Wrangler vars.

Exercise launch and stop in one request:

```sh
curl -sS -X POST http://127.0.0.1:8787/demo \
  -H 'content-type: application/json' \
  --data '{"prompt":"run the direct Worker example"}'
```

Or run the two steps explicitly:

```sh
curl -sS -X POST http://127.0.0.1:8787/launch \
  -H 'content-type: application/json' \
  --data '{"prompt":"run the direct Worker example"}'

curl -sS -X POST http://127.0.0.1:8787/stop \
  -H 'content-type: application/json' \
  --data '{"launchId":"<launch-id>","clientRequestId":"<client-request-id>"}'
```

The Worker appends `fireline.launch_request`, reads
`@fireline/state` `collections.launches`, appends `fireline.launch_stop`, and
reads the stopped launch row. It does not call the legacy launch HTTP route,
import the old launch-control client subpath, or import Fireline source
internals.
