# Browser QA: v396 Tier 1 Examples

Branch: `be3/examples-browser-qa`

Scope:

- `examples/02-editable-agent-web`
- `examples/03-tanstack-shaped-app`
- `examples/04-next-basic`
- `examples/05-next-open-cloudflare`

## Static Checks

Run from `/private/tmp/fireline-examples-be3-browser-qa`:

```sh
pnpm install --frozen-lockfile
pnpm run check:surface
pnpm run check:surface:v396
pnpm run typecheck
pnpm run build:editable-agent-web
pnpm run build:tanstack-shaped
pnpm run build:next-basic
pnpm run build:next-open-cloudflare
pnpm run build:opennext-cloudflare
git diff --check
```

Result: all passed.

## Browser Runtime Evidence

Status: historical evidence from before the native `fireline runtime dev`
command landed. These results remain useful as accepted browser cutover
evidence, but current reviewer recipes should use the native runtime-dev
command.

Browser automation used local Google Chrome through a temporary Playwright
driver under `/tmp/fireline-examples-browser-qa-tools`. The driver filled the
Fireline endpoint, clicked the example Run path, captured `screenshot.png`,
`body.txt`, `browser.json`, dev-server logs, and daemon logs, and failed on
page runtime errors.

### 02 Editable Agent Web

Fresh daemon evidence:

Artifact: `/tmp/fireline-examples-browser-qa-02-fresh`

Result: run, follow-up chat, and stop passed. Launch
`31c70ac4-6da3-4c2a-b60f-c50a4f6e7f0f`, session
`jsmod-cb89f70a-6dfd-42a6-83a4-6881d496f485`, final status `stopped`.

Prior-daemon reuse evidence:

Artifact: `/tmp/fireline-examples-browser-qa-02-reuse`

Result: run, follow-up chat, and stop passed. Launch
`51a3af37-035b-4d59-a958-63d496037714`, session
`jsmod-6ee47e6b-99d2-4aba-b941-4e6ae740e5e5`, final status `stopped`.

### 03 TanStack Shaped App

Fresh daemon evidence:

Artifact: `/tmp/fireline-examples-browser-qa-03-fresh`

Result: golden path passed. Launch `ced2a372-645f-4502-b398-505ca67fee8c`,
session `jsmod-25b1d8aa-1355-4995-a375-16bf3bcae6be`, stop reason
`end_turn`.

Prior-daemon reuse evidence:

Artifact: `/tmp/fireline-examples-browser-qa-03-reuse`

Result: golden path passed. Launch `a666be9e-be42-4162-9966-3d4e0c7d5027`,
session `jsmod-52c2b433-701d-4122-9a4f-89e0e50dfeb3`, stop reason
`end_turn`.

### 04 Next Basic

Golden path evidence:

Artifact: `/tmp/fireline-examples-browser-qa-04-golden`

Result: golden path passed. Launch `7ed151ab-7993-4247-b352-dedcce2d0420`,
session `jsmod-95761610-efb5-43f8-ace0-025934ad442d`, stop reason
`end_turn`.

### 05 Next/OpenNext Cloudflare Shape

Golden path evidence:

Artifact: `/tmp/fireline-examples-browser-qa-05-golden`

Result: golden path passed. Launch `b1fe8868-fd75-4548-914f-640b750add9a`,
session `jsmod-b6b31864-a790-4cdd-927d-6cad1303509b`, stop reason
`end_turn`.

## Browser Notes

- Rerun target: use native `fireline runtime dev` for current browser QA.
- Page runtime exceptions: none in all six browser runs.
- Failed requests: only `net::ERR_ABORTED` stream POST/long-poll requests after
  session cleanup/teardown.
- Console notes: dev-server HMR/React DevTools messages, favicon 404 in local
  dev, and Durable Streams HTTP/1.1 concurrency warning on local HTTP endpoints.
- No implementation changes were required for browser usability.
