# Fireline Examples Idiomaticity Audit

Date: 2026-04-20
Base: `main` at `014f3fd`

Companion docs:

- [README.md](README.md) has the first-read example order.
- [API_SURFACE.md](API_SURFACE.md) has the per-example label taxonomy.
- Fireline `mono-da7h` disposition: Cluster A server/Worker wrappers are
  consumer-owned recipes over Tier 1, not a Fireline helper/API gap for this
  milestone. Cluster B middleware backing splits by plane: approval is Fireline
  substrate surfaced through `requiredActions`/`respond`, memory waits on the
  resource-plane decision, and subscriber profiles remain advanced/candidate
  middleware until current live-lowering evidence exists.

## Summary

The v396 example set is functionally cut over to the Tier 1 managed-agent API
for normal TypeScript/runtime examples. The most idiomatic examples are the
smallest ones that expose the app-facing shape directly: `new Fireline({
endpoint })`, `new Agent(...)`, `fireline.run(...)`, `fireline.session(...)`,
`session.chat(...)`, and `session.stop(...)`.

The raw HTTP examples remain intentionally Tier 2 protocol references. They
should not be judged as poor Fireline app examples, because their purpose is to
show the Durable Streams wire contract without SDK help.

The main remaining idiomaticity issue is not stale bridge API usage. It is
local development ergonomics: several advanced examples still require manual
endpoint derivation or two-shell daemon setup, even though their internal
Fireline lifecycle code is on the Tier 1 API.

## Classification

| Example | Classification | Quality verdict | Concrete issue | Owner lane | Recommended next bead |
| --- | --- | --- | --- | --- | --- |
| `01-inline-js-local` | Tier 1 idiomatic baseline | High quality | Best minimal CLI example for `Fireline.run`; matrix is useful but more complex than a first-read quickstart. | TL2 example fix | Add a tiny "minimum viable inline run" snippet or split matrix explanation into an appendix. |
| `02-editable-agent-web` | Tier 1 idiomatic browser app | High quality | Strong one-command dev wrapper and recovery UX. Still exposes endpoint controls because local daemon reuse can drift. | TL2 example fix, TL1 helper/API gap if endpoint discovery should disappear entirely | Keep as primary browser QA example; consider a future helper for browser-local endpoint discovery if PO wants no visible endpoint field. |
| `03-tanstack-shaped-app` | Tier 1 idiomatic framework shape | Good | Now standalone after PR #3; Fireline usage is visible in the example instead of hidden in shared helper code. It still lacks the same one-command daemon wrapper/recovery polish as example 02. | TL2 example fix | Add a `dev:tanstack-shaped` wrapper or README recipe that injects `FIRELINE_ENDPOINT` through `fireline-v3-dev`. |
| `04-next-basic` | Tier 1 idiomatic framework shape | Good | Now standalone after PR #3 and no longer depends on shared helper code. Endpoint entry is still manual and Next dev needs framework-specific build validation. | TL2 example fix | Add a Next fresh/reuse reviewer recipe with `NEXT_PUBLIC_FIRELINE_ENDPOINT` injection through the isolated daemon helper. |
| `05-next-open-cloudflare` | Tier 1 advanced framework shape | Good reference, not first tutorial | Now standalone after PR #3. Fireline usage is visible, but OpenNext/Cloudflare build artifacts and deployment framing make it too heavy as a primary example. | TL2 example fix | Keep as advanced framework reference; add a short "use 04 first" note in local docs if examples are turned into public tutorials. |
| `06-flamecast-v3-shaped` | Tier 1 product-shaped characterization | Good evidence, not canonical product demo | Clean Fireline boundary, but generated harness and product-shaped naming make it a discovery artifact rather than a polished app example. | TL2 example fix | Keep as characterization evidence; if promoted, split the Fireline adapter pattern from Flamecast-specific scaffolding. |
| `07-curl-shell-raw-http` | Tier 2 raw protocol reference | Good for intended purpose | Deliberately teaches `fireline.launch_request` / `fireline.launch_stop` and exact stream URL derivation. This is not an idiomatic app path. | None unless docs confuse it with Tier 1 | Keep as raw shell reference; ensure README always labels it Tier 2. |
| `08-cloudflare-worker-direct` | Tier 1 Worker reference | Good advanced reference | Uses Tier 1 API, but Wrangler local vars require explicit `--var` handling. Not one-command and still asks the reviewer to align daemon and Worker config. | TL2 example fix | Add a wrapper script or package command that starts Wrangler with the derived endpoint vars. |
| `09-python-raw-http` | Tier 2 raw protocol reference | Good for intended purpose | Python stdlib-only flow is intentionally verbose and envelope-heavy. README still teaches `FIRELINE_LAUNCH_CONTROL_STREAM_URL`, which is correct only for Tier 2 raw HTTP. | None unless docs confuse it with Tier 1 | Keep as language-neutral protocol reference; preserve strong Tier 2 label. |
| `10-rust-raw-http` | Tier 2 raw protocol reference | Good for intended purpose | Correctly uses no Fireline crates, but Cargo build cost means it should stay out of lightweight example paths. | None; shared-laptop process only | Keep `CARGO_TARGET_DIR` guidance prominent and avoid putting this on default local smoke paths. |
| `11-server-worker-wrapper` | Tier 1 advanced server boundary reference | High-value advanced example | Auth/idempotency/tenant policy boundary is realistic but too much glue for a first app example. Per `mono-da7h`, this is consumer-authored route policy over Tier 1, not a Fireline helper/API gap. | TL2 docs/ergonomics | Keep as a documented server/Worker recipe; simplify local setup if useful without productizing auth/tenant/idempotency policy in Fireline. |
| `12-vercel-function-node` | Tier 1 Node serverless reference | Good advanced reference | Clean API use, but endpoint derivation and local HTTP harness add boilerplate. | TL2 example fix | Add a shorter one-command package script or document why serverless examples require explicit env. |
| `13-vercel-edge-runtime` | Tier 1 Edge runtime reference | Good but advanced | Uses Tier 1 API and avoids Node built-ins, but bundling through Vite plus `@edge-runtime/vm` is substantial local glue. | TL2 example fix | Keep as reference-only; add a "not first-read" label if docs become public examples. |
| `14-bun` | Tier 1 runtime compatibility reference | Good compatibility evidence | Tier 1 lifecycle is clean. Runtime-specific command and endpoint derivation keep it advanced/reference rather than tutorial-grade. | TL2 example fix | Add package script parity with other smoke commands if Bun remains supported in the example matrix. |
| `15-go-raw-http` | Tier 2 raw protocol reference | Good for intended purpose | Plain Go implementation is intentionally envelope-heavy and still uses raw stream URL config. | None unless docs confuse it with Tier 1 | Keep as raw Go reference; do not add a Fireline Go SDK implication. |
| `16-deno` | Tier 1 runtime compatibility reference | Good compatibility evidence | Tier 1 lifecycle is clean, but Deno Node/npm compatibility and permission flags are noisy. | TL2 example fix; TL1 package/API gap only if Deno should become first-class | Keep as compatibility evidence; do not present as polished Deno SDK experience. |
| `17-acp-registry-chat` | Tier 1 registry/ACP reference | Good specialized reference | Correctly uses `acpRegistry(...)` plus session chat/stop, but registry fixture semantics make it advanced. Binary/env registry gaps remain intentionally out of scope. | TL1 helper/API gap for broader registry distribution support | Keep as safe registry slice; file separate beads for binary install/cache or launcher env metadata only if PO wants those supported. |
| `18-middleware-stack` | Tier 1 middleware reference | Good specialized reference | Trace/context/budget are clean. Per `mono-da7h`, approval can be promoted only through `requiredActions`/`session.respond(...)`, memory waits on the resource-plane decision, and subscriber profiles need current live-lowering evidence before examples teach them. | TL1 substrate/docs for middleware backing; TL2 docs for labels | Keep as conservative middleware example; do not add memory/subscriber examples until the relevant Fireline backing decision/evidence lands. |

## Cross-Cutting Findings

- **Tier 1 API adoption is real:** current normal examples use
  `@fireline/client/managed-agent`; direct `@fireline/client/spec`,
  `@fireline/client/events`, `@fireline/state`, and
  `@fireline/client/acp-browser` imports are absent from the current Tier 1
  example set.
- **Shared lifecycle helpers are gone:** `examples/shared/managed-agent-launch.ts`,
  `examples/shared/stream-launch.ts`, and `examples/shared/run-inline-fireline.ts`
  are no longer present on main. Examples 03/04/05 now carry their Fireline
  code locally, which makes the Tier 1 shape easier to review.
- **Endpoint handling is the biggest UX rough edge:** example 02 is the best
  model because it wraps `fireline-v3-dev`, injects `FIRELINE_ENDPOINT`, and
  gives recovery guidance. Most advanced examples still require explicit
  daemon/stream alignment.
- **Raw examples should stay separate:** examples 07/09/10/15 intentionally
  teach `fireline.launch_request` / `fireline.launch_stop` and exact stream URL
  derivation. They are useful protocol references, but should not be used as
  the primary Fireline app experience.
- **Advanced runtime examples are good evidence, not first tutorials:** Worker,
  server-wrapper, Vercel, Edge, Bun, Deno, registry, and middleware examples
  validate important surfaces, but their local setup burden makes them
  reference-grade until wrapper scripts and shorter reviewer recipes exist.

## Recommended Dispatch Order

1. **TL2 example fix:** add isolated-daemon wrapper recipes or package scripts
   for examples 03/04/05/08/12/13/14/16/17/18, using example 02 as the UX
   reference.
2. **TL2 docs cleanup:** add explicit "first-read", "advanced reference", and
   "Tier 2 protocol reference" labels to the README table once PO decides how
   public-facing the examples repo should be.
3. **TL2 docs/ergonomics:** treat server/Worker auth, idempotency, and
   tenant-policy wrappers as consumer-owned recipes over Tier 1, per
   `mono-da7h`; do not wait for a Fireline helper to proceed on 08/11/12/13.
4. **TL1/TL2 middleware sequencing:** approval examples must use
   `requiredActions` / `session.respond(...)`; memory waits on the
   resource-plane decision; webhook/Telegram/auto-approve/wakeDeployment need
   current live-lowering evidence before runnable examples promote them.
5. **TL2 evidence sweep:** rerun fresh/reuse quality-bar evidence after any
   wrapper-script changes and store artifact paths in the relevant README or
   friction log.

## Validation For This Audit

This PR is report-only. No implementation files were changed.
