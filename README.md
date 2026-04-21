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

Integration policy:

- `main` is the reviewer and PO testing base. Once an examples bead is accepted,
  integrate it into `main` rather than leaving it only on a per-bead branch.
- Per-bead branches and worktrees are scratch space for implementation and
  evidence collection. They are not the durable handoff surface.
- Keep runnable examples on package-shaped Fireline refs. Do not switch this
  repo to Fireline source-tree imports to make local development easier.

Read examples in this order:

1. **First-read:** `examples/01-inline-js-local` is the smallest runnable
   Tier 1 command-line shape for `new Fireline({ endpoint })`,
   `new Agent(...)`, and `fireline.run(...)`.
2. **First-read:** `examples/02-editable-agent-web` is the primary browser
   app shape for `fireline.session(...)`, `session.chat(...)`, and
   `session.stop(...)`.
3. **First-read:** `examples/03-tanstack-shaped-app` shows a small
   Vite/TanStack app using the same Tier 1 package surface.
4. **First-read:** `examples/04-next-basic` is the smallest Next app shape.
5. **Advanced reference:** use `examples/05-next-open-cloudflare`,
   `examples/06-flamecast-v3-shaped`, `examples/08-cloudflare-worker-direct`,
   `examples/11-server-worker-wrapper`, `examples/12-vercel-function-node`,
   `examples/13-vercel-edge-runtime`, `examples/14-bun`,
   `examples/16-deno`, `examples/17-acp-registry-chat`, and
   `examples/18-middleware-stack` after the first-read examples.
6. **Tier 2 protocol reference:** use `examples/07-curl-shell-raw-http`,
   `examples/09-python-raw-http`, `examples/10-rust-raw-http`, and
   `examples/15-go-raw-http` only when you need the raw Durable Streams
   protocol shape without Fireline helper packages.

See [API_SURFACE.md](API_SURFACE.md) for the full per-example label taxonomy
and [EXAMPLES_IDIOMATICITY_AUDIT.md](EXAMPLES_IDIOMATICITY_AUDIT.md) for the
reasoning behind the ordering.

Current checkpoint:

- `examples/01-inline-js-local` is TypeScript-authored and launches an inline
  JS local matrix through the Tier 1 managed-agent surface:
  `new Fireline({ endpoint })`, `new Agent(...)`, and `fireline.run(...)`.
- `examples/02-editable-agent-web` is a TypeScript/TSX app-shaped discovery
  example for the Tier 1 `@fireline/client/managed-agent` app API. It lets a
  user edit inline agent code, start a session with `fireline.session(...)`,
  send prompts through `session.chat(...)`, inspect `SessionSnapshot`
  coordinates, and stop through `session.stop(...)`.
- `examples/03-tanstack-shaped-app`, `examples/04-next-basic`, and
  `examples/05-next-open-cloudflare` are framework-shaped TypeScript discovery
  examples. They keep Fireline calls package-shaped and use the Tier 1
  managed-agent surface for `new Fireline({ endpoint })`, `new Agent(...)`,
  and `fireline.run(...)` while recording framework seams instead of
  canonizing product examples.
- `examples/06-flamecast-v3-shaped` is a black-box product-consumer
  characterization. It is not real Flamecast v3 code. It keeps a framework
  boundary separate from the Fireline adapter, generates a multi-file inline
  harness bundle, and uses the Tier 1 managed-agent surface for
  `new Fireline({ endpoint })`, `new Agent(...)`, `fireline.session(...)`,
  `session.chat(...)`, and `session.stop(...)`.
- `examples/07-curl-shell-raw-http` is a shell/curl raw Durable Streams HTTP
  consumer. It builds the launch/stop envelopes locally, appends them with
  `curl`, and observes backing `fireline.launch` rows without Fireline helper
  packages.
- `examples/08-cloudflare-worker-direct` is a direct Cloudflare Worker
  consumer using the Tier 1 managed-agent API in a Worker-safe package shape.
  It uses explicit `pnpm dlx wrangler@4.83.0` commands and documents the
  Wrangler `--var` behavior required for custom scratch ports.
- `examples/09-python-raw-http`, `examples/10-rust-raw-http`, and
  `examples/15-go-raw-http` are raw Durable Streams HTTP consumers. They do
  not import Fireline packages, crates, or SDKs; they build
  `fireline.launch_request` / `fireline.launch_stop` envelopes and observe
  first-class `fireline.launch` rows over plain HTTP.
- `examples/11-server-worker-wrapper` is a server/Worker boundary pattern. The
  app-facing layer has no Fireline imports; the server wrapper owns auth,
  tenant checks, idempotency, and Tier 1 Fireline session calls.
- `examples/12-vercel-function-node` is a Vercel Functions Node-runtime shape.
  It uses the Tier 1 managed-agent API inside a Node function.
- `examples/13-vercel-edge-runtime` is a Vercel Edge Runtime shape. It bundles
  an Edge handler that uses the Tier 1 managed-agent API, then runs locally in
  `@edge-runtime/vm`.
- `examples/14-bun` is a Bun runtime shape. It runs with `bun`, uses the root
  package-shaped Fireline refs, and uses the Tier 1 managed-agent API.
- `examples/16-deno` is a Deno package-consumer shape. It uses the Tier 1
  managed-agent API through Deno's Node/npm compatibility layer.
- `examples/17-acp-registry-chat` resolves a safe ACP registry fixture row
  with `acpRegistry(...)` from `@fireline/client`, launches the resulting command
  distribution through the Tier 1 managed-agent API, sends a follow-up prompt,
  and stops the session. It deliberately avoids
  binary registry installs, launcher env metadata, retired launch-control
  surfaces, and hand-rolled lifecycle primitives.
- `examples/18-middleware-stack` is a focused middleware-stack consumer. It
  builds a middleware stack with `trace(...)`, `contextInjection(...)`, and
  `budget(...)`, then runs through the Tier 1 managed-agent API. It
  deliberately avoids `memory()`,
  approval gates, launch-control HTTP, `/v1/launches`, Fireline internals, and
  hand-rolled lifecycle primitives.

Surface posture:

- Tier 1 canonical TypeScript app API:
  `new Fireline({ endpoint })`, `new Agent(...)`, `fireline.session(...)`,
  `session.chat/respond/stop`, and `fireline.run(...)` from
  `@fireline/client/managed-agent`.
- Tier 2 protocol/runtime reference:
  raw Durable Streams HTTP plus the `@fireline/runtime` command path after the
  `mono-ug3b` runtime-dev replacement lands.
- Tier 3 primitive escape hatch:
  `@fireline/client/spec`, `@fireline/client/events`, `@fireline/state`, and
  `@fireline/client/acp-browser`.

Normal TypeScript app examples should use Tier 1 where the helper covers the
flow. Raw HTTP and language-neutral examples stay Tier 2 references. Tier 3
primitive usage is still allowed for escape-hatch evidence or explicit helper
gap discovery, but it is not the canonical app-facing path.

Setup:

```sh
pnpm install
pnpm run check
```

The package refs are immutable git artifact refs from Fireline's pre-npm
artifact channel. They are package-shaped reviewer refs, not public npm
releases.

Local runtime-dev recipes are temporarily blocked on Fireline `mono-ug3b`.
Fireline PR #349 deleted the old local runtime dev wrapper before the
replacement implementation landed, so this repo should not teach copy-paste
daemon commands as current reviewer recipes. Until `mono-ug3b` lands, use the
static checks and framework builds below for local validation, and treat older
fresh/reuse runtime evidence as historical evidence only.

Framework-shaped checks:

```sh
pnpm run build:tanstack-shaped
pnpm run build:next-basic
pnpm run build:next-open-cloudflare
pnpm run build:opennext-cloudflare
pnpm run build:vercel-edge-runtime
```

The OpenNext/Cloudflare build uses the local adapter shape only. It is not a
deployment recipe.
