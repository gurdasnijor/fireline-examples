# Cloudflare Worker Direct

Current Tier 1 direct Worker consumer. This is not an OpenNext or Next.js
adapter path. The Worker imports only package-shaped Fireline APIs:

- `@fireline/client/managed-agent`

The Worker uses `new Fireline({ endpoint })`, `new Agent(...)`,
`fireline.session(...)`, and `session.stop(...)`. `FIRELINE_ENDPOINT` is the
app-facing endpoint consumed by `new Fireline({ endpoint })`; the Worker does
not derive an endpoint from stream pieces.

## Local Dev

Run the Worker through native runtime dev so Fireline injects
`FIRELINE_ENDPOINT`. Wrangler local `[vars]` are not overridden by shell
environment variables, so pass the injected endpoint explicitly with `--var`:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-irzz-wave-b-08-fresh/state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 5544 \
  --streams-port 8581 \
  --launch-control-stream fireline-worker-direct-fresh -- \
  sh -c 'pnpm --dir "$EX" dlx wrangler@4.83.0 dev --config "$EX/examples/08-cloudflare-worker-direct/wrangler.toml" --port 8787 --var FIRELINE_ENDPOINT:"$FIRELINE_ENDPOINT"'
```

For prior-daemon reuse, keep a native runtime-dev process alive, then run the
Worker through a second native runtime-dev command on the same state and ports:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-irzz-wave-b-08-reuse/state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 5609 \
  --streams-port 8609 \
  --launch-control-stream fireline-worker-direct-reuse -- \
  sh -c 'sleep 600'
```

In another shell:

```sh
cd /Users/gnijor/gurdasnijor/fireline-examples
export EX=$(pwd)
export STATE=/tmp/fireline-mono-irzz-wave-b-08-reuse/state
FIRELINE_STATE_DIR="$STATE" \
fireline runtime dev \
  --port 5609 \
  --streams-port 8609 \
  --launch-control-stream fireline-worker-direct-reuse -- \
  sh -c 'pnpm --dir "$EX" dlx wrangler@4.83.0 dev --config "$EX/examples/08-cloudflare-worker-direct/wrangler.toml" --port 8788 --var FIRELINE_ENDPOINT:"$FIRELINE_ENDPOINT"'
```

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

The Worker launches, observes, and stops through
`@fireline/client/managed-agent`. It does not import Fireline source internals.

## Wave B Evidence

Fresh-daemon and prior-daemon reuse artifacts are written under
`/tmp/fireline-mono-irzz-wave-b-08-*` during local validation.
