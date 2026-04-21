# Flamecast-V3-Shaped Consumer

This is a black-box characterization example, not real Flamecast v3 code and
not a public getting-started guide. It stresses the Fireline surfaces a complex
TypeScript product would use while keeping all Fireline access package-shaped.

The example has three boundaries:

- `src/framework-boundary.ts`: product-facing intent and summary types. This
  file has no Fireline imports.
- `src/fireline-adapter.ts`: the only layer that imports Fireline packages,
  creates `new Fireline({ endpoint })` and `new Agent(...)`, then uses
  `fireline.session(...)`, `session.chat(...)`, and `session.stop(...)`.
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
export FLAMECAST_WORKSPACE_ID=workspace-characterization
export FLAMECAST_RUN_ID=run-001
export FLAMECAST_ATTEMPT_ID=attempt-1
export FLAMECAST_FOLLOW_UP_PROMPT="complete the generated Flamecast harness run"
mkdir -p "$FIRELINE_STATE_DIR"
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
fireline runtime dev \
  --launch-control-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_ENDPOINT="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream/${FIRELINE_CONTROL_STREAM}" \
    FLAMECAST_WORKSPACE_ID="$FLAMECAST_WORKSPACE_ID" \
    FLAMECAST_RUN_ID="$FLAMECAST_RUN_ID" \
    FLAMECAST_ATTEMPT_ID="$FLAMECAST_ATTEMPT_ID" \
    FLAMECAST_FOLLOW_UP_PROMPT="$FLAMECAST_FOLLOW_UP_PROMPT" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/06-flamecast-v3-shaped/src/run.ts"
```

The adapter accepts `FIRELINE_ENDPOINT` as the normal Tier 1 connection input.
If it is not set, the local example falls back to
`FIRELINE_DURABLE_STREAMS_URL + FIRELINE_CONTROL_STREAM`, and finally
`http://127.0.0.1:<FIRELINE_STREAMS_PORT>/v1/stream/<FIRELINE_CONTROL_STREAM>`.

`FLAMECAST_RUN_ID` and `FLAMECAST_ATTEMPT_ID` are product coordinates. The
example builds `clientRequestId` and `idempotencyKey` from them, so retries of
the same attempt should reuse the same values. Start a new attempt by changing
`FLAMECAST_ATTEMPT_ID`.

Expected output is a JSON summary with launch id, session id, session status,
follow-up status, any required-action types, and stop status. The example does
not call the legacy HTTP launch endpoint, does not import the legacy
launch-control subpath, does not import Fireline repo internals, and does not
import real Flamecast v3 modules. It uses the Tier 1 managed-agent surface:
`new Fireline({ endpoint })`, `new Agent(...)`, `fireline.session(...)`,
`session.chat(...)`, and `session.stop(...)`.

## Reviewer Reproduce

This branch now uses immutable git artifact refs in `package.json`, not local
`/tmp` tarballs. Install from the package-shaped refs and run cheap checks:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" install --frozen-lockfile
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run check:surface
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsc --noEmit --pretty false
```

The original 2026-04-19 evidence used Fireline workflow run `24650112221` and
manual tarball staging. That path is superseded by the stable pre-npm git
artifact channel.

Fresh-daemon scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-3-e2e/fresh-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4591 \
FIRELINE_STREAMS_PORT=7691 \
fireline runtime dev \
  --launch-control-stream fireline-flamecast-shaped-fresh -- \
  env FIRELINE_ENDPOINT="http://127.0.0.1:7691/v1/stream/fireline-flamecast-shaped-fresh" \
    FLAMECAST_WORKSPACE_ID="workspace-characterization" \
    FLAMECAST_RUN_ID="fresh-daemon-run-001" \
    FLAMECAST_ATTEMPT_ID="attempt-1" \
    FLAMECAST_FOLLOW_UP_PROMPT="complete the generated Flamecast harness run" \
    pnpm --dir "$EX" exec tsx \
      "$EX/examples/06-flamecast-v3-shaped/src/run.ts"
```

Prior-daemon reuse scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-3-e2e/reuse-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4592 \
FIRELINE_STREAMS_PORT=7692 \
fireline runtime dev \
  --launch-control-stream fireline-flamecast-shaped-reuse
```

In another shell:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
env FIRELINE_ENDPOINT="http://127.0.0.1:7692/v1/stream/fireline-flamecast-shaped-reuse" \
  FLAMECAST_WORKSPACE_ID="workspace-characterization" \
  FLAMECAST_RUN_ID="reuse-daemon-run-001" \
  FLAMECAST_ATTEMPT_ID="attempt-1" \
  FLAMECAST_FOLLOW_UP_PROMPT="complete the generated Flamecast harness run" \
  pnpm --dir "$EX" exec tsx \
    "$EX/examples/06-flamecast-v3-shaped/src/run.ts"
```

Both scenarios should print JSON with `launchStatus: "session_ready"`,
`session.followUpSent: true`, and `stopStatus: "stopped"`.

Historical pre-managed-agent evidence from 2026-04-19:

- Fresh daemon: launch `fbc579d1-1ccf-4823-beeb-4bdfaf169604`,
  `clientRequestId`
  `launch:flamecast-shaped:workspace-characterization:fresh-daemon-run-001:attempt-1`,
  ACP session `jsmod-0b74f363-f14c-4c88-af93-b46dd2148ab4`,
  `session.followUpSent: true`, `stopStatus: "stopped"`.
- Prior daemon reuse: launch `a45e781b-7852-4fcf-a22a-facdbd11b8f5`,
  `clientRequestId`
  `launch:flamecast-shaped:workspace-characterization:reuse-daemon-run-001:attempt-1`,
  ACP session `jsmod-d1f806d4-5818-47b0-9044-bb3293e59e02`,
  `session.followUpSent: true`, `stopStatus: "stopped"`.

Validated 2026-04-20 managed-agent cutover evidence against
`fireline-client-artifact-75a6cdb66f6b147e2d9c5988fb5f1ab77eeff9e7`:

- Fresh daemon on `4736`/`7736`: launch
  `6f8c7aba-78e9-4b1b-83a9-352c3379c911`, `clientRequestId`
  `launch:flamecast-shaped:workspace-ma-cutover:fresh-run-001:attempt-1`,
  ACP session `jsmod-eecf7100-bad8-442e-a8e9-0bfa82c25386`,
  `session.followUpSent: true`, `stopStatus: "stopped"`.
- Prior daemon reuse on `4740`/`7740`: launch
  `fe438130-ee7a-44c3-b6b5-eeee46b588b6`, `clientRequestId`
  `launch:flamecast-shaped:workspace-ma-cutover:reuse-run-001:attempt-1`,
  ACP session `jsmod-73cb4256-8c3c-412f-8743-201ef768e7e8`,
  `session.followUpSent: true`, `stopStatus: "stopped"`.
