# API Surface

This file lists every Fireline import, package ref, command, environment
variable, binary, and endpoint used by this discovery repo.

## Package Refs

- `@fireline/client`: `file:/tmp/fireline-mono-oet.29.3-artifacts/fireline-client-0.0.1.tgz`
- `@fireline/runtime`: `file:/tmp/fireline-mono-oet.29.3-artifacts/fireline-runtime-0.0.1.tgz`

These are local tarball refs produced from Fireline packages. They are
package-shaped, but they are not registry-published refs. The current
editable-agent-web no-proxy checkpoint used artifacts rebuilt from Fireline
`0c6f6ae8`.

## Fireline Imports

- `@fireline/client/spec`
  - `inlineBundleArtifact`
  - `jsModuleAgentForm`
  - `conductorSpec`
  - `createLaunchRequest`
  - `textPrompt`
- `@fireline/client/launch-control`
  - `FirelineLaunchControlClient`
- `@fireline/client/middleware`
  - `trace`
  - `contextInjection`
  - `budget`
- `@fireline/client/acp`
  - `ClientSideConnection`
  - `PROTOCOL_VERSION`
  - ACP protocol types used by the browser WebSocket adapter

The framework-shaped examples use the same Fireline public subpaths from client
components or browser bundles. They do not import Fireline root exports,
runtime internals, or private package source.

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

The example does not import this from application code and the smoke no longer
sets `FIRELINE_JS_MODULE_RUNNER_IMPORT`. `@fireline/runtime` still resolves this
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
- `pnpm exec fireline-v3-dev -- tsx examples/01-inline-js-local/run.ts`
- `pnpm exec fireline-v3-dev`
- `vite` through `pnpm run dev:editable-agent-web`
- `vite` through `pnpm run dev:tanstack-shaped`
- `next dev` through the Next framework scripts
- `next build` through the Next framework scripts
- `opennextjs-cloudflare build` through `pnpm run build:opennext-cloudflare`
- `fireline-v3-dev` from `@fireline/runtime`
- `fireline` via the `@fireline/runtime` shim
- `fireline-streams` via the `@fireline/runtime` shim

## Environment Variables

- `FIRELINE_LAUNCH_URL`: read by examples 01-05; exported by
  `fireline-v3-dev`.
- `FIRELINE_DURABLE_STREAMS_URL`: exported by `fireline-v3-dev`; no longer
  read by examples 01-05 app configuration. This remains a transitional
  runtime-owned coordinate/source until Fireline `mono-oet.29.11` removes the
  consumer-visible compatibility pressure.
- `FIRELINE_DAEMON_URL`: exported by `fireline-v3-dev`; not required by the example logic.
- `FIRELINE_PORT`: set in the scratch smoke recipe to avoid reusing another
  local daemon on the default port.
- `FIRELINE_STREAMS_PORT`: set in the scratch smoke recipe to avoid reusing
  another local streams server on the default port. This is runtime process
  setup, not app launch-control configuration.
- `FIRELINE_EXAMPLE_OUTPUT_ROOT`: example-only output directory for local
  filesystem writes. Set to the scratch state directory in the documented
  smoke recipe so generated output does not land under the repo.
- `FIRELINE_STATE_DIR`: scratch-directory convention for this spike. The
  current local streams binary does not expose a visible CLI flag for it.
- `FIRELINE_EXAMPLES_ROOT`: helper variable in the README recipe only.

## Endpoints

- `POST ${FIRELINE_LAUNCH_URL}` creates a launch.
- `GET ${FIRELINE_LAUNCH_URL}/{launchId}` may be used by launch-control as a fallback.
- `POST ${FIRELINE_LAUNCH_URL}/{launchId}:stop` stops the launch.
- `ws://.../acp` from the launch runtime result is used by
  `examples/02-editable-agent-web` to send follow-up prompts through ACP.
- `GET ${FIRELINE_DAEMON_URL}/healthz` is used by `fireline-v3-dev` readiness checks.
- `GET http://127.0.0.1:7496/healthz` is used by the scratch smoke's
  `fireline-v3-dev` local streams readiness checks.
- `http://127.0.0.1:4464/v1/launches` is the direct launch endpoint used by
  `examples/02-editable-agent-web` and the framework-shaped browser examples;
  local loopback CORS is expected after Fireline PR #220.
- Durable launch-state URLs may be returned in launch-control response
  coordinates and are logged or displayed opaquely by examples. Examples 01-05
  no longer hard-code a durable streams endpoint or stream name as app config.
- `ws://127.0.0.1:<runtime-port>/acp` is the runtime ACP endpoint returned
  from the launch result and used by `examples/02-editable-agent-web` for
  follow-up prompts.

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
`examples/05-next-open-cloudflare` run a smaller launch/stop path rather than
the editable chat path. They exist to validate framework import graphs,
client/server boundaries, and build constraints.

## No-Proxy Editable Web Checkpoint

After Fireline PR #220, the app does not use a Vite proxy or custom fetch
rewrite. The direct no-proxy smoke verified:

- Launch-control CORS preflight from `http://127.0.0.1:5173` to
  `http://127.0.0.1:4464/v1/launches` returned `200 OK`.
- Direct launch created `0127f0e6f04a5048958ce620c85cf42566`.
- Launch result exposed runtime ACP URL, runtime state coordinates, durable
  wait coordinates, and session `jsmod-f2a2f090-6e18-457f-a243-76b3152c4682`.
- Follow-up ACP prompt returned `stopReason: "end_turn"`.
- Stop returned `status: "stopped"`.

## LaunchUrl-Only Checkpoint

After `mono-oet.29.12`, examples 01-05 construct
`FirelineLaunchControlClient` with `launchUrl` only. They do not pass
consumer-authored durable stream URLs or stream names.

The launchUrl-only smoke verified:

- `examples/01-inline-js-local` matrix ran all five TypeScript-authored cases,
  returned launch/session/state coordinates, wrote local filesystem output
  under `/tmp/fireline-mono-oet.29.3-state/inline-js-local-output`, and stopped
  each launch.
- `examples/02-editable-agent-web` created launch
  `01097753afbebd4099ac811817859dbc22`, returned session
  `jsmod-4843ffd8-a074-428c-ac9e-b3165ba3808c`, sent a follow-up ACP prompt
  with `stopReason: "end_turn"`, and stopped the launch.
- `examples/03-tanstack-shaped-app` created launch
  `01937c3020f9784b04ad9a8e39a34e8aed` and stopped it.
- `examples/04-next-basic` created launch
  `01eb5f4474646745f3b560f8ef594f5c61` and stopped it.
- `examples/05-next-open-cloudflare` created launch
  `019d457e68f8b94c05b64d53d558b21a7b9b` and stopped it.

Launch-control responses still include durable state coordinates such as
`stateStreamUrl`; examples display or log those as runtime-owned response data.
