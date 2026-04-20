# API Surface

This file lists every Fireline import, package ref, command, environment
variable, binary, and endpoint used by this discovery repo.

## Package Refs

- `@fireline/client`: `file:/tmp/fireline-examples-artifacts/fireline-client-0.0.1.tgz`
- `@fireline/runtime`: `file:/tmp/fireline-examples-artifacts/fireline-runtime-0.0.1.tgz`
- `@fireline/runtime-darwin-arm64`: `file:/tmp/fireline-examples-artifacts/fireline-runtime-darwin-arm64-0.0.1.tgz`
- `@fireline/state`: `file:/tmp/fireline-examples-artifacts/fireline-state-0.0.1.tgz`

These are local tarball refs produced from Fireline packages at Fireline main
`bdb1ad02`, after #242 stream-native stop and #245 launch row normalization
landed. They are package-shaped, but they are not registry-published refs.

The direct platform package ref is included because the local tarball install
did not materialize the meta package's optional platform dependency reliably.
This is discovery artifact friction, not intended public app configuration.

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

Examples 01-06 do not import Fireline root exports, `@fireline/client/launch-control`,
runtime internals, or private package source. The target launch path appends
`fireline.launch_request` and `fireline.launch_stop` to the configured control
stream and observes `@fireline/state` `collections.launches`.

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

## Runtime-Required Internal Resolution

- `@fireline/client/internal/js-module-runner`

The example does not import this from application code and the smoke does not
set `FIRELINE_JS_MODULE_RUNNER_IMPORT`. `@fireline/runtime` still resolves this
internal subpath from installed packages when launching inline JS module agents.
This remains a friction point because a runtime package path depends on a
private client subpath, even though external app code does not touch it.

## Commands And Binaries

- `pnpm install`
- `pnpm run check`
- `pnpm run typecheck`
- `pnpm run check:surface`
- `pnpm run smoke:inline-js-local`
- `pnpm run dev:editable-agent-web`
- `pnpm run build:editable-agent-web`
- `pnpm run build:tanstack-shaped`
- `pnpm run build:next-basic`
- `pnpm run build:next-open-cloudflare`
- `pnpm run build:opennext-cloudflare`
- `pnpm run smoke:flamecast-shaped`
- `pnpm exec fireline-v3-dev --state-stream <control-stream>`
- `tsx examples/01-inline-js-local/run.ts`
- `tsx examples/06-flamecast-v3-shaped/src/run.ts`
- `fireline-v3-dev` wrapping `vite` through `pnpm run dev:editable-agent-web`
- `vite` through the private Vite child script
- `next dev` through the Next framework scripts
- `next build` through the Next framework scripts
- `opennextjs-cloudflare build` through `pnpm run build:opennext-cloudflare`
- `fireline-v3-dev` from `@fireline/runtime`
- `fireline` via the `@fireline/runtime` shim
- `fireline-streams` via the `@fireline/runtime` shim

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
  in `/v1/stream`. Example 06 appends `/<FIRELINE_CONTROL_STREAM>` to this base
  when the exact launch/control stream URL is not provided.
- `FIRELINE_CONTROL_STREAM`: README helper variable used only to align the
  local `fireline-v3-dev --state-stream` process with the full control stream
  URL. Example 06 also uses it to derive the launch/control stream URL when
  `FIRELINE_LAUNCH_CONTROL_STREAM_URL` is not set.
- `FIRELINE_PORT`: set in scratch smoke recipes to avoid reusing another local
  daemon on the default port.
- `FIRELINE_STREAMS_PORT`: set in scratch smoke recipes to avoid reusing
  another local streams server on the default port.
- `FIRELINE_EXAMPLE_OUTPUT_ROOT`: example-only output directory for local
  filesystem writes. Set to the scratch state directory in the documented
  smoke recipe so generated output does not land under the repo.
- `FIRELINE_STATE_DIR`: scratch-directory convention for this spike.
- `FIRELINE_EXAMPLES_ROOT`: helper variable in the README recipe only.
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

`examples/06-flamecast-v3-shaped` uses the same stream-native path with a
larger generated harness shape. It is characterization evidence for product
consumer boundaries, not a promise that `@fireline/client/spec` names are frozen.

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
