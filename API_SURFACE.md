# API Surface

This file lists every Fireline import, package ref, command, environment
variable, binary, and endpoint used by this discovery repo.

## Package Refs

- `@fireline/client`: `file:/tmp/fireline-mono-oet.29.3-artifacts/fireline-client-0.0.1.tgz`
- `@fireline/runtime`: `file:/tmp/fireline-mono-oet.29.3-artifacts/fireline-runtime-0.0.1.tgz`

These are local tarball refs produced from Fireline packages. They are
package-shaped, but they are not registry-published refs.

## Fireline Imports

- `@fireline/client/spec`
  - `inlineBundleArtifact`
  - `jsModuleAgentForm`
  - `conductorSpec`
  - `createLaunchRequest`
  - `textPrompt`
- `@fireline/client/launch-control`
  - `FirelineLaunchControlClient`

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
- `pnpm exec fireline-v3-dev -- tsx examples/01-inline-js-local/run.ts`
- `fireline-v3-dev` from `@fireline/runtime`
- `fireline` via the `@fireline/runtime` shim
- `fireline-streams` via the `@fireline/runtime` shim

## Environment Variables

- `FIRELINE_LAUNCH_URL`: read by the example; exported by `fireline-v3-dev`.
- `FIRELINE_DURABLE_STREAMS_URL`: read by the example; exported by `fireline-v3-dev`.
- `FIRELINE_DAEMON_URL`: exported by `fireline-v3-dev`; not required by the example logic.
- `FIRELINE_PORT`: set in the scratch smoke recipe to avoid reusing another
  local daemon on the default port.
- `FIRELINE_STREAMS_PORT`: set in the scratch smoke recipe to avoid reusing
  another local streams server on the default port.
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
- `${FIRELINE_DURABLE_STREAMS_URL}/fireline-v3-dev-daemon` is used by launch-control to observe launch state when coordinates are present.
- `GET ${FIRELINE_DAEMON_URL}/healthz` is used by `fireline-v3-dev` readiness checks.
- `GET http://127.0.0.1:7496/healthz` is used by the scratch smoke's
  `fireline-v3-dev` local streams readiness checks.

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
