# Friction Log

This is a discovery log, not a product roadmap. Each item should either become
a Fireline bead or be closed as an intentional boundary.

## Findings

1. The repo had to be converted to TypeScript after the first checkpoint.

   External consumers are expected to author TypeScript, so examples, harnesses,
   and guard scripts now use `.ts` sources and `pnpm run typecheck`. Plain JS
   should only appear as generated output or inline agent bundle content.

2. Local package refs are package-shaped but not publish-shaped.

   The spike can install tarballs for `@fireline/client`, `@fireline/runtime`,
   and `@fireline/state`, but those tarballs have to be staged from the
   Fireline source repo. This is acceptable for discovery, but a normal
   external consumer needs immutable published package refs or documented git
   artifact refs.

   For the `mono-oet.29.16` smoke, the examples repo also pins the local
   `@fireline/runtime-darwin-arm64` platform tarball directly because pnpm did
   not materialize the local meta package's optional platform dependency
   reliably. The binaries had to be packed with `npm pack`; `pnpm pack`
   stripped executable bits from the local runtime platform tarball.

3. Runtime platform tarballs installed native binaries without executable bits.

   Historical blocker `mono-oet.29.4` is closed by Fireline PR #210. Checkpoint
   smokes no longer use `FIRELINE_BIN` or `FIRELINE_STREAMS_BIN` overrides.

4. Inline JS local runtime launch still resolves an internal js-module runner subpath.

   Application code uses only public package subpaths. `fireline-v3-dev` still
   resolves `@fireline/client/internal/js-module-runner` internally so the
   native runtime can start inline JS module agents. That is better for
   consumers, but the runtime/client internal dependency remains a surface risk
   to track before canonizing examples.

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

7. Local runtime/bootstrap discovery is still manual.

   The examples require the app-facing `FIRELINE_LAUNCH_CONTROL_STREAM_URL` and
   the local `fireline-v3-dev --state-stream <control-stream>` process to point
   at the same durable stream. This is intentionally explicit in the discovery
   repo, but a normal external consumer should not have to assemble that
   alignment by hand. Follow-up bead candidate: endpoint/bootstrap discovery
   for stream-native local apps.

8. Stream-native stop/cancel is not used by target examples.

   The old HTTP launch-control stop path was removed from examples 01-05.
   Current examples can close ACP and local `@fireline/state` observation
   handles, but they do not teach a public stream-native stop/cancel primitive.
   Follow-up `mono-oet.29.19` is assigned to BE1. Do not block this checkpoint
   on it; keep examples honest by closing only local handles.

9. `@fireline/state` launch observation has duplicate launch-id shapes.

   The control stream contains the expected `fireline.launch_request`,
   `fireline.runtime_instance`, and `fireline.launch_result` events. The
   materialized `collections.launches` output currently emits rows for both the
   bare launch id and `launch:<id>`, with session coordinates on the prefixed
   row. The shared helper accepts both forms and polls `db.preload()` while
   waiting, because the initial live subscription did not deliver the final
   launch result during the first smoke. This needs a Fireline/state follow-up
   before canonical examples teach exact launch id matching.

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

13. Framework apps keep Fireline launch code on the client side for now.

   The Next and OpenNext/Cloudflare-shaped examples place Fireline launch code
   behind `"use client"` pages. That keeps current package-shaped imports out
   of Next server components and Cloudflare Worker server bundles. Real apps
   may need a Worker/server pattern for auth, idempotency, tenant policy, and
   secret handling around stream append.

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

## Idiomaticity Audit

- Missing Fireline/public support: published package refs or documented git
  artifact refs are still needed for normal external consumers.
- Missing Fireline/public support: local stream-native bootstrap still requires
  manual alignment between the configured control stream URL and the dev daemon
  stream watcher.
- Missing Fireline/public support: target examples no longer use the old HTTP
  stop path, but no stream-native stop/cancel primitive is available in this
  checkpoint. Tracked by `mono-oet.29.19`.
- Missing Fireline/state cleanup: `collections.launches` should expose one
  canonical launch row per launch id, and live observation should deliver the
  result row without example-side polling.
- Missing Fireline/public support: launching an editable inline agent and
  attaching a chat session crosses many low-level surfaces. This should not
  become a local examples helper before `mono-oet.29.14` lands.
- Already fixed Fireline gap: direct local launch-control CORS was enabled by
  PR #220, but target examples now bypass `/v1/launches` entirely.
- Already fixed Fireline gap: `SandboxSpec.env` propagation for local jsModule
  launches is closed by `mono-oet.29.5` / PR #214.
- Already fixed Fireline gap: browser ACP attachment now uses
  `@fireline/client/acp-browser` from PR #231.
- Example roughness: disabled remote brain/hands/middleware choices are
  intentionally visible but unsupported. They should become separate examples
  or beads before being enabled.
- Framework seam: Next examples need framework-local build/type checks because
  Next/Turbopack import resolution differs from the repo-level NodeNext
  typecheck.
- Framework seam: OpenNext/Cloudflare builds require app-local package scripts
  and generated adapter directories, and the current safe path keeps Fireline
  launch calls in browser code.

## Follow-Up Bead Candidates

- Public runtime artifact availability for external consumers.
- Documented state-directory control for local durable-streams.
- Public replacement or wrapper for the inline JS module runner requirement.
- Endpoint/bootstrap discovery for local stream-native browser apps.
- Stream-native stop/cancel primitive before canonical app examples claim stop.
- Canonical `@fireline/state` launch row identity and live-update behavior.
- Server/Worker stream append pattern for framework apps that need auth,
  idempotency, tenant policy, or secrets.
- Idiomatic managed-agent launch/session helper after the lower-level
  materialized launch model and API freeze gates permit it.
