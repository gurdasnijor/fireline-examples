# API Surface

This file lists every Fireline import, package ref, command, environment
variable, binary, and endpoint used by this discovery repo.

## Package Refs

- `@fireline/client`: `file:/tmp/fireline-mono-oet.29.16-artifacts/fireline-client-0.0.1.tgz`
- `@fireline/runtime`: `file:/tmp/fireline-mono-oet.29.16-artifacts/fireline-runtime-0.0.1.tgz`
- `@fireline/runtime-darwin-arm64`: `file:/tmp/fireline-mono-oet.29.16-artifacts/fireline-runtime-darwin-arm64-0.0.1.tgz`
- `@fireline/state`: `file:/tmp/fireline-mono-oet.29.16-artifacts/fireline-state-0.0.1.tgz`

These are local tarball refs produced from Fireline packages at Fireline main
`a1f6da7b`, after #228, #231, #233, and #237 landed. They are package-shaped,
but they are not registry-published refs.

The direct platform package ref is included because the local tarball install
did not materialize the meta package's optional platform dependency reliably.
This is discovery artifact friction, not intended public app configuration.

## Fireline Imports

- `@fireline/client/spec`
  - `inlineBundleArtifact`
  - `jsModuleAgentForm`
  - `conductorSpec`
  - `createLaunchRequest`
  - `textPrompt`
- `@fireline/client/events`
  - `appendLaunchRequest`
  - `LaunchRequestEnvelope`
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

Examples 01-05 do not import Fireline root exports, `@fireline/client/launch-control`,
runtime internals, or private package source. The target launch path appends
`fireline.launch_request` to the configured control stream and observes
`@fireline/state` `collections.launches`.

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
- `pnpm exec fireline-v3-dev --state-stream <control-stream>`
- `tsx examples/01-inline-js-local/run.ts`
- `vite` through the Vite example scripts
- `next dev` through the Next framework scripts
- `next build` through the Next framework scripts
- `opennextjs-cloudflare build` through `pnpm run build:opennext-cloudflare`
- `fireline-v3-dev` from `@fireline/runtime`
- `fireline` via the `@fireline/runtime` shim
- `fireline-streams` via the `@fireline/runtime` shim

## Environment Variables

- `FIRELINE_LAUNCH_CONTROL_STREAM_URL`: read by examples 01-03 and passed into
  the Next-shaped examples as `controlStreamUrl`. This is the app-facing full
  durable launch/control stream append target.
- `VITE_FIRELINE_LAUNCH_CONTROL_STREAM_URL`: optional Vite dev/build seed for
  examples 02-03.
- `FIRELINE_CONTROL_STREAM`: README helper variable used only to align the
  local `fireline-v3-dev --state-stream` process with the full control stream
  URL. It is not app configuration.
- `FIRELINE_PORT`: set in scratch smoke recipes to avoid reusing another local
  daemon on the default port.
- `FIRELINE_STREAMS_PORT`: set in scratch smoke recipes to avoid reusing
  another local streams server on the default port.
- `FIRELINE_EXAMPLE_OUTPUT_ROOT`: example-only output directory for local
  filesystem writes. Set to the scratch state directory in the documented
  smoke recipe so generated output does not land under the repo.
- `FIRELINE_STATE_DIR`: scratch-directory convention for this spike.
- `FIRELINE_EXAMPLES_ROOT`: helper variable in the README recipe only.

## Endpoints

- `${FIRELINE_LAUNCH_CONTROL_STREAM_URL}` is passed to `DurableStream` by
  `@fireline/client/events`; `appendLaunchRequest` appends the
  `fireline.launch_request` envelope through that package.
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

## Stream-Native Checkpoint

After Fireline #228, #231, #233, and #237, examples 01-05 use the stream-native
path:

- Build a `CreateLaunchRequest` with `@fireline/client/spec`.
- Append `fireline.launch_request` with `appendLaunchRequest`.
- Materialize launch rows with `createFirelineDB(...).collections.launches`.
- Use `@fireline/client/acp-browser` for browser ACP attachment once
  `LaunchRow.runtime.acp.url` and `LaunchRow.startSession.acpSessionId` exist.

Current app-level gap: there is no stream-native stop/cancel primitive used by
these examples, so examples close local ACP/observation handles rather than
teaching the old HTTP stop path. Follow-up is tracked in Fireline
`mono-oet.29.19`.

Current `@fireline/state` observation rough edge: launch rows can appear with
both bare launch ids and `launch:<id>` ids, and session coordinates currently
land on the prefixed row. The shared example matcher accepts both forms and
continues observing through `collections.launches`; this should be cleaned up
before these examples become canonical.
