# Friction Log

This is a discovery log, not a product roadmap. Each item should either become
a Fireline bead or be closed as an intentional boundary.

## Findings

1. The repo had to be converted to TypeScript after the first checkpoint.

   External consumers are expected to author TypeScript, so examples, harnesses,
   and guard scripts now use `.ts` sources and `pnpm run typecheck`. Plain JS
   should only appear as generated output or inline agent bundle content.

2. Git artifact refs are package-shaped but not public npm.

   The spike now installs immutable git artifact refs for `@fireline/client`,
   `@fireline/runtime`, and `@fireline/state`. This removes the old local
   tarball choreography and pnpm integrity churn from refreshed `/tmp`
   artifacts. It is still a pre-npm integration channel, so normal public
   consumers still need the public package-name/release decision to land.

   Historical note: earlier `mono-oet.29.3.1` smokes pinned local tarballs and
   a direct `@fireline/runtime-darwin-arm64` platform tarball because the local
   meta package's optional platform dependency did not materialize reliably.

3. Runtime platform tarballs installed native binaries without executable bits.

   Historical blocker `mono-oet.29.4` is closed by Fireline PR #210. Checkpoint
   smokes no longer use `FIRELINE_BIN` or `FIRELINE_STREAMS_BIN` overrides.

4. Inline JS module runner internal resolution is retired.

   Fireline PR #300 / `mono-oet.29.25.4` moved the JS module runner ownership
   out of the private client subpath that earlier evidence logged. Current
   examples do not import or configure Fireline internal package paths. The
   surface checker now rejects private Fireline subpaths instead of allowing a
   compatibility exception.

5. Scratch state directory control is not obvious from the runtime command.

   `fireline-streams --help` exposes host and port, but no state-directory flag.
   The team hygiene rule uses `FIRELINE_STATE_DIR`; this example records and
   exports it, but the current binary surface does not make the behavior
   discoverable.

6. The managed-agent path now owns the normal app lifecycle.

   The mono-v396 cutover moves examples 01, 02, 03, 04, 05, and 06 to
   `@fireline/client/managed-agent` for `new Fireline({ endpoint })`,
   `new Agent(...)`, `fireline.run(...)`, `fireline.session(...)`,
   `session.chat(...)`, and `session.stop(...)`. That removes direct stream row
   append, launch collection observation, direct browser ACP attachment, and
   request-builder teaching from normal ergonomic examples.

7. Local runtime/bootstrap discovery is still uneven across examples.

   Historical pre-#349 evidence made the public
   `pnpm run dev:editable-agent-web` command start through the old runtime dev
   wrapper and inject the exported `FIRELINE_ENDPOINT` into Vite. Fireline PR
   #349 deleted that wrapper before the `mono-ug3b` replacement landed, so
   current docs should treat fresh/reuse runtime recipes as rerun-needed. The
   private Vite child script still derives
   `http://127.0.0.1:7474/v1/stream/fireline-examples-control` when run on its
   own, probes the local streams health endpoint, and shows a copyable
   derivation for custom ports or stream names. On `Stream not found`/404, the
   UI names the missing stream and shows restart or exact-URL recovery
   instructions. Other Tier 1 examples still require the app-facing
   `FIRELINE_ENDPOINT` and a local runtime dev process to point at the same
   durable stream. This is intentionally explicit in the discovery repo, but a
   normal external consumer should not have to assemble that alignment by hand.
   Follow-up bead candidate: endpoint/bootstrap discovery for local apps.

   `mono-oet.29.3.20` prior-daemon evidence originally found a substrate
   blocker: the old runtime dev wrapper could reuse an existing daemon, export
   an endpoint for its default daemon stream, and then
   fail append with `HTTP Error 404 ... Stream not found:
   fireline-v3-dev-daemon`. Fireline PR #291 / `mono-oet.29.3.22` fixed that
   launcher/stream mismatch by creating and verifying the exported stream
   before child startup. That evidence is historical until `mono-ug3b` lands.
   The examples branch keeps diagnostics and recovery guidance for genuinely
   stale port/process/store reuse.

8. Stream-native stop is usable, and managed-agent hides it for normal ergonomic examples.

   Fireline PR #242 landed `appendLaunchStop` and daemon stop projection. The
   lower-level examples can append stop rows and observe `stopped` launch rows
   instead of teaching the old HTTP stop path. Tier 1 examples now call
   `session.stop(...)`, so normal app examples no longer assemble the stop
   envelope and observation loop directly.

9. `@fireline/state` live observation needs repro against current artifacts.

   Fireline PR #245 fixed the duplicate bare/prefixed launch row shape. The
   examples now match exact bare `launchId` values, and the `mono-oet.29.3.1`
   smoke observed one target row per validated launch.

   Earlier evidence logged `Symbol(liveQueryInternal)` failures while direct
   state observers processed `fireline.runtime_instance` rows. After #293 and
   the managed-agent cutover, normal examples no longer teach direct
   `@fireline/state` launch observation. Treat this as needs-repro against the
   current published managed-agent artifacts before reopening it as a substrate
   gap.

10. Browser ACP attachment is hidden from the normal editable-agent flow.

   `examples/02-editable-agent-web` now uses the Tier 1 session helper. The
   browser app starts a session with `fireline.session(...)`, sends prompts
   with `session.chat(...)`, subscribes to `SessionSnapshot`, and stops with
   `session.stop(...)`. Direct browser ACP connection management remains Tier 3
   escape-hatch evidence, not normal app teaching.

11. Unsupported placement and middleware choices are visible but disabled.

   The web app only enables inline JS local brain placement, local or stream
   filesystem placement, and trace/context/budget middleware. Remote brain,
   registry ACP agent, Docker/provider-backed hands, remote hands, approval,
   webhook, Telegram, memory, secrets, and external tool attachment are not
   faked in this checkpoint.

12. Some roughness belongs to the discovery example.

   The UI keeps endpoint fields editable, stores no preferences, uses a basic
   textarea instead of a code editor, and renders session updates as raw text.
   Those are acceptable discovery-repo shortcuts and should not drive Fireline
   API shape unless repeated by real consumers.

13. Framework apps need a server/Worker stream-append pattern.

   The Next and OpenNext/Cloudflare-shaped examples place Fireline launch code
   behind `"use client"` pages. That keeps current package-shaped imports out
   of Next server components and Cloudflare Worker server bundles. Real apps
   may need a Worker/server pattern for auth, idempotency, tenant policy, and
   secret handling around stream append.

   `examples/11-server-worker-wrapper` demonstrates the consumer-authored
   pattern without changing Fireline. It uses the Tier 1 `Fireline` / `Agent` /
   session API at the Fireline boundary, but it does not solve
   framework-specific bundling constraints for every runtime and it is not a
   public helper API.

14. Next/Turbopack and NodeNext TypeScript disagree on import style.

   The repo-level `tsc --moduleResolution NodeNext` wants explicit `.js`
   extensions for relative TypeScript imports. Next/Turbopack client builds
   failed on `./run-inline-launch.js` and required extensionless imports in the
   Next app files. The root typecheck therefore excludes the Next example
   directories and relies on `next build` for those framework checks. This is a
   framework/repo-shape seam, not a Fireline API bug.

15. OpenNext expects an app-local build script and creates adapter output.

   `opennextjs-cloudflare build` shells out to `pnpm build` from the app
   directory, so the OpenNext-shaped example needs an app-local `package.json`
   even though the repo is otherwise a single package. The build also writes
   `.open-next/` and `.wrangler/`, which are ignored. This is framework
   scaffolding roughness, not Fireline API surface.

16. Flamecast-shaped consumers now use the managed-agent app helper boundary.

   `examples/06-flamecast-v3-shaped` keeps a realistic framework boundary,
   generated multi-file harness bundle, and Fireline adapter. The adapter now
   uses `new Fireline({ endpoint })`, `new Agent(...)`,
   `fireline.session(...)`, `session.chat(...)`, and `session.stop(...)`. The
   shape is useful as characterization evidence for product framework
   boundaries without teaching lower-level spec/event/state composition as the
   normal app path.

17. Follow-up prompts are no longer hand-wired in normal managed-agent examples.

   The Flamecast-shaped example now sends the follow-up through
   `session.chat(...)`. The example no longer teaches separate runtime ACP URL,
   session-coordinate plumbing, or direct browser ACP attachment for the common
   app path.

18. Package-shaped evidence now uses git artifact refs, but public npm is still gated.

   `mono-oet.28.30` added the stable pre-npm package artifact channel. This
   branch pins immutable git artifact refs for `@fireline/client`,
   `@fireline/state`, and `@fireline/runtime`, so reviewers no longer need to
   download workflow artifacts or stage same-name tarballs under `/tmp`.

   This is still not public npm. Public package naming and release semantics
   remain gated on Fireline `mono-oet.21.1.5` and TL1/PO signoff.

19. Fresh-daemon wrapper lifetime is not intuitive.

   The fresh-daemon command form successfully ran the child example and printed
   the expected JSON summary, but the wrapper daemon process stayed alive until
   the scratch process was explicitly stopped. This is acceptable for local dev,
   but copy-paste smoke recipes need an explicit cleanup expectation.

20. Runtime close noise is still visible even on successful runs.

   Both fresh-daemon and prior-daemon reuse scenarios completed with
   `followUpSent: true` and `stopStatus: "stopped"`. Older logs showed
   `Symbol(liveQueryInternal)` durable-state/TanStack DB errors while
   processing `fireline.runtime_instance` rows; that needs repro against
   current published managed-agent artifacts before being treated as still
   open. The runtime also logged ACP websocket reset/closed warnings during
   teardown. These did not fail the example, but they remain non-happy-path
   reviewer noise.

21. Server/Worker wrapper is a pattern, not a hidden Fireline abstraction.

   `examples/11-server-worker-wrapper` validates the desired placement for
   auth, tenant policy, idempotency, launch append, launch observation, and
   stop. The wrapper now uses `@fireline/client/managed-agent` for request
   construction and lifecycle flow instead of Tier 3 spec/events/state
   composition.

   Non-happy-path observation: successful fresh-daemon and prior-daemon reuse
   runs still print ACP websocket reset/closed warnings during teardown. The
   example output is correct (`accepted: true`, `session_ready`, `stopped`),
   but reviewer logs still contain runtime teardown noise.

22. Raw HTTP examples are clear but intentionally low-level.

   `examples/07-curl-shell-raw-http`, `examples/09-python-raw-http`,
   `examples/10-rust-raw-http`, and `examples/15-go-raw-http` prove that
   shell, Python, Rust, and Go consumers can use Fireline through the Durable
   Streams wire contract without helper packages, crates, or SDKs. They also
   make the trade-off visible: consumers must build the
   `fireline.launch_request` and `fireline.launch_stop` envelopes, poll/read
   stream rows, and filter `fireline.launch` records themselves.

23. Direct Cloudflare Worker usage is package-shaped Tier 1 managed-agent evidence.

   `examples/08-cloudflare-worker-direct` proves the direct Worker shape can be
   expressed with the Tier 1 `Fireline` / `Agent` / session API and without
   Next.js, OpenNext, launch-control HTTP, or Fireline source internals.

   `mono-oet.29.3.21.3` retro smoke passed both quality-bar scenarios:
   fresh scratch daemon on `5544`/`8581` with Wrangler on `8787`, and
   prior-daemon reuse with the same daemon still bound and Wrangler restarted on
   `8788`. Both `POST /demo` calls returned launch rows with ACP session
   coordinates and stopped rows. Non-happy-path note: Wrangler local dev used
   `wrangler.toml` `[vars]` over shell environment variables, so scratch ports
   needed explicit `--var FIRELINE_STREAMS_PORT:...` and exact endpoint flags.

24. Editable-agent-web naive dev previously did not own daemon startup.

   `mono-oet.29.3.25` reproduced the zero-opaque-config gap: a user could run
   `pnpm run dev:editable-agent-web` with no pre-started daemon and no Vite
   endpoint, leaving the browser to depend on fallback derivation
   rather than the daemon's exported URL. Historical fresh and prior-daemon
   runs injected a daemon endpoint into the Vite environment and launch/stop
   completed. This evidence must be rerun after `mono-ug3b` restores the
   runtime dev implementation. Older evidence logged
   `Symbol(liveQueryInternal)` durable-state/TanStack DB warnings while
   processing `fireline.runtime_instance`; that needs repro against current
   published managed-agent artifacts before being treated as still open.

25. Editable-agent-web now uses the Tier 1 managed-agent session surface.

   `mono-4rv` restores the accepted `mono-oet.29.3.32.1` cutover on main:
   `examples/02-editable-agent-web` no longer imports Tier 3 spec builders,
   direct state observation, removed stream lifecycle helpers, or direct
   `@fireline/client/acp-browser` for the normal app lifecycle. The app now
   creates `new Fireline({ endpoint })`, creates `new Agent(...)`, starts with
   `fireline.session(...)`, sends prompts through `session.chat(...)`, observes
   `SessionSnapshot`, and stops through `session.stop(...)`.

   Fresh-daemon and prior-daemon reuse browser E2E were rerun for this import
   graph restoration. Successful runs still can print known ACP websocket
   close/reset teardown warnings after the UI flow has completed.

26. Vercel Functions Node uses the Tier 1 managed-agent API.

   `examples/12-vercel-function-node` validates the Node serverless case that
   can run Fireline package refs in a Node function using the Tier 1
   `Fireline` / `Agent` / session API.

   This is useful for Vercel Functions and other Node serverless handlers, but
   it is still a discovery example, not a stable high-level SDK.

   Fresh-daemon and prior-daemon reuse E2E both passed. The same teardown noise
   seen in other inline JS module examples remains visible: ACP websocket
   reset/closed warnings can appear after the example has already returned
   `ok: true`, `session_ready`, and `stopped`.

27. Vercel Edge Runtime uses the Tier 1 managed-agent API and still needs bundling.

   `examples/13-vercel-edge-runtime` validates an Edge handler that avoids Node
   built-ins and root `@fireline/client`, then runs locally in
   `@edge-runtime/vm`. The handler uses Worker-safe
   `@fireline/client/managed-agent` for the Tier 1 session flow.

   This is useful for Vercel Edge-style handlers and other Web Runtime
   consumers, but it still requires the app to derive an endpoint, bundle the
   handler for the Edge runtime, and choose a stable `clientRequestId`.

   Fresh-daemon and prior-daemon reuse E2E both passed. Successful runs can
   still print the same ACP websocket reset/closed teardown warnings seen in
   other inline JS module examples; TL1 tracks that separately under
   `mono-oet.29.3.24`.

28. Bun can resolve package-shaped refs and run the Tier 1 managed-agent API.

   `examples/14-bun` validates a Bun process that imports package-shaped
   Fireline refs with the Tier 1 `Fireline` / `Agent` / session API.

   This proves the current git artifact package refs are usable from Bun
   without Fireline source imports, but it still requires the app to derive an
   endpoint and choose a stable `clientRequestId`.

   Fresh-daemon and prior-daemon reuse E2E both passed. Successful runs can
   still print the same ACP websocket reset/closed teardown warnings seen in
   other inline JS module examples; TL1 tracks that separately under
   `mono-oet.29.3.24`.

29. Go raw HTTP works without an SDK, but repeats the low-level envelope burden.

   `examples/15-go-raw-http` validates a plain Go consumer using only standard
   library HTTP/JSON/crypto/filesystem packages. Fresh-daemon and prior-daemon
   reuse E2E both passed, and the example appended
   `fireline.launch_request` / `fireline.launch_stop` events and observed a
   final `stopped` `fireline.launch` row.

   The friction is the same as the other raw HTTP examples: the consumer owns
   branded inline bundle artifact construction, launch/stop envelope shape,
   idempotency keys, stream URL derivation, repeated stream reads, and launch
   row filtering. Successful fresh-daemon logs also showed the known ACP
   websocket reset/closed teardown warning; the Go example did not patch around
   it.

30. Deno can consume package-shaped managed-agent helpers, but Node compatibility needs explicit permissions.

   `examples/16-deno` validates Deno 2.x resolving
   `@fireline/client/managed-agent` through the repo package install.
   Fresh-daemon and prior-daemon reuse E2E both passed with Deno running
   through `--node-modules-dir=manual`.

   The main Deno-specific friction is permission/configuration shape:
   `--allow-net=127.0.0.1` is required for the local streams server, and
   `--allow-env` must include the Fireline example variables plus `NODE_ENV`
   because transitive Node-compat checks in the package stack read it. This is
   acceptable discovery evidence, not a polished Deno SDK experience.

31. ACP registry resolution works for the safe command slice, but real catalog coverage is still gated.

   `examples/17-acp-registry-chat` validates `acpRegistry(...)` with an inline
   ACP registry fixture row that lowers to the currently supported `command`
   distribution. The resolved agent launches through the same stream-native
   path as the other examples, middleware decoration works, ACP attachment
   works, a follow-up prompt returns `end_turn`, and stop reaches `stopped`.

   Fresh-daemon and prior-daemon reuse E2E both passed. The example
   intentionally does not use public binary-only rows or env-bearing rows.
   Binary registry install/cache remains fail-closed pending TL1/PO signoff and
   implementation from `mono-oet.26.6`; launcher env metadata remains out of
   scope for this slice. Successful runs can still show the known ACP websocket
   reset/closed teardown warnings tracked separately under
   `mono-oet.29.3.24`.

32. Middleware stack evidence is Tier 1, but only the conservative stack is runnable today.

   `examples/18-middleware-stack` validates the current external-consumer
   middleware path with `trace(...)`, `contextInjection(...)`, and `budget(...)`
   from `@fireline/client/middleware` around the Tier 1 managed-agent session
   flow.

   This slice intentionally does not use `memory()` because the host-side
   MCP/proxy backing is not part of this examples bead. It also avoids approval
   gates and webhook/Telegram durable-subscriber profiles because the quality
   bar for this example is a bounded launch/observe/stop smoke, not an
   end-to-end approval or subscriber delivery test.

   Fresh-daemon and prior-daemon reuse E2E both passed. Each run returned
   `ok: true`, `middlewareKinds: ["trace", "contextInjection", "budget"]`,
   a `session_ready` launch with runtime/session coordinates, and a `stopped`
   launch row. The fresh-daemon run still printed
   the known ACP websocket reset/closed teardown warning tracked separately
   under `mono-oet.29.3.24`.

33. Managed-agent cutover removes direct spec builders from normal target examples.

   Examples 01-06 and 08/11/12/13/14/16/17/18 now use
   `new Fireline({ endpoint })`, `new Agent(...)`, `fireline.run(...)`,
   `fireline.session(...)`, `session.chat(...)`, and `session.stop(...)`.
   These target paths no longer import `@fireline/client/spec`,
   `@fireline/client/events`, `@fireline/state`, or
   `@fireline/client/acp-browser` directly.

   Fresh-daemon E2E passed for `examples/01-inline-js-local`: all five matrix
   cases returned `session_ready`, wrote local output under
   `/tmp/fireline-mono-oet-29-3-32-2-output/01-fresh`, and stopped with
   `status: "stopped"`. Prior-daemon reuse passed against an already-running
   daemon on `4740`/`7740`: all five matrix cases returned `session_ready` and
   stopped.

   Fresh-daemon and prior-daemon reuse E2E also passed for
   `examples/06-flamecast-v3-shaped`: both runs returned
   `launchStatus: "session_ready"`, `session.followUpSent: true`, and
   `stopStatus: "stopped"`. Successful runs still print the known ACP
   websocket reset/closed teardown warnings tracked under
   `mono-oet.29.3.24`; interrupting the long-lived prior-daemon process also
   prints expected stream-read shutdown noise.

   Examples 08, 11, 12, 13, 14, 16, 17, and 18 are also current Tier 1
   managed-agent examples after the v396 cutover.

   Fresh-daemon and prior-daemon reuse E2E passed for Worker, Edge,
   Server/Worker wrapper, Vercel Node Function, Bun, Deno, ACP registry chat,
   and middleware stack. Several TS/Edge runner processes printed the expected
   stopped JSON and then stayed alive; the evidence commands used bounded
   watchers and killed scratch process trees after `stopStatus: "stopped"`.

## Idiomaticity Audit

- Missing Fireline/public support: published package refs or documented git
  artifact refs are still needed for normal external consumers. This branch now
  uses documented git artifact refs; public npm remains gated.
- Missing Fireline/public support: local stream-native bootstrap still needs a
  replacement runtime-dev env handoff or equivalent control-stream alignment
  after `mono-ug3b`. Historical example 02 evidence owned that handoff, but
  stale processes or mismatched stream stores can still leave reviewers with a
  timeout or `Stream not found`; the example surfaces recovery instructions
  instead of leaving the raw failure alone.
- Missing Fireline/public support: managed-agent now wraps request
  construction, stop append, observation, and ACP attachment for normal
  examples. Remaining work is PM browser QA against the fresh package
  artifacts.
- Already fixed Fireline gap: managed-agent request and agent builders landed
  in `mono-oet.29.3.32.4`, so normal app examples can avoid direct Tier 3
  spec-builder imports for lifecycle flow.
- Needs repro: older live `collections.launches` observation evidence showed
  durable-state/TanStack DB warnings, but this should be retested against the
  current published managed-agent artifacts before it is treated as an open
  Fireline/state gap.
- Already fixed Fireline gap: launching an editable inline agent and attaching
  a chat session is now narrower through managed-agent lifecycle helpers.
  `mono-4rv` restores that example 02 cutover on main.
- Missing Fireline/public support: Flamecast-v3-shaped consumers need a stable
  generated-harness adapter story. The current example proves the substrate
  path without freezing package names or helper names.
- Already fixed Fireline gap: direct local launch-control CORS was enabled by
  PR #220, but target examples now bypass `/v1/launches` entirely.
- Already fixed Fireline gap: `SandboxSpec.env` propagation for local jsModule
  launches is closed by `mono-oet.29.5` / PR #214.
- Already fixed Fireline gap: browser ACP attachment now uses
  `@fireline/client/acp-browser` from PR #231.
- Already fixed Fireline gap: `appendLaunchStop` and stream-native stopped row
  projection are available after PR #242.
- Already fixed Fireline gap: launch collection rows use exact bare launch ids
  after PR #245.
- Example roughness: disabled remote brain/hands/middleware choices are
  intentionally visible but unsupported. They should become separate examples
  or beads before being enabled.
- Framework seam: Next examples need framework-local build/type checks because
  Next/Turbopack import resolution differs from the repo-level NodeNext
  typecheck.
- Framework seam: OpenNext/Cloudflare builds require app-local package scripts
  and generated adapter directories. The server/Worker wrapper example records
  the intended auth/idempotency pattern separately from those framework build
  seams.
- Evidence seam: runnable examples now use stable git artifact refs instead of
  manual artifact staging, but refs still need to be repinned deliberately when
  Fireline changes.
- Registry seam: `acpRegistry(...)` can resolve command/npx/uvx rows today, but
  binary-only and launcher-env rows remain explicit non-goals for examples
  until the Fireline signoff and implementation gates land.
- Middleware seam: `trace(...)`, `contextInjection(...)`, and `budget(...)` are
  usable in package-shaped examples today; `memory()`, approval gates, and
  subscriber middleware still need dedicated backing/evidence before they are
  taught as runnable examples.

## Follow-Up Bead Candidates

- Public runtime artifact availability for external consumers.
- Documented state-directory control for local durable-streams.
- Public replacement or wrapper for the inline JS module runner requirement.
- Endpoint/bootstrap discovery for local stream-native browser apps.
- Stop/session lifecycle convenience remains blocked until the lower-level
  materialized launch model is intentionally wrapped.
- Repro current `@fireline/state` live-update behavior for launch rows against
  the current published managed-agent artifacts before reopening
  `mono-oet.29.3.2`.
- Server/Worker stream append pattern for framework apps that need auth,
  idempotency, tenant policy, or secrets.
- PM browser QA for the managed-agent cutover examples after fresh/reuse E2E.
- Keep normal app examples on `@fireline/client/managed-agent`; use Tier 3
  spec/events/state imports only in raw/protocol or lower-level discovery
  examples.
