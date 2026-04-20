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

Integration policy:

- `main` is the reviewer and PO testing base. Once an examples bead is accepted,
  integrate it into `main` rather than leaving it only on a per-bead branch.
- Per-bead branches and worktrees are scratch space for implementation and
  evidence collection. They are not the durable handoff surface.
- Keep runnable examples on package-shaped Fireline refs. Do not switch this
  repo to Fireline source-tree imports to make local development easier.

Current checkpoint:

- `examples/01-inline-js-local` is TypeScript-authored and launches an inline
  JS local matrix through `@fireline/client/managed-agent` lifecycle helpers.
  Request construction uses `createManagedAgentLaunchRequest` and
  `inlineJsBundleAgent` from the managed-agent subpath.
- `examples/02-editable-agent-web` is a TypeScript/TSX app-shaped discovery
  example for the Tier 1 `@fireline/client/managed-agent` lifecycle helper. It
  lets a user edit inline agent code, launch through a managed-agent handle,
  inspect launch/session/runtime coordinates, send a follow-up ACP prompt
  through the handle, and stop the launch through the same handle.
- `examples/03-tanstack-shaped-app`, `examples/04-next-basic`, and
  `examples/05-next-open-cloudflare` are framework-shaped TypeScript discovery
  examples. They keep Fireline calls package-shaped and use
  `@fireline/client/managed-agent` for launch/wait/stop while recording
  framework seams instead of canonizing product examples. Request construction
  uses the managed-agent request helpers.
- `examples/06-flamecast-v3-shaped` is a black-box product-consumer
  characterization. It is not real Flamecast v3 code. It keeps a framework
  boundary separate from the Fireline adapter, generates a multi-file inline
  harness bundle, and uses `@fireline/client/managed-agent` for
  launch/wait/ACP follow-up/stop. Request construction uses the managed-agent
  request helpers.
- `examples/07-curl-shell-raw-http` is a shell/curl raw Durable Streams HTTP
  consumer. It builds the launch/stop envelopes locally, appends them with
  `curl`, and observes backing `fireline.launch` rows without Fireline helper
  packages.
- `examples/08-cloudflare-worker-direct` is a direct Cloudflare Worker
  consumer using `@fireline/client/managed-agent` for launch observation and
  stop. It uses managed-agent request and inline bundle builders. It uses
  explicit `pnpm dlx wrangler@4.83.0` commands and documents the Wrangler
  `--var` behavior required for custom scratch ports.
- `examples/09-python-raw-http`, `examples/10-rust-raw-http`, and
  `examples/15-go-raw-http` are raw Durable Streams HTTP consumers. They do
  not import Fireline packages, crates, or SDKs; they build
  `fireline.launch_request` / `fireline.launch_stop` envelopes and observe
  first-class `fireline.launch` rows over plain HTTP.
- `examples/11-server-worker-wrapper` is a server/Worker boundary pattern. The
  app-facing layer has no Fireline imports; the server wrapper owns auth,
  tenant checks, idempotency, and managed-agent launch/observe/stop calls.
- `examples/12-vercel-function-node` is a Vercel Functions Node-runtime shape.
  It uses `@fireline/client/managed-agent` inside a Node function for
  launch/observe/stop and managed-agent request construction.
- `examples/13-vercel-edge-runtime` is a Vercel Edge Runtime shape. It bundles
  an Edge handler that uses `@fireline/client/managed-agent` and
  managed-agent request builders, then runs locally in `@edge-runtime/vm`.
- `examples/14-bun` is a Bun runtime shape. It runs with `bun`, uses the root
  package-shaped Fireline refs, and uses the managed-agent launch handle.
- `examples/16-deno` is a Deno package-consumer shape. It uses documented
  `@fireline/client/managed-agent` through Deno's Node/npm compatibility layer.
- `examples/17-acp-registry-chat` resolves a safe ACP registry fixture row
  with `acpRegistry(...)` from `@fireline/client`, launches the resulting command
  distribution through `@fireline/client/managed-agent`, attaches to the
  returned ACP session, sends a follow-up prompt, and stops the launch. It
  deliberately avoids
  binary registry installs, launcher env metadata, retired launch-control
  surfaces, and hand-rolled lifecycle primitives.
- `examples/18-middleware-stack` is a focused middleware-stack consumer. It
  builds a normal stream-native launch with `trace(...)`,
  `contextInjection(...)`, and `budget(...)`, then launches and stops through
  `@fireline/client/managed-agent`. It deliberately avoids `memory()`,
  approval gates, launch-control HTTP, `/v1/launches`, Fireline internals, and
  hand-rolled lifecycle primitives.

Surface posture:

- Tier 1 canonical TypeScript app API:
  `@fireline/client/managed-agent`.
- Tier 2 protocol/runtime reference:
  raw Durable Streams HTTP plus the `@fireline/runtime` / `fireline-v3-dev`
  command path.
- Tier 3 primitive escape hatch:
  `@fireline/client/spec`, `@fireline/client/events`, `@fireline/state`, and
  `@fireline/client/acp-browser`.

Normal TypeScript app examples should use Tier 1 where the helper covers the
flow. Raw HTTP and language-neutral examples stay Tier 2 references. Tier 3
primitive usage is still allowed for escape-hatch evidence or explicit helper
gap discovery, but it is not the canonical app-facing path.

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
launch/control stream URL from the daemon handoff and uses
`@fireline/client/managed-agent` for inline agent request construction, launch
waiting, ACP attachment, and stop.
If you intentionally run the private Vite child script separately, it falls back to
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

The app gives `@fireline/client/managed-agent` the configured launch/control
stream URL and uses the returned handle for launch observation, ACP connection,
and stop. It does not call `/v1/launches`, use
`@fireline/client/launch-control`, or import managed-agent helpers from the
root `@fireline/client` barrel.

Managed-agent cutover note: examples 08, 11, 12, 13, 14, 16, 17, and 18 use
`@fireline/client/managed-agent` for normal app lifecycle consumption, including
`createManagedAgentLaunchRequest`, `inlineJsBundleAgent`, `jsModuleAgent`, and
`acpStdioAgent` where applicable.

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
pnpm run build:vercel-edge-runtime
```

The OpenNext/Cloudflare build uses the local adapter shape only. It is not a
deployment recipe.

Run the Vercel Functions Node shape from scratch state:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-12-state
export FIRELINE_PORT=4612
export FIRELINE_STREAMS_PORT=7712
export FIRELINE_CONTROL_STREAM=fireline-vercel-function-control
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    VERCEL_FUNCTION_RUN_ID="vercel-function-run-001" \
    VERCEL_FUNCTION_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/12-vercel-function-node/src/run-local.ts"
```

Run the Vercel Edge Runtime shape from scratch state:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-11-state
export FIRELINE_PORT=4614
export FIRELINE_STREAMS_PORT=7714
export FIRELINE_CONTROL_STREAM=fireline-vercel-edge-control
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    VERCEL_EDGE_RUN_ID="vercel-edge-run-001" \
    VERCEL_EDGE_ATTEMPT_ID="attempt-1" \
    sh -c 'pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run build:vercel-edge-runtime >/dev/null && pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx "$FIRELINE_EXAMPLES_ROOT/examples/13-vercel-edge-runtime/src/run-local.ts"'
```

Run the Bun runtime shape from scratch state:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-15-state
export FIRELINE_PORT=4615
export FIRELINE_STREAMS_PORT=7715
export FIRELINE_CONTROL_STREAM=fireline-bun-control
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    BUN_EXAMPLE_RUN_ID="bun-run-001" \
    BUN_EXAMPLE_ATTEMPT_ID="attempt-1" \
    bun "$FIRELINE_EXAMPLES_ROOT/examples/14-bun/src/run.ts"
```

Run the Go raw Durable Streams HTTP shape from scratch state:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-16-go-state
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
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_EXAMPLE_OUTPUT_ROOT" \
    go run "$FIRELINE_EXAMPLES_ROOT/examples/15-go-raw-http/main.go"
```

Run the Deno package-consumer shape from scratch state:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-14-state
export FIRELINE_PORT=4616
export FIRELINE_STREAMS_PORT=7716
export FIRELINE_CONTROL_STREAM=fireline-deno-control
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    DENO_EXAMPLE_RUN_ID="deno-run-001" \
    DENO_EXAMPLE_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec deno run \
      --node-modules-dir=manual \
      --allow-net=127.0.0.1 \
      --allow-env=FIRELINE_LAUNCH_CONTROL_STREAM_URL,FIRELINE_DURABLE_STREAMS_URL,FIRELINE_STREAMS_PORT,FIRELINE_CONTROL_STREAM,DENO_EXAMPLE_TENANT_ID,DENO_EXAMPLE_RUN_ID,DENO_EXAMPLE_ATTEMPT_ID,DENO_EXAMPLE_PROMPT,NODE_ENV \
      "$FIRELINE_EXAMPLES_ROOT/examples/16-deno/main.ts"
```

Run the ACP registry chat shape from scratch state:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-17-fresh-state
export FIRELINE_PORT=4617
export FIRELINE_STREAMS_PORT=7717
export FIRELINE_CONTROL_STREAM=fireline-acp-registry-chat-control
rm -rf "$FIRELINE_STATE_DIR"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    ACP_REGISTRY_CHAT_RUN_ID="registry-chat-run-001" \
    ACP_REGISTRY_CHAT_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/17-acp-registry-chat/src/run.ts"
```

Run the middleware stack shape from scratch state:

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
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    MIDDLEWARE_STACK_RUN_ID="middleware-stack-run-001" \
    MIDDLEWARE_STACK_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/18-middleware-stack/src/run.ts"
```

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
      "$FIRELINE_EXAMPLES_ROOT/examples/11-server-worker-wrapper/src/run.ts"
```
