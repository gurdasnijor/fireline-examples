# API Surface

This file lists every Fireline import, package ref, command, environment
variable, binary, and endpoint used by this discovery repo.

## Package Refs

- `@fireline/client`: `git+ssh://git@github.com/smithery-ai/fireline.git#fireline-client-artifact-96489bb3b55124c2d313282e723a775d7fe8c9dd`
- `@fireline/runtime`: `git+ssh://git@github.com/smithery-ai/fireline.git#fireline-runtime-artifact-96489bb3b55124c2d313282e723a775d7fe8c9dd`
- `@fireline/state`: `git+ssh://git@github.com/smithery-ai/fireline.git#fireline-state-artifact-96489bb3b55124c2d313282e723a775d7fe8c9dd`

These are immutable git artifact refs from the pre-npm package artifact
channel. They are package-shaped and reviewer-installable without local
tarball staging. They are not registry-published refs and do not freeze public
npm package names.

## Fireline Imports

- `@fireline/client/spec`
  - `inlineBundleArtifact`
  - `jsModuleAgentForm`
  - `agentDefinition`
  - `launchSpec`
  - `newSessionRequest`
  - `textPrompt`
- `@fireline/client/events`
  - `appendLaunchRequest`
  - `appendLaunchStop`
  - `LaunchRequestEnvelope`
  - `LaunchStopEnvelope`
- `@fireline/state`
  - `createFirelineDB`
  - `FirelineDB`
  - `LaunchRow`
- `@fireline/client/middleware`
  - `trace`
  - `contextInjection`
  - `budget`
- `@fireline/client/acp-browser`
  - `connectBrowserAcp`
  - `BrowserAcpConnection`
- `@fireline/client`
  - default `fireline`
  - `fireline.appendLaunchRequest`
  - `fireline.db`

Examples do not import `@fireline/client/launch-control`, runtime internals,
or private package source. The target launch path appends
`fireline.launch_request` and `fireline.launch_stop` to the configured control
stream and observes launch rows through `@fireline/state` collections or the
root `fireline.db(...)` wrapper.

## Framework Imports

- `@tanstack/react-router`
  - `RouterProvider`
  - `createRootRoute`
  - `createRoute`
  - `createRouter`
- `@tanstack/react-query`
  - `QueryClient`
  - `QueryClientProvider`
  - `useMutation`
- `next`
  - Next.js app router build/dev commands for `examples/04-next-basic` and
    `examples/05-next-open-cloudflare`
- `@opennextjs/cloudflare`
  - `initOpenNextCloudflareForDev`
  - `defineCloudflareConfig`
- `@edge-runtime/vm`
  - `EdgeVM`

## Retired Internal Resolution

Before Fireline PR #300 / `mono-oet.29.25.4`, runtime inline JS launches
resolved a private client subpath for the JS module runner. That dependency is
retired. Current examples do not import or configure any Fireline internal
subpath, and the surface checker treats private Fireline subpaths as
violations.

## Commands And Binaries

- `pnpm install`
- `pnpm run check`
- `pnpm run typecheck`
- `pnpm run check:surface`
- `pnpm run smoke:inline-js-local`
- `pnpm run smoke:server-wrapper`
- `pnpm run smoke:curl-shell-raw-http`
- `pnpm run smoke:python-raw-http`
- `pnpm run smoke:rust-raw-http`
- `pnpm run smoke:go-raw-http`
- `pnpm run check:deno`
- `pnpm run smoke:deno`
- `pnpm run dev:editable-agent-web`
- `pnpm run build:editable-agent-web`
- `pnpm run build:tanstack-shaped`
- `pnpm run build:next-basic`
- `pnpm run build:next-open-cloudflare`
- `pnpm run build:opennext-cloudflare`
- `pnpm run build:vercel-edge-runtime`
- `pnpm run smoke:flamecast-shaped`
- `pnpm run smoke:vercel-edge-runtime`
- `pnpm run smoke:bun`
- `pnpm run dev:cloudflare-worker-direct`
- `pnpm exec fireline-v3-dev --state-stream <control-stream>`
- `pnpm dlx wrangler@4.83.0 dev --config examples/08-cloudflare-worker-direct/wrangler.toml`
- `tsx examples/01-inline-js-local/run.ts`
- `tsx examples/06-flamecast-v3-shaped/src/run.ts`
- `sh examples/07-curl-shell-raw-http/run.sh`
- `tsx examples/11-server-worker-wrapper/src/run.ts`
- `tsx examples/12-vercel-function-node/src/run-local.ts`
- `tsx examples/13-vercel-edge-runtime/src/run-local.ts`
- `bun examples/14-bun/src/run.ts`
- `deno run --node-modules-dir=manual examples/16-deno/main.ts`
- `python3 examples/09-python-raw-http/run.py`
- `cargo run --manifest-path examples/10-rust-raw-http/Cargo.toml`
- `go run examples/15-go-raw-http/main.go`
- `fireline-v3-dev` wrapping `vite` through `pnpm run dev:editable-agent-web`
- `vite` through the private Vite child script
- `vite` through the Vite example scripts
- `next dev` through the Next framework scripts
- `next build` through the Next framework scripts
- `opennextjs-cloudflare build` through `pnpm run build:opennext-cloudflare`
- `fireline-v3-dev` from `@fireline/runtime`
- `fireline` via the `@fireline/runtime` shim
- `fireline-streams` via the `@fireline/runtime` shim
- `bun`
- `deno`

## Environment Variables

- `FIRELINE_LAUNCH_CONTROL_STREAM_URL`: read by examples 01-03 and passed into
  the Next-shaped examples as `controlStreamUrl`. Example 06 accepts it as the
  highest-precedence exact launch/control stream append target. The
  `dev:editable-agent-web` script maps this daemon handoff to
  `VITE_FIRELINE_LAUNCH_CONTROL_STREAM_URL` when Vite is run as a
  `fireline-v3-dev` child.
- `VITE_FIRELINE_LAUNCH_CONTROL_STREAM_URL`: optional Vite dev/build seed for
  examples 02-03. Example 02's public dev command starts through
  `fireline-v3-dev`, so this value should normally be injected from
  `FIRELINE_LAUNCH_CONTROL_STREAM_URL`. The private Vite child script still
  defaults to `http://127.0.0.1:7474/v1/stream/fireline-examples-control` when
  this is not set, and exposes mismatch recovery guidance when a reused daemon
  does not watch that stream.
- `VITE_FIRELINE_STREAMS_PORT`: optional example 02 Vite seed for deriving the
  launch/control stream URL when the local streams server is not on `7474`.
- `VITE_FIRELINE_CONTROL_STREAM`: optional example 02 Vite seed for deriving
  the launch/control stream URL when the local control stream name is not
  `fireline-examples-control`.
- `FIRELINE_DURABLE_STREAMS_URL`: optional durable streams append base ending
  in `/v1/stream`. Examples 06, 08, 11-14, and 16 append
  `/<FIRELINE_CONTROL_STREAM>` to this base when the exact launch/control
  stream URL is not provided.
- `FIRELINE_CONTROL_STREAM`: README helper variable used only to align the
  local `fireline-v3-dev --state-stream` process with the full control stream
  URL. Examples 06, 08, 11-14, and 16 also use it to derive the launch/control
  stream URL when `FIRELINE_LAUNCH_CONTROL_STREAM_URL` is not set.
- `FIRELINE_PORT`: set in scratch smoke recipes to avoid reusing another local
  daemon on the default port.
- `FIRELINE_STREAMS_PORT`: set in scratch smoke recipes to avoid reusing
  another local streams server on the default port.
- `FIRELINE_EXAMPLE_OUTPUT_ROOT`: example-only output directory for local
  filesystem writes. Set to the scratch state directory in the documented
  smoke recipe so generated output does not land under the repo.
- `FIRELINE_STATE_DIR`: scratch-directory convention for this spike.
- `FIRELINE_EXAMPLES_ROOT`: helper variable in the README recipe only.
- `FIRELINE_RAW_HTTP_*`: example-only run, launch, client-request,
  state-stream, requested-by, prompt, timeout, stop-id, and stop-reason
  overrides for `examples/07-curl-shell-raw-http`.
- `FIRELINE_PYTHON_RAW_*`: example-only run, launch, client-request,
  state-stream, requested-by, prompt, timeout, stop-id, and stop-reason
  overrides for `examples/09-python-raw-http`.
- `FIRELINE_RUST_RAW_*`: example-only run, launch, client-request,
  state-stream, requested-by, prompt, timeout, stop-id, and stop-reason
  overrides for `examples/10-rust-raw-http`.
- `FIRELINE_GO_RAW_*`: example-only run, launch, client-request,
  state-stream, requested-by, prompt, timeout, stop-id, and stop-reason
  overrides for `examples/15-go-raw-http`.
- `DENO_EXAMPLE_*`: example-only tenant, run, attempt, and prompt overrides
  for `examples/16-deno`.
- `CARGO_TARGET_DIR`: reviewer-recipe scratch target directory for
  `examples/10-rust-raw-http`, set under `/tmp` so Cargo output does not land
  in the repo.
- `FIRELINE_V3_DEV`: example-only dev-script override for local evidence runs
  that need to point at a checked-out `fireline-v3-dev` wrapper before package
  artifacts are refreshed. Normal consumers use the package-provided
  `fireline-v3-dev` binary.
- `FLAMECAST_WORKSPACE_ID`: example-only product workspace coordinate passed
  through the Flamecast-shaped adapter into the generated runtime shim.
- `FLAMECAST_RUN_ID`: example-only product run coordinate. Reuse it for retries
  of the same run.
- `FLAMECAST_ATTEMPT_ID`: example-only product attempt coordinate. Reuse it for
  retries of the same attempt; change it for a new attempt.
- `FLAMECAST_TITLE`: optional example-only composition title.
- `FLAMECAST_SCENE_COUNT`: optional example-only scene count.
- `FLAMECAST_TONE`: optional `brief` or `detailed` example-only tone.
- `FLAMECAST_REQUESTED_BY`: optional `requestedBy` override for the
  `fireline.launch_request` and `fireline.launch_stop` envelopes.
- `FLAMECAST_FOLLOW_UP_PROMPT`: optional ACP follow-up prompt for
  `examples/06-flamecast-v3-shaped`.
- `APP_AUTH_TOKEN`: example-only server/Worker bearer token expected by
  `examples/11-server-worker-wrapper`. Defaults to `server-wrapper-demo-token`.
- `APP_TENANT_ID`: example-only tenant coordinate. The server wrapper verifies
  it matches the authenticated actor before appending to Fireline.
- `APP_USER_ID`: example-only authenticated actor coordinate.
- `APP_DOCUMENT_ID`: example-only product document coordinate used in stable
  `clientRequestId` and launch labels.
- `APP_RUN_ID`: example-only product run coordinate. Reuse it for retries of
  the same run.
- `APP_ATTEMPT_ID`: example-only product attempt coordinate. Reuse it for
  retries of the same attempt; change it for a new attempt.
- `APP_TITLE`: optional example-only title for the server wrapper launch.
- `APP_PROMPT`: optional example-only initial prompt for the generated agent.
- `VERCEL_FUNCTION_TENANT_ID`: example-only Vercel Function tenant
  coordinate.
- `VERCEL_FUNCTION_RUN_ID`: example-only Vercel Function run coordinate. Reuse
  it for retries of the same run.
- `VERCEL_FUNCTION_ATTEMPT_ID`: example-only Vercel Function attempt
  coordinate. Reuse it for retries of the same attempt; change it for a new
  attempt.
- `VERCEL_FUNCTION_PROMPT`: optional example-only initial prompt for the
  Vercel Function Node launch.
- `VERCEL_EDGE_TENANT_ID`: example-only Vercel Edge Runtime tenant
  coordinate.
- `VERCEL_EDGE_RUN_ID`: example-only Vercel Edge Runtime run coordinate. Reuse
  it for retries of the same run.
- `VERCEL_EDGE_ATTEMPT_ID`: example-only Vercel Edge Runtime attempt
  coordinate. Reuse it for retries of the same attempt; change it for a new
  attempt.
- `VERCEL_EDGE_PROMPT`: optional example-only initial prompt for the Vercel
  Edge Runtime launch.
- `BUN_EXAMPLE_TENANT_ID`: example-only Bun tenant coordinate.
- `BUN_EXAMPLE_RUN_ID`: example-only Bun run coordinate. Reuse it for retries
  of the same run.
- `BUN_EXAMPLE_ATTEMPT_ID`: example-only Bun attempt coordinate. Reuse it for
  retries of the same attempt; change it for a new attempt.
- `BUN_EXAMPLE_PROMPT`: optional example-only initial prompt for the Bun
  launch.

## Endpoints

- `${FIRELINE_LAUNCH_CONTROL_STREAM_URL}` is passed to `DurableStream` by
  `@fireline/client/events`; `appendLaunchRequest` appends the
  `fireline.launch_request` envelope and `appendLaunchStop` appends the
  `fireline.launch_stop` envelope through that package.
- `GET ${FIRELINE_LAUNCH_CONTROL_STREAM_URL}` and the stream subscription
  endpoints used internally by `@fireline/state` observe
  `collections.launches`.
- `ws://127.0.0.1:<runtime-port>/acp` is the runtime ACP endpoint returned in
  `LaunchRow.runtime.acp.url` and used by `examples/02-editable-agent-web` for
  follow-up prompts.
- `GET http://127.0.0.1:<streams-port>/healthz` is used by `fireline-v3-dev`
  local streams readiness checks.

Target examples do not call `/v1/launches`, `GET /v1/launches/{id}`, or
`POST /v1/launches/{id}:stop`.

## Historical Checkpoint Workaround

Before `mono-oet.29.4` closed in Fireline PR #210, checkpoint smokes had to set
`FIRELINE_BIN` and `FIRELINE_STREAMS_BIN` to scratch-built binaries because the
runtime platform tarball installed non-executable native binaries. The
package-shaped baseline after PR #210 does not use those variables.

## Matrix Coverage

`examples/01-inline-js-local/run.ts` currently exercises:

- `fsBackend: "local"` with no middleware.
- `fsBackend: "streamFs"` with no middleware.
- `fsBackend: "local"` with `trace(...)`.
- `fsBackend: "local"` with `contextInjection(...)` and `budget(...)`.
- `fsBackend: "streamFs"` with `trace(...)`, `contextInjection(...)`, and
  `budget(...)`.

`examples/02-editable-agent-web` exposes the same supported local brain and
filesystem placements through a browser UI. Unsupported placement and
middleware options remain disabled.

`examples/03-tanstack-shaped-app`, `examples/04-next-basic`, and
`examples/05-next-open-cloudflare` run a smaller launch observation path rather
than the editable chat path. They exist to validate framework import graphs,
client/server boundaries, and build constraints.

`examples/06-flamecast-v3-shaped` exercises a black-box product-consumer shape:

- `src/framework-boundary.ts` has no Fireline imports and owns product intent
  and summary types.
- `src/fireline-adapter.ts` is the Fireline boundary. It teaches the current
  `@fireline/client/spec` vocabulary: `agentDefinition(...)`,
  `launchSpec(...)`, and `newSessionRequest(...)`. It also imports
  `@fireline/client/acp-browser` and `@fireline/state` types, and uses the
  shared stream helper that appends launch/stop events and observes
  `collections.launches`.
- `src/generated-harness.ts` produces a multi-file inline bundle with
  `adapter-entry.mjs`, `runtime-shim.mjs`, `user-harness.mjs`, and
  `framework-boundary.mjs`.
- The runnable smoke derives the launch/control stream URL from exact
  `FIRELINE_LAUNCH_CONTROL_STREAM_URL`; otherwise from
  `FIRELINE_DURABLE_STREAMS_URL` as the `/v1/stream` append base plus
  `FIRELINE_CONTROL_STREAM`; otherwise from local `FIRELINE_STREAMS_PORT` plus
  `FIRELINE_CONTROL_STREAM`; builds a stable
  `clientRequestId` / `idempotencyKey` from `FLAMECAST_WORKSPACE_ID`,
  `FLAMECAST_RUN_ID`, and `FLAMECAST_ATTEMPT_ID`; appends
  `fireline.launch_request`; observes the launch row; attaches to
  `LaunchRow.runtime.acp.url`; sends one follow-up prompt to
  `LaunchRow.startSession.acpSessionId`; appends `fireline.launch_stop`; and
  observes the stopped row.
- The example deliberately does not import real Flamecast v3 modules.

`examples/07-curl-shell-raw-http` exercises the T1 raw Durable Streams HTTP
surface with shell, curl, and small local envelope helpers. It builds
`fireline.launch_request` and `fireline.launch_stop` envelopes without
Fireline package imports, appends them with raw HTTP `POST`, and observes
first-class `fireline.launch` rows with raw HTTP `GET`.

`examples/08-cloudflare-worker-direct` exercises a direct Cloudflare Worker
consumer shape:

- `src/worker.ts` imports Worker-safe `@fireline/client/spec`,
  `@fireline/client/events`, and `@fireline/state` package subpaths directly.
- `wrangler.toml` uses local defaults for `FIRELINE_CONTROL_STREAM` and
  `FIRELINE_STREAMS_PORT` so the Worker derives a usable launch/control stream
  URL when `fireline-v3-dev` is running with the matching `--state-stream`.
- Custom scratch ports or stream names must be passed with Wrangler `--var`
  flags; shell environment variables alone do not override local `[vars]`.
- `POST /launch` appends `fireline.launch_request` and reads
  `collections.launches`.
- `POST /stop` appends `fireline.launch_stop` and reads the stopped launch row.
- `POST /demo` runs launch and stop in one request for local discovery.
- The Worker deliberately avoids Next.js, OpenNext, Node-only Fireline
  imports, `/v1/launches`, and `@fireline/client/launch-control`.

`examples/11-server-worker-wrapper` exercises a server/Worker boundary:

- `src/framework-boundary.ts` has no Fireline imports and owns app-facing auth,
  actor, tenant, and launch intent types.
- `src/server-worker-wrapper.ts` is the Fireline boundary. It validates a
  bearer token, checks tenant/scope policy, derives a stable
  `clientRequestId` / idempotency key, appends `fireline.launch_request`,
  observes `@fireline/state` `collections.launches`, appends
  `fireline.launch_stop`, and returns an app-facing summary.
- `src/generated-worker-agent.ts` creates a generated multi-file inline bundle
  with `worker-entry.mjs` and `tenant-policy.mjs`.
- The runnable smoke derives the launch/control stream URL from exact
  `FIRELINE_LAUNCH_CONTROL_STREAM_URL`; otherwise from
  `FIRELINE_DURABLE_STREAMS_URL` as the `/v1/stream` append base plus
  `FIRELINE_CONTROL_STREAM`; otherwise from local `FIRELINE_STREAMS_PORT` plus
  `FIRELINE_CONTROL_STREAM`.

`examples/12-vercel-function-node` exercises a Vercel Functions Node runtime
shape:

- `api/fireline-launch.ts` is a Vercel-style Node handler using
  `IncomingMessage` / `ServerResponse` types.
- The handler imports root `@fireline/client` and uses
  `fireline.appendLaunchRequest(...)` and `fireline.db(...)`, plus
  `@fireline/client/spec` for launch data and `@fireline/client/events` for
  stop.
- `src/run-local.ts` starts a local Node HTTP server around the handler and
  sends one request for E2E validation.
- The runnable smoke derives the launch/control stream URL from exact
  `FIRELINE_LAUNCH_CONTROL_STREAM_URL`; otherwise from
  `FIRELINE_DURABLE_STREAMS_URL` as the `/v1/stream` append base plus
  `FIRELINE_CONTROL_STREAM`; otherwise from local `FIRELINE_STREAMS_PORT` plus
  `FIRELINE_CONTROL_STREAM`.

`examples/13-vercel-edge-runtime` exercises a Vercel Edge Runtime shape:

- `src/edge.ts` is an Edge handler with `config.runtime = "edge"` and no Node
  built-in imports.
- The handler imports Worker-safe `@fireline/client/spec`,
  `@fireline/client/events`, and `@fireline/state` package subpaths directly.
- `src/run-local.ts` loads the bundled handler into `@edge-runtime/vm` and
  dispatches one `POST /api/fireline-launch` request for E2E validation.
- The runnable smoke derives the launch/control stream URL from exact
  `FIRELINE_LAUNCH_CONTROL_STREAM_URL`; otherwise from
  `FIRELINE_DURABLE_STREAMS_URL` as the `/v1/stream` append base plus
  `FIRELINE_CONTROL_STREAM`; otherwise from local `FIRELINE_STREAMS_PORT` plus
  `FIRELINE_CONTROL_STREAM`.
- The example deliberately avoids root `@fireline/client`, Node built-ins,
  `/v1/launches`, and `@fireline/client/launch-control` in the Edge handler.

`examples/14-bun` exercises a Bun runtime shape:

- `src/launch.ts` imports root `@fireline/client` and uses
  `fireline.appendLaunchRequest(...)` and `fireline.db(...)`, plus
  `@fireline/client/spec` for launch data and `@fireline/client/events` for
  stop.
- `src/run.ts` is executed by `bun` and invokes the launch handler with a
  Fetch `Request`.
- The runnable smoke derives the launch/control stream URL from exact
  `FIRELINE_LAUNCH_CONTROL_STREAM_URL`; otherwise from
  `FIRELINE_DURABLE_STREAMS_URL` as the `/v1/stream` append base plus
  `FIRELINE_CONTROL_STREAM`; otherwise from local `FIRELINE_STREAMS_PORT` plus
  `FIRELINE_CONTROL_STREAM`.

`examples/16-deno` exercises a Deno package-consumer shape:

- `main.ts` imports documented `@fireline/client/spec`,
  `@fireline/client/events`, and `@fireline/state` package subpaths.
- It runs with Deno's Node/npm compatibility using `--node-modules-dir=manual`.
- The runnable smoke derives the launch/control stream URL from exact
  `FIRELINE_LAUNCH_CONTROL_STREAM_URL`; otherwise from
  `FIRELINE_DURABLE_STREAMS_URL` as the `/v1/stream` append base plus
  `FIRELINE_CONTROL_STREAM`; otherwise from local `FIRELINE_STREAMS_PORT` plus
  `FIRELINE_CONTROL_STREAM`.
- The Deno command requires `--allow-net=127.0.0.1` and an explicit
  `--allow-env` list including Fireline example env vars and `NODE_ENV`.

`examples/09-python-raw-http` exercises the T2 Python raw Durable Streams HTTP
surface with only Python stdlib HTTP and JSON modules. It builds
`fireline.launch_request` and `fireline.launch_stop` envelopes without
Fireline package imports, appends them with raw HTTP `POST`, and observes
first-class `fireline.launch` rows with raw HTTP `GET`.

`examples/10-rust-raw-http` exercises the T3 Rust raw Durable Streams HTTP
surface with `reqwest`, `tokio`, and `serde_json`, but no Fireline crates. It
uses the same envelope shape and launch-row observation path as the Python
example, keeping Fireline as an HTTP service boundary.

`examples/15-go-raw-http` exercises the T9 Go raw Durable Streams HTTP surface
with only Go standard library HTTP, JSON, crypto, and filesystem packages. It
uses the same envelope shape and launch-row observation path as the Python and
Rust examples, keeping Fireline as an HTTP service boundary and avoiding any
Fireline Go SDK or source imports.

## Stream-Native Checkpoint

After Fireline #228, #231, #233, #237, #242, and #245, examples 01-06 use the
stream-native path:

- Build a `CreateLaunchRequest` with `@fireline/client/spec`.
- Append `fireline.launch_request` with `appendLaunchRequest`.
- Materialize launch rows with `createFirelineDB(...).collections.launches`.
- Use `@fireline/client/acp-browser` for browser ACP attachment once
  `LaunchRow.runtime.acp.url` and `LaunchRow.startSession.acpSessionId` exist.
- Append `fireline.launch_stop` with `appendLaunchStop` and observe the
  materialized launch row reach `stopped`.

`examples/06-flamecast-v3-shaped`, `examples/11-server-worker-wrapper`,
`examples/12-vercel-function-node`, `examples/13-vercel-edge-runtime`,
`examples/14-bun`, and `examples/16-deno` use the same stream-native path with
larger generated harness or runtime-specific shapes. They are characterization evidence for product
consumer boundaries, not a promise that `@fireline/client/spec` names are
frozen.

Validated `mono-oet.29.3.1` behavior:

- Launch rows now use bare launch ids only in observed target rows. The old
  `launch:<id>` compatibility matcher was removed from the examples.
- Stream-native stop is validated in examples 01 and 02 and wired into the
  framework launch helpers.

Current `@fireline/state` observation rough edge: live subscriptions still log
`Cannot read properties of undefined (reading 'Symbol(liveQueryInternal)')`
while processing runtime instance rows. The examples use fresh
`createFirelineDB(...).preload()` snapshots against `collections.launches` while
waiting for launch/stop rows, and keep this logged as substrate friction rather
than hiding it as canonical app shape.
