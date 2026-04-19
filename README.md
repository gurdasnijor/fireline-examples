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
