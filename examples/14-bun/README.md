# Bun Runtime

Discovery-only Bun example. It models a Bun process that owns the Fireline call
path for one request:

1. derive the launch/control stream URL from environment;
2. build a launch spec with `@fireline/client/spec`;
3. append `fireline.launch_request` through the root `@fireline/client` surface;
4. observe `collections.launches` through `fireline.db(...)`;
5. append `fireline.launch_stop`;
6. print a compact JSON response.

This is not a Fireline API wrapper. It validates that Bun can resolve and run
the package-shaped Fireline client artifacts used by the examples repo.

## Files

- `src/launch.ts`: Bun-compatible launch handler using the root
  `@fireline/client`, `@fireline/client/spec`, and `@fireline/client/events`.
- `src/run.ts`: local E2E runner executed by Bun.

## Reviewer Reproduce

The repo uses package-shaped git artifact refs in `package.json`, not Fireline
source imports or local tarballs.

Cheap checks:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" install --frozen-lockfile
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run check:surface
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsc --noEmit --pretty false
bun --version
```

Fresh-daemon scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-15/fresh-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4615 \
FIRELINE_STREAMS_PORT=7715 \
pnpm --dir "$EX" exec fireline-v3-dev \
  --state-stream fireline-bun-fresh -- \
  env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7715/v1/stream" \
    FIRELINE_CONTROL_STREAM="fireline-bun-fresh" \
    BUN_EXAMPLE_RUN_ID="fresh-daemon-run-001" \
    BUN_EXAMPLE_ATTEMPT_ID="attempt-1" \
    bun "$EX/examples/14-bun/src/run.ts"
```

Prior-daemon reuse scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-15/reuse-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4616 \
FIRELINE_STREAMS_PORT=7716 \
pnpm --dir "$EX" exec fireline-v3-dev \
  --state-stream fireline-bun-reuse
```

In another shell:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7716/v1/stream" \
  FIRELINE_CONTROL_STREAM="fireline-bun-reuse" \
  BUN_EXAMPLE_RUN_ID="reuse-daemon-run-001" \
  BUN_EXAMPLE_ATTEMPT_ID="attempt-1" \
  bun "$EX/examples/14-bun/src/run.ts"
```

Both runs should print JSON with `ok: true`, `launchStatus: "session_ready"`,
and `stopStatus: "stopped"`.

Validated 2026-04-20 evidence:

- Fresh daemon: launch `0f596070-00a0-482d-94ad-3d1dff89d7b7`,
  `clientRequestId`
  `launch:bun:tenant-bun:fresh-daemon-run-001:attempt-1`, ACP session
  `jsmod-4d11f8a1-2b59-4d46-a68d-6eca069f2094`, `ok: true`,
  `launchStatus: "session_ready"`, `stopStatus: "stopped"`.
- Prior daemon reuse: launch `e17748d2-5010-455b-b0f9-2d84aaa8d977`,
  `clientRequestId`
  `launch:bun:tenant-bun:reuse-daemon-run-001:attempt-1`, ACP session
  `jsmod-c54a80ae-8868-4e9e-a9a3-6c60e907dce2`, `ok: true`,
  `launchStatus: "session_ready"`, `stopStatus: "stopped"`.
