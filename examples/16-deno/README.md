# Deno Package Consumer

Discovery-only Deno example. It validates that Deno can resolve Fireline's
package-shaped TypeScript surfaces from the repo `node_modules` install:

1. derive the launch/control stream URL from deployment environment;
2. build a launch spec with `@fireline/client/spec`;
3. append `fireline.launch_request` with `@fireline/client/events`;
4. observe `collections.launches` with `@fireline/state`;
5. append `fireline.launch_stop`;
6. print a compact JSON result.

This is not a public Deno SDK. It is an external consumer shape for Deno's
resolver against the current package artifact channel. It does not import
Fireline source files, private package paths, the retired launch HTTP endpoint,
or the retired launch-control client subpath.

## Files

- `main.ts`: Deno script using documented Fireline package subpaths only.

## Reviewer Reproduce

The repo uses package-shaped git artifact refs in `package.json`, not Fireline
source imports or local tarballs. Deno is pinned as a dev tool so reviewers do
not need a machine-global Deno install.

Cheap checks:

```sh
export FIRELINE_EXAMPLES_ROOT=/Users/gnijor/gurdasnijor/fireline-examples
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" install --frozen-lockfile
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run check:deno
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" run check:surface
pnpm --dir "$FIRELINE_EXAMPLES_ROOT" exec tsc --noEmit --pretty false
```

Fresh-daemon scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-14/fresh-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4616 \
FIRELINE_STREAMS_PORT=7716 \
FIRELINE_CONTROL_STREAM=fireline-deno-fresh \
DENO_EXAMPLE_RUN_ID=fresh-daemon-run-001 \
DENO_EXAMPLE_ATTEMPT_ID=attempt-1 \
pnpm --dir "$EX" run smoke:deno
```

Prior-daemon reuse scenario:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
export STATE=/tmp/fireline-mono-oet-29-3-14/reuse-state
rm -rf "$STATE"
mkdir -p "$STATE"
cd "$STATE"
FIRELINE_STATE_DIR="$STATE" \
FIRELINE_PORT=4617 \
FIRELINE_STREAMS_PORT=7717 \
pnpm --dir "$EX" exec fireline-v3-dev \
  --state-stream fireline-deno-reuse
```

In another shell:

```sh
export EX=/Users/gnijor/gurdasnijor/fireline-examples
env FIRELINE_DURABLE_STREAMS_URL="http://127.0.0.1:7717/v1/stream" \
  FIRELINE_CONTROL_STREAM="fireline-deno-reuse" \
  DENO_EXAMPLE_RUN_ID="reuse-daemon-run-001" \
  DENO_EXAMPLE_ATTEMPT_ID="attempt-1" \
  pnpm --dir "$EX" exec deno run \
    --node-modules-dir=manual \
    --allow-net=127.0.0.1 \
    --allow-env=FIRELINE_LAUNCH_CONTROL_STREAM_URL,FIRELINE_DURABLE_STREAMS_URL,FIRELINE_STREAMS_PORT,FIRELINE_CONTROL_STREAM,DENO_EXAMPLE_TENANT_ID,DENO_EXAMPLE_RUN_ID,DENO_EXAMPLE_ATTEMPT_ID,DENO_EXAMPLE_PROMPT,NODE_ENV \
    "$EX/examples/16-deno/main.ts"
```

Both runs should print JSON with `ok: true`, `deno: true`, `launchStatus:
"session_ready"`, and `stopStatus: "stopped"`.

## Local Evidence

BE3 `mono-oet.29.3.14` uses scratch state and logs under
`/tmp/fireline-mono-oet-29-3-14`.

Checks:

```sh
pnpm run check:deno
pnpm run check:surface
pnpm exec tsc --noEmit --pretty false
```

Fresh-daemon E2E:

```sh
FIRELINE_STATE_DIR=/tmp/fireline-mono-oet-29-3-14/fresh-state \
FIRELINE_PORT=4616 \
FIRELINE_STREAMS_PORT=7716 \
FIRELINE_CONTROL_STREAM=fireline-deno-fresh \
DENO_EXAMPLE_RUN_ID=fresh-daemon-run-001 \
DENO_EXAMPLE_ATTEMPT_ID=attempt-1 \
pnpm --dir /Users/gnijor/gurdasnijor/fireline-examples run smoke:deno
```

Result: `ok: true`, `deno: true`, `launchStatus: "session_ready"`, and
`stopStatus: "stopped"`. Log:
`/tmp/fireline-mono-oet-29-3-14/fresh.log`.

Prior-daemon reuse E2E used `/tmp/fireline-mono-oet-29-3-14/reuse-state`,
ports `4617` and `7717`, control stream `fireline-deno-reuse`, then ran the
Deno script against the already-running daemon.

Result: `ok: true`, `deno: true`, `launchStatus: "session_ready"`, and
`stopStatus: "stopped"`. Logs:
`/tmp/fireline-mono-oet-29-3-14/reuse-daemon.log` and
`/tmp/fireline-mono-oet-29-3-14/reuse-run.log`.
