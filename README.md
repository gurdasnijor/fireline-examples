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

Current checkpoint:

- `examples/01-inline-js-local` is TypeScript-authored and launches a basic
  inline JS local agent through
  `@fireline/client/spec`, `@fireline/client/launch-control`, and
  `fireline-v3-dev`.
- The smoke prints launch, wait, runtime, session, and state coordinates, then
  calls launch-control stop.
- `examples/02-editable-agent-web` is a TypeScript/TSX app-shaped discovery
  example. It lets a user edit inline agent code, create a launch, inspect
  launch/session/state coordinates, send a follow-up ACP prompt, and stop the
  launch. Unsupported brain, hands, and middleware choices are disabled and
  logged in `FRICTION_LOG.md`.
- `examples/03-tanstack-shaped-app`, `examples/04-next-basic`, and
  `examples/05-next-open-cloudflare` are framework-shaped TypeScript discovery
  examples. They keep Fireline calls package-shaped and client-side while
  recording framework seams instead of canonizing product examples.

Setup:

```sh
pnpm install
pnpm run check
```

Run the baseline smoke from a scratch working directory so durable state does
not fan out under this repo:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet.29.3-state
export FIRELINE_PORT=4459
export FIRELINE_STREAMS_PORT=7496
export FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_STATE_DIR/inline-js-local-output"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_EXAMPLE_OUTPUT_ROOT="$FIRELINE_EXAMPLE_OUTPUT_ROOT" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev -- \
  pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
    "$FIRELINE_EXAMPLES_ROOT/examples/01-inline-js-local/run.ts"
```

The `FIRELINE_BIN` and `FIRELINE_STREAMS_BIN` overrides are a checkpoint
workaround for historical checkpoint runs before `mono-oet.29.4` closed.
Do not use them for the package-shaped baseline after PR #210.

The direct script is also available:

```sh
pnpm run smoke:inline-js-local
```

That form is easier to type, but it runs from the repo working directory.
Prefer the scratch-directory form for longer smokes.

Run the editable-agent web app with a package-shaped Fireline runtime:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet.29.3-state
export FIRELINE_PORT=4464
export FIRELINE_STREAMS_PORT=7501
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev
```

In another shell:

```sh
pnpm run dev:editable-agent-web
```

Open `http://127.0.0.1:5173/`. The default endpoints call the package-shaped
local launch runtime directly: `http://127.0.0.1:4464/v1/launches`.
Durable state coordinates are returned by launch-control responses and displayed
as opaque runtime data; the app no longer asks users to configure a durable
streams URL.

No Vite proxy is used for launch-control. Direct loopback CORS is required from
Fireline PR #220 or later.

Framework-shaped checks:

```sh
pnpm run build:tanstack-shaped
pnpm run build:next-basic
pnpm run build:next-open-cloudflare
pnpm run build:opennext-cloudflare
```

The OpenNext/Cloudflare build uses the local adapter shape only. It is not a
deployment recipe.
