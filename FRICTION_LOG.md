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

6. The stream-native path is explicit but still contract-heavy.

   A basic local inline agent now needs a configured launch/control stream URL,
   a `CreateLaunchRequest`, an append of `fireline.launch_request`, and
   materialized launch observation through `@fireline/state`. That is the right
   lower-level primitive for this checkpoint, but it is still too much for the
   simplest future product example until higher-level helpers are unblocked by
   `mono-oet.29.14`.

7. Local runtime/bootstrap discovery is still uneven across examples.

   `examples/02-editable-agent-web` now makes the public
   `pnpm run dev:editable-agent-web` command start through `fireline-v3-dev` and
   inject the exported `FIRELINE_LAUNCH_CONTROL_STREAM_URL` into Vite. The
   private Vite child script still derives
   `http://127.0.0.1:7474/v1/stream/fireline-examples-control` when run on its
   own, probes the local streams health endpoint, and shows a copyable
   derivation for custom ports or stream names. On `Stream not found`/404, the
   UI names the missing stream and shows restart or exact-URL recovery
   instructions. Other examples still require the app-facing
   `FIRELINE_LAUNCH_CONTROL_STREAM_URL` and the local
   `fireline-v3-dev --state-stream <control-stream>` process to point at the
   same durable stream. This is intentionally explicit in the discovery repo,
   but a normal external consumer should not have to assemble that alignment by
   hand. Follow-up bead candidate: endpoint/bootstrap discovery for
   stream-native local apps.

   `mono-oet.29.3.20` prior-daemon evidence originally found a substrate
   blocker: `fireline-v3-dev` could reuse an existing daemon, export
   `FIRELINE_LAUNCH_CONTROL_STREAM_URL` for `fireline-v3-dev-daemon`, and then
   fail append with `HTTP Error 404 ... Stream not found:
   fireline-v3-dev-daemon`. Fireline PR #291 / `mono-oet.29.3.22` fixed that
   launcher/stream mismatch by creating and verifying the exported stream before
   child startup. The examples branch keeps diagnostics and recovery guidance
   for genuinely stale port/process/store reuse.

8. Stream-native stop is now usable, but still low-level.

   Fireline PR #242 landed `appendLaunchStop` and daemon stop projection. The
   examples now append `fireline.launch_stop` and observe `stopped` launch rows
   instead of closing only local handles or teaching the old HTTP stop path.
   This validates the primitive, but a normal app still has to assemble the
   stop envelope, observation loop, ACP cleanup, and UI state by hand.

9. `@fireline/state` launch row identity is fixed, but live observation is not.

   Fireline PR #245 fixed the duplicate bare/prefixed launch row shape. The
   examples now match exact bare `launchId` values, and the `mono-oet.29.3.1`
   smoke observed one target row per validated launch.

   Remaining substrate gap: live `@fireline/state` subscriptions still throw
   from `@durable-streams/state`/TanStack DB while processing
   `fireline.runtime_instance` rows:
   `Cannot read properties of undefined (reading 'Symbol(liveQueryInternal)')`.
   A long-lived DB created before runtime rows can miss the later materialized
   launch result. The shared helper therefore waits by taking fresh
   `createFirelineDB(...).preload()` snapshots and reading
   `collections.launches`. This is explicitly non-canonical discovery glue and
   is tracked as Fireline follow-up `mono-oet.29.3.2`.

10. Browser ACP attachment is improved but still low-level.

   `examples/02-editable-agent-web` now consumes
   `@fireline/client/acp-browser` from Fireline PR #231 instead of a local
   WebSocket-to-ACP adapter. The app still has to wait for
   `LaunchRow.runtime.acp.url` and `LaunchRow.startSession.acpSessionId`, then
   call `connection.prompt(...)` directly. This is acceptable for a low-level
   discovery example.

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

   `examples/11-server-worker-wrapper` now demonstrates the consumer-authored
   pattern without changing Fireline: the server/Worker boundary validates a
   bearer token, checks tenant/scope policy, creates the stable idempotency
   key, appends launch/stop events, observes `collections.launches`, and
   returns a minimal app-facing summary. It does not solve framework-specific
   bundling constraints for every runtime, and it is not a public helper API.

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

16. Flamecast-shaped consumers still assemble too many low-level pieces.

   `examples/06-flamecast-v3-shaped` keeps a realistic framework boundary,
   generated multi-file harness bundle, Fireline adapter, stream append,
   launch-row observation, ACP follow-up, and stream-native stop. The shape is
   useful as characterization evidence, but it still requires product code to
   know about `agentDefinition`, `jsModuleAgentForm`, `inlineBundleArtifact`,
   `launchSpec`, `newSessionRequest`, `appendLaunchRequest`, `collections.launches`,
   `connectBrowserAcp`, and `appendLaunchStop`.

   This should not become canonical public sample code before the managed-agent
   API freeze gates land. Follow-up bead candidate: a v3 product-consumer helper
   or documented adapter recipe after `mono-oet.21.1.5` and related public
   surface decisions are closed.

17. ACP follow-up attachment is coordinate-heavy.

   The Flamecast-shaped example must read `LaunchRow.runtime.acp.url` and
   `LaunchRow.startSession.acpSessionId`, then call
   `connectBrowserAcp(...).connection.prompt(...)`. That is a precise substrate
   boundary, but a real product integration likely wants a typed session handle
   or resume helper once public surface freeze permits it.

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
   `followUpSent: true` and `stopStatus: "stopped"`, but logs still showed the
   known `Symbol(liveQueryInternal)` durable-state/TanStack DB error while
   processing `fireline.runtime_instance` rows. The runtime also logged ACP
   websocket reset/closed warnings during teardown. These did not fail the
   example, but they remain non-happy-path reviewer noise.

21. Server/Worker wrapper is a pattern, not a hidden Fireline abstraction.

   `examples/11-server-worker-wrapper` validates the desired placement for
   auth, tenant policy, idempotency, launch append, launch observation, and
   stop append. It still uses low-level Fireline primitives inside the wrapper:
   `agentDefinition`, `launchSpec`, `newSessionRequest`, `appendLaunchRequest`,
   `collections.launches`, and `appendLaunchStop`.

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

23. Direct Cloudflare Worker usage is package-shaped but still low-level.

   `examples/08-cloudflare-worker-direct` proves the direct Worker shape can be
   expressed with `@fireline/client/spec`, `@fireline/client/events`, and
   `@fireline/state` without Next.js, OpenNext, launch-control HTTP, or
   Fireline source internals. It still exposes the raw launch spec, append,
   polling observation, and stop append sequence. This is useful discovery
   evidence, not a canonical Worker SDK shape.

   `mono-oet.29.3.21.3` retro smoke passed both quality-bar scenarios:
   fresh scratch daemon on `5544`/`8581` with Wrangler on `8787`, and
   prior-daemon reuse with the same daemon still bound and Wrangler restarted on
   `8788`. Both `POST /demo` calls returned launch rows with ACP session
   coordinates and stopped rows. Non-happy-path note: Wrangler local dev used
   `wrangler.toml` `[vars]` over shell environment variables, so scratch ports
   needed explicit `--var FIRELINE_STREAMS_PORT:...` and
   `--var FIRELINE_LAUNCH_CONTROL_STREAM_URL:...` flags.

24. Editable-agent-web naive dev previously did not own daemon startup.

   `mono-oet.29.3.25` reproduced the zero-opaque-config gap: a user could run
   `pnpm run dev:editable-agent-web` with no pre-started daemon and no Vite
   launch/control URL, leaving the browser to depend on fallback derivation
   rather than the daemon's exported URL. The dev command now wraps Vite with
   `fireline-v3-dev`; fresh and prior-daemon runs injected
   `http://127.0.0.1:<streams-port>/v1/stream/fireline-v3-dev-daemon` into the
   Vite environment and launch/stop completed. Both evidence runs still logged
   the known `Symbol(liveQueryInternal)` durable-state/TanStack DB warning while
   processing `fireline.runtime_instance`; TL1 tracks that under
   `mono-oet.29.3.24`.

25. Vercel Functions Node can use the root client surface, but still composes low-level pieces.

   `examples/12-vercel-function-node` validates the Node serverless case that
   is allowed to import the full root `@fireline/client` package. The handler
   uses `fireline.appendLaunchRequest(...)` and `fireline.db(...)`, while still
   building launch data through `@fireline/client/spec` and appending stop
   through `@fireline/client/events`.

   This is useful for Vercel Functions and other Node serverless handlers, but
   it does not remove the need to derive the launch/control stream URL, choose
   a stable `clientRequestId`, observe `collections.launches`, and append stop.
   It is still a discovery example, not a stable high-level SDK.

   Fresh-daemon and prior-daemon reuse E2E both passed. The same teardown noise
   seen in other inline JS module examples remains visible: ACP websocket
   reset/closed warnings can appear after the example has already returned
   `ok: true`, `session_ready`, and `stopped`.

26. Vercel Edge Runtime can use Worker-safe package subpaths, but still needs bundling and low-level stream composition.

   `examples/13-vercel-edge-runtime` validates an Edge handler that avoids Node
   built-ins and root `@fireline/client`, then runs locally in
   `@edge-runtime/vm`. The handler uses documented package subpaths:
   `@fireline/client/spec`, `@fireline/client/events`, and `@fireline/state`.

   This is useful for Vercel Edge-style handlers and other Web Runtime
   consumers, but it still requires the app to derive the launch/control stream
   URL, bundle the handler for the Edge runtime, choose a stable
   `clientRequestId`, observe `collections.launches`, and append stop. It is
   still discovery evidence, not a stable high-level SDK.

   Fresh-daemon and prior-daemon reuse E2E both passed. Successful runs can
   still print the same ACP websocket reset/closed teardown warnings seen in
   other inline JS module examples; TL1 tracks that separately under
   `mono-oet.29.3.24`.

27. Bun can resolve and run the package-shaped root client surface, but the launch flow remains low-level.

   `examples/14-bun` validates a Bun process that imports root
   `@fireline/client`, builds launch data with `@fireline/client/spec`,
   appends stop through `@fireline/client/events`, and observes launch rows
   through `fireline.db(...)`.

   This proves the current git artifact package refs are usable from Bun
   without Fireline source imports, but it still requires the app to derive the
   launch/control stream URL, choose a stable `clientRequestId`, observe
   `collections.launches`, and append stop directly. It is still discovery
   evidence, not a stable high-level SDK.

   Fresh-daemon and prior-daemon reuse E2E both passed. Successful runs can
   still print the same ACP websocket reset/closed teardown warnings seen in
   other inline JS module examples; TL1 tracks that separately under
   `mono-oet.29.3.24`.

28. Go raw HTTP works without an SDK, but repeats the low-level envelope burden.

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

## Idiomaticity Audit

- Missing Fireline/public support: published package refs or documented git
  artifact refs are still needed for normal external consumers. This branch now
  uses documented git artifact refs; public npm remains gated.
- Missing Fireline/public support: local stream-native bootstrap still relies on
  `fireline-v3-dev` env handoff or equivalent control-stream alignment. Example
  02 owns that handoff for its public dev command now, but stale processes or
  mismatched stream stores can still leave reviewers with a timeout or
  `Stream not found`; the example surfaces recovery instructions instead of
  leaving the raw failure alone.
- Missing Fireline/public support: stream-native stop now works through
  `appendLaunchStop`, but app authors still need to compose stop append,
  observation, and ACP cleanup directly.
- Missing Fireline/state cleanup: live `collections.launches` observation
  should deliver runtime/result/stop updates without fresh-DB preload snapshots.
  Tracked by `mono-oet.29.3.2`.
- Missing Fireline/public support: launching an editable inline agent and
  attaching a chat session crosses many low-level surfaces. This should not
  become a local examples helper before `mono-oet.29.14` lands.
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

## Follow-Up Bead Candidates

- Public runtime artifact availability for external consumers.
- Documented state-directory control for local durable-streams.
- Public replacement or wrapper for the inline JS module runner requirement.
- Endpoint/bootstrap discovery for local stream-native browser apps.
- Stop/session lifecycle convenience remains blocked until the lower-level
  materialized launch model is intentionally wrapped.
- Canonical `@fireline/state` live-update behavior for launch rows
  (`mono-oet.29.3.2`).
- Server/Worker stream append pattern for framework apps that need auth,
  idempotency, tenant policy, or secrets.
- Idiomatic managed-agent launch/session helper after the lower-level
  materialized launch model and API freeze gates permit it.
