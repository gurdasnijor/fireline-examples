# Runtime E2E Sweep

Branch: `be4/examples-runtime-e2e-sweep`
Base: `main` at `67be9728f9cb74a92abd0cea19557b9612c8477e`

## Runtime Dev Status

This document records accepted historical evidence from the pre-native
runtime-dev path. Current reruns should use native `fireline runtime dev`.

Do not use the historical artifact paths below as current runnable recipes.
Use `fireline runtime dev` for new fresh-daemon and prior-daemon reuse sweeps.
For sibling Fireline source validation, build the local runtime binaries and
put them first on `PATH` instead of adding example-local wrappers:

```sh
cd /Users/gnijor/gurdasnijor/fireline
cargo build --locked --bin fireline --bin fireline-streams

cd /Users/gnijor/gurdasnijor/fireline-examples
PATH=/Users/gnijor/gurdasnijor/fireline/target/debug:$PATH pnpm dev:editable-agent-web
```

## Static Checks

Run from `/private/tmp/fireline-examples-be4-runtime-e2e`:

```sh
pnpm install --frozen-lockfile
pnpm run check:surface
pnpm run check:surface:v396
pnpm run typecheck
pnpm run build:vercel-edge-runtime
git diff --check
```

Result: all passed.

Owned runtime/server surface audit:

```sh
rg -n "Discovery-only|Tier 3|until.*cutover|until.*land|not a public|not a Fireline API wrapper|launch-handle|launch-control|retired|FIRELINE_ENDPOINT legacy alias|createManagedAgentClient|createManagedAgentLaunchRequest|ManagedAgentLaunchHandle|launchAgent|launchControlStreamUrl|bridge env|bridge vocabulary" \
  examples/08-cloudflare-worker-direct \
  examples/11-server-worker-wrapper \
  examples/12-vercel-function-node \
  examples/13-vercel-edge-runtime \
  examples/14-bun \
  examples/16-deno \
  examples/17-acp-registry-chat \
  examples/18-middleware-stack \
  -g '*.{ts,tsx,js,md,toml}'
```

Result: no matches.

## Historical E2E Result

Every runtime/server example reached a ready session and a stopped row in both
fresh-daemon and prior-daemon reuse scenarios before #349 removed the JS
runtime-dev entrypoint.

| Example | Fresh artifact | Reuse artifact | Result |
| --- | --- | --- | --- |
| 08 Cloudflare Worker direct | `/tmp/fireline-examples-runtime-e2e-08-fresh` | `/tmp/fireline-examples-runtime-e2e-08-reuse` | `launchStatus: "session_ready"`, `stopStatus: "stopped"` |
| 11 server/Worker wrapper | `/tmp/fireline-examples-runtime-e2e-11-fresh` | `/tmp/fireline-examples-runtime-e2e-11-reuse` | `launchStatus: "session_ready"`, `stopStatus: "stopped"` |
| 12 Vercel Function Node | `/tmp/fireline-examples-runtime-e2e-12-fresh` | `/tmp/fireline-examples-runtime-e2e-12-reuse` | `launchStatus: "session_ready"`, `stopStatus: "stopped"` |
| 13 Vercel Edge | `/tmp/fireline-examples-runtime-e2e-13-fresh` | `/tmp/fireline-examples-runtime-e2e-13-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |
| 14 Bun | `/tmp/fireline-examples-runtime-e2e-14-fresh` | `/tmp/fireline-examples-runtime-e2e-14-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |
| 16 Deno | `/tmp/fireline-examples-runtime-e2e-16-fresh` | `/tmp/fireline-examples-runtime-e2e-16-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |
| 17 ACP registry chat | `/tmp/fireline-examples-runtime-e2e-17-fresh` | `/tmp/fireline-examples-runtime-e2e-17-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |
| 18 middleware stack | `/tmp/fireline-examples-runtime-e2e-18-fresh` | `/tmp/fireline-examples-runtime-e2e-18-reuse` | `sessionStatus: "session_ready"`, `stopStatus: "stopped"` |

The historical Vercel Edge bundle build log was at
`/tmp/fireline-examples-runtime-e2e-edge-build.log`.

## Rerun Plan

Rerun the same fresh-daemon and prior-daemon reuse scenarios for examples 08,
11, 12, 13, 14, 16, 17, and 18. The runtime dev command must inject:

```sh
FIRELINE_ENDPOINT=<full appendable launch/control stream URL>
```

The examples should pass that value directly to `new Fireline({ endpoint })`
or expose it to the browser as the app-facing endpoint value. Do not re-add
deleted JS runtime-dev recipes, temporary binary wrappers, or mandatory
`--durable-streams-url` flags to synthesize the endpoint.

## Notes

- No Fireline source imports were introduced.
- No Tier 2 raw examples were modified or run for this sweep.
- Owned READMEs now describe these examples as current Tier 1
  `Fireline`/`Agent`/session examples.
