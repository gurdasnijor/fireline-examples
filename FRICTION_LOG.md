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
   `undefined`. This is a public-surface gap because `SandboxSpec.env` is
   accepted by `@fireline/client/spec`. Follow-up bead: `mono-oet.29.5`.

## Follow-Up Bead Candidates

- Public runtime artifact availability for external consumers.
- Documented state-directory control for local durable-streams.
- Public replacement or wrapper for the inline JS module runner requirement.
- A simpler managed-agent launch helper after the API freeze gate permits it.
