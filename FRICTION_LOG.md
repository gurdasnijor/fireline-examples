# Friction Log

This is a discovery log, not a product roadmap. Each item should either become
a Fireline bead or be closed as an intentional boundary.

## Findings

1. The repo had to be converted to TypeScript after the first checkpoint.

   External consumers are expected to author TypeScript, so examples, harnesses,
   and guard scripts now use `.ts` sources and `pnpm run typecheck`. Plain JS
   should only appear as generated output or inline agent bundle content.

2. Local package refs are package-shaped but not publish-shaped.

   The spike can install tarballs for `@fireline/client` and `@fireline/runtime`,
   but those tarballs have to be staged from the Fireline source repo. This is
   acceptable for discovery, but a normal external consumer needs immutable
   published package refs or documented git artifact refs.

   Post-PR #210 package-shaped rerun used `npm pack` for the staged runtime
   artifacts so the tarball preserved executable bits. The artifact-generation
   recipe is still too implicit for a normal consumer.

3. Runtime platform tarballs installed native binaries without executable bits.

   Fresh `pnpm install` of the local `@fireline/runtime` tarball installed
   `@fireline/runtime-darwin-arm64/bin/fireline-streams` as `0644`.
   `fireline-v3-dev` then failed with `EACCES` while spawning
   `fireline-streams`. Follow-up bead: `mono-oet.29.4`, closed by Fireline
   PR #210.

   Historical checkpoint workaround: run with `FIRELINE_BIN` and
   `FIRELINE_STREAMS_BIN` pointing at scratch-built binaries under
   `/tmp/fireline-mono-oet.29.3-target/debug`. The package-shaped baseline
   after PR #210 does not use those variables.

4. Inline JS local runtime launch still resolves an internal js-module runner subpath.

   Application code uses only public package subpaths. After PR #210, the
   package-shaped smoke no longer sets `FIRELINE_JS_MODULE_RUNNER_IMPORT`, but
   `fireline-v3-dev` still resolves `@fireline/client/internal/js-module-runner`
   internally so the native runtime can start inline JS module agents. That is
   better for consumers, but the runtime/client internal dependency remains a
   surface risk to track before canonizing examples.

5. Scratch state directory control is not obvious from the runtime command.

   `fireline-streams --help` exposes host and port, but no state-directory flag.
   The team hygiene rule uses `FIRELINE_STATE_DIR`; this example records and
   exports it, but the current binary surface does not make the behavior
   discoverable.

6. The minimal managed-agent path is v3-shaped.

   A basic local inline agent still needs launch URL, durable streams URL,
   launch-control wait semantics, runtime state stream coordinates, and stop
   semantics. That is powerful, but it may be too much for the simplest public
   managed-agent example unless a higher-level helper is introduced later.

7. Naming remains transitional.

   The example uses `conductorSpec` because that is the validated name in
   `@fireline/client/spec`. The request target is still named
   `inlineConductorSpec`, and launch-control response fields still expose
   v3-oriented launch-state terminology.

8. `sandbox.env` did not reach the inline JS local agent process.

   The matrix sets `sandbox.env.FIRELINE_EXAMPLE_CASE`, but every launched
   inline JS module observed `process.env.FIRELINE_EXAMPLE_CASE` as
   `undefined`. This was a public-surface gap because `SandboxSpec.env` is
   accepted by `@fireline/client/spec`. Follow-up bead `mono-oet.29.5` is
   closed by Fireline PR #214.

9. The editable-agent web app needs explicit endpoint wiring.

   The browser UI cannot discover the launch or durable streams URLs from the
   local runtime package. The user must run `fireline-v3-dev`, copy the port
   choices into the page, and keep the runtime process alive while testing.
   This is acceptable for discovery but still too manual for a product-shaped
   app example.

   After Fireline #220, direct browser CORS preflight for
   `http://127.0.0.1:4464/v1/launches` succeeds, so the app no longer uses a
   Vite proxy. Endpoint discovery is still manual: the consumer has to know the
   launch port and durable-streams port from the `fireline-v3-dev` process.
   Follow-up bead: `mono-oet.29.10`.

10. Browser chat uses ACP directly because launch-control stops at coordinates.

   The app uses `@fireline/client/acp` and a local WebSocket stream adapter to
   send follow-up prompts after the launch returns `runtime.acp.url` and
   `startSession.acpSessionId`. This is package-shaped and public, but it is
   still low-level for an application author. Follow-up bead:
   `mono-oet.29.8`.

11. Unsupported placement and middleware choices are visible but disabled.

   The web app only enables inline JS local brain placement, local or stream
   filesystem placement, and trace/context/budget middleware. Remote brain,
   registry ACP agent, Docker/provider-backed hands, remote hands, approval,
   webhook, Telegram, memory, secrets, and external tool attachment are not
   faked in this checkpoint.

12. The launch/session composition is contract-level, not app-level.

   The editable web app has to call `inlineBundleArtifact`, wrap it with
   `jsModuleAgentForm`, create a `conductorSpec`, create a launch request,
   duplicate runtime/start-session labels, choose wait semantics, await the
   launch result, then attach ACP for interactive prompts. That is useful for
   validating contracts, but too verbose as the first thing a normal TS app
   author should write. This is a missing public API/support layer, not just
   example roughness. Follow-up bead: `mono-oet.29.9`.

13. Some roughness belongs to the discovery example.

   The UI keeps endpoint fields editable, stores no preferences, uses a basic
   textarea instead of a code editor, and renders session updates as raw text.
   Those are acceptable discovery-repo shortcuts and should not drive Fireline
   API shape unless repeated by real consumers.

## Idiomaticity Audit

- Public API gap: endpoint/bootstrap discovery remains manual. A browser app
  should not need hard-coded `4464` and `7501` ports or copied terminal output.
  See `mono-oet.29.10`.
- Public API gap: browser ACP chat requires a custom WebSocket `Stream`,
  `ClientSideConnection` initialization, permission defaults, prompt wrapper,
  update bridge, and close handling. See `mono-oet.29.8`.
- Public API gap: launching an editable inline agent and attaching a chat
  session crosses too many low-level surfaces for the basic app path. See
  `mono-oet.29.9`.
- Already fixed Fireline gap: direct local launch-control CORS is now enabled
  by PR #220, so the app no longer uses a Vite proxy.
- Already fixed Fireline gap: `SandboxSpec.env` propagation for local jsModule
  launches is closed by `mono-oet.29.5` / PR #214.
- Example roughness: disabled remote brain/hands/middleware choices are
  intentionally visible but unsupported. They should become separate examples
  or beads before being enabled.

## Follow-Up Bead Candidates

- Public runtime artifact availability for external consumers.
- Documented state-directory control for local durable-streams.
- Public replacement or wrapper for the inline JS module runner requirement.
- `mono-oet.29.7`: framework-shaped TypeScript examples for TanStack,
  straightforward Next.js, and OpenNext/Cloudflare-shaped Next.
- `mono-oet.29.10`: endpoint/bootstrap discovery for local browser apps.
- `mono-oet.29.8`: browser-safe ACP connection helper.
- `mono-oet.29.9`: idiomatic managed-agent launch/session helper after API
  freeze gates permit it.
