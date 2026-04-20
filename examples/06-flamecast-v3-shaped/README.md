# Flamecast-V3-Shaped Consumer

This is a black-box characterization example, not real Flamecast v3 code and
not a public getting-started guide. It stresses the Fireline surfaces a complex
TypeScript product would use while keeping all Fireline access package-shaped.

The example has three boundaries:

- `src/framework-boundary.ts`: product-facing intent and summary types. This
  file has no Fireline imports.
- `src/fireline-adapter.ts`: the only layer that imports Fireline packages,
  appends `fireline.launch_request`, observes `collections.launches`, attaches
  to ACP, and appends `fireline.launch_stop`.
- `src/generated-harness.ts`: simulates a generated multi-file harness bundle
  with `adapter-entry.mjs`, `runtime-shim.mjs`, `user-harness.mjs`, and
  `framework-boundary.mjs`.

Run it from scratch state so generated durable state does not land in the repo:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet.29.3.3-state
export FIRELINE_PORT=4486
export FIRELINE_STREAMS_PORT=7586
export FIRELINE_CONTROL_STREAM=fireline-flamecast-shaped-control
export FIRELINE_LAUNCH_CONTROL_STREAM_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream/${FIRELINE_CONTROL_STREAM}"
export FLAMECAST_WORKSPACE_ID=workspace-characterization
export FLAMECAST_FOLLOW_UP_PROMPT="complete the generated Flamecast harness run"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_LAUNCH_CONTROL_STREAM_URL="$FIRELINE_LAUNCH_CONTROL_STREAM_URL" \
    FLAMECAST_WORKSPACE_ID="$FLAMECAST_WORKSPACE_ID" \
    FLAMECAST_FOLLOW_UP_PROMPT="$FLAMECAST_FOLLOW_UP_PROMPT" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/06-flamecast-v3-shaped/src/run.ts"
```

Expected output is a JSON summary with launch id, runtime ACP URL, ACP session
id, follow-up status, and stop status. The example does not call the legacy HTTP
launch endpoint, does not import the legacy launch-control subpath, does not
import Fireline repo internals, and does not import real Flamecast v3 modules.
