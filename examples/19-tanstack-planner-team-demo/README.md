# TanStack Planner Team Demo

Phase 1 is a polished TanStack web scaffold for the planner-team demo. The
browser builds a local planner preview from the user objective, then the app
launches managed-agent sessions for the previewed planner and team members.

This phase does not claim that the planner agent has produced the team spec.
The future adapter point is `buildPlannerTeamSpec(...)`: once planner-agent
team-spec output is available, the UI can replace the local preview source with
the planner-produced spec before launching sessions.

## Run

```sh
pnpm run dev:tanstack-planner-team-demo
```

The script starts `fireline runtime dev` and passes the runtime endpoint through
to Vite as `VITE_FIRELINE_ENDPOINT`.

For static scaffold checks only:

```sh
pnpm run build:tanstack-planner-team-demo
```

## Current Behavior

- accepts a user planning objective;
- derives a local `PlannerTeamSpec` preview in the browser;
- shows the preview roster, mailbox send intents, and session outputs;
- launches the previewed planner/member sessions through
  `@fireline/client/managed-agent`;
- prepares mailbox send intent data without importing unavailable mailbox
  package exports or local Fireline source.

Expected output after launching is a session result for the planner plus each
previewed team member. The mailbox panel remains a prepared/gated send-intent
view in Phase 1.

## Gates

- Phase 2: wire real mailbox send/observation only after mono-8v54 makes the
  installable `@fireline/client`/`@fireline/state` artifacts available.
- Phase 3: add MCP mailbox read/reply flows only after mono-zofa lands. Until
  then, this demo must not fake mailbox reads, replies, or inbox consumption.
