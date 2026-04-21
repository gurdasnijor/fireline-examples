# 17. ACP Registry Chat

This current Tier 1 example resolves an ACP registry row with
`acpRegistry(...)` from `@fireline/client`, launches the resolved ACP stdio
command through `new Fireline({ endpoint })` and `new Agent(...)`, attaches to
the returned session, sends a follow-up prompt with `session.chat(...)`, and
stops the session through `session.stop(...)`.

It intentionally uses a local fixture catalog row whose distribution is
`command`. The normal app lifecycle stays inside the current managed-agent
surface:

- no binary install/cache;
- no launcher env metadata;
- no hand-rolled lifecycle flow outside managed-agent.

The launch path stays on `fireline.session(...)` and `session.stop(...)`.
`acpRegistry(...)` remains the registry-resolution surface for the local
fixture row, and `acp.inlineJsBundle(...)` is intentionally used only for the
local fixture agent payload.

The fixture row starts `examples/17-acp-registry-chat/registry-agent.mjs`, a
small ACP stdio agent that replies to prompts. The registry resolver still
returns Fireline's canonical command-shaped agent config, which is the behavior
this example is validating.

## Run With A Fresh Daemon

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
    ACP_REGISTRY_CHAT_RUN_ID="registry-chat-fresh" \
    ACP_REGISTRY_CHAT_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/17-acp-registry-chat/src/run.ts"
```

Expected output:

```json
{
  "ok": true,
  "example": "17-acp-registry-chat",
  "registry": {
    "agentId": "fireline-example-registry-echo",
    "transport": "command"
  },
  "launchStatus": "session_ready",
  "followUp": {
    "stopReason": "end_turn"
  },
  "stopStatus": "stopped"
}
```

The exact launch id, runtime id, ACP URL, and session id vary per run.

## Reuse An Existing Daemon

Start or keep a daemon on the selected ports:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-17-reuse-state
export FIRELINE_PORT=4618
export FIRELINE_STREAMS_PORT=7718
export FIRELINE_CONTROL_STREAM=fireline-acp-registry-chat-reuse-control
rm -rf "$FIRELINE_STATE_DIR"
mkdir -p "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM"
```

In a second shell:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
export FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-17-reuse-state
export FIRELINE_PORT=4618
export FIRELINE_STREAMS_PORT=7718
export FIRELINE_CONTROL_STREAM=fireline-acp-registry-chat-reuse-control
cd "$FIRELINE_STATE_DIR"
FIRELINE_STATE_DIR="$FIRELINE_STATE_DIR" \
FIRELINE_PORT="$FIRELINE_PORT" \
FIRELINE_STREAMS_PORT="$FIRELINE_STREAMS_PORT" \
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec fireline-v3-dev \
  --state-stream "$FIRELINE_CONTROL_STREAM" -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:${FIRELINE_STREAMS_PORT}/v1/stream" \
    FIRELINE_CONTROL_STREAM="$FIRELINE_CONTROL_STREAM" \
    ACP_REGISTRY_CHAT_RUN_ID="registry-chat-reuse" \
    ACP_REGISTRY_CHAT_ATTEMPT_ID="attempt-1" \
    pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsx \
      "$FIRELINE_EXAMPLES_ROOT/examples/17-acp-registry-chat/src/run.ts"
```

Expected output is the same shape as the fresh-daemon run. The wrapper should
reuse the already-running daemon and create/verify the configured control
stream before launching the child command.

## Configuration

- `FIRELINE_ENDPOINT`: exact Fireline endpoint. When
  set, it takes precedence.
- `FIRELINE_DURABLE_STREAMS_URL`: durable streams base ending in `/v1/stream`.
  Defaults to `http://127.0.0.1:${FIRELINE_STREAMS_PORT:-7474}/v1/stream`.
- `FIRELINE_CONTROL_STREAM`: control stream name. Defaults to
  `fireline-acp-registry-chat-control`.
- `ACP_REGISTRY_CHAT_RUN_ID`: run coordinate. Reuse it for retries of the same
  run.
- `ACP_REGISTRY_CHAT_ATTEMPT_ID`: attempt coordinate. Change it for a new
  attempt.
- `ACP_REGISTRY_CHAT_INITIAL_PROMPT`: prompt sent by Fireline session startup.
- `ACP_REGISTRY_CHAT_FOLLOW_UP_PROMPT`: follow-up prompt sent after attaching
  to ACP.

## Out Of Scope

The example does not use live public registry rows that require binary
download/cache or launcher env metadata.

## Local Evidence

BE3 `mono-oet.29.3.17` used scratch state and logs under
`/tmp/fireline-mono-oet-29-3-17`.

Checks:

```sh
pnpm run check:surface
pnpm run typecheck
git diff --check
```

Fresh-daemon E2E:

```sh
FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-17/fresh-state \
FIRELINE_PORT=4617 \
FIRELINE_STREAMS_PORT=7717 \
FIRELINE_CONTROL_STREAM=fireline-acp-registry-chat-control \
ACP_REGISTRY_CHAT_RUN_ID=registry-chat-fresh \
ACP_REGISTRY_CHAT_ATTEMPT_ID=attempt-1 \
pnpm --dir /Users/gnijor/gurdasnijor/fireline-examples run smoke:acp-registry-chat
```

Result: `ok: true`, registry `transport: "command"`,
`launchStatus: "session_ready"`, follow-up `stopReason: "end_turn"`, and
`stopStatus: "stopped"`. Log:
`/tmp/fireline-mono-oet-29-3-17/fresh.log`.

Prior-daemon reuse E2E used
`/tmp/fireline-mono-oet-29-3-17/reuse-state`, ports `4618` and `7718`, and
control stream `fireline-acp-registry-chat-reuse-control`.

Result: `ok: true`, registry `transport: "command"`,
`launchStatus: "session_ready"`, follow-up `stopReason: "end_turn"`, and
`stopStatus: "stopped"`. Logs:
`/tmp/fireline-mono-oet-29-3-17/reuse-daemon.log` and
`/tmp/fireline-mono-oet-29-3-17/reuse-run.log`.
