# Mailbox agent handoff demo harness

This example directory is the `mono-dsbh` integration seam for a UI where one
agent launches work for another agent through Fireline mailbox delivery.

The BE3-owned file is `src/state-harness.ts`. It intentionally has no UI and no
MCP tool shims. It exports:

- `createMailboxDemoHarness(...)` for mailbox send/receive and state
  observation wiring;
- `createMailboxDemoSnapshot(...)` for a TanStack-friendly app snapshot;
- selectors for roster counts, per-agent inbox rows, and mailbox-delivered demo
  output payloads.

The harness uses only landed package APIs:

- `fireline.mailbox(...)` and claimed handles from `@fireline/client`;
- `fireline.db({ schemas: { mailbox: mailboxRows } })`;
- `MailboxRow` data from `@fireline/state` through the client package.

Send intents map directly onto the `fireline_send_mailbox_message` contract:
`to` is `{ kind: 'mailbox', name }`, `kind` is `task`, domain event and
metadata live in `payload`, and `idempotencyKey` is the caller's `intentId`.

UI code should import this module rather than reimplement mailbox projection
logic. Phase 2 MCP integration can replace the producer/consumer actors while
leaving the state snapshot shape intact.

Current substrate boundary:

- no fake `mono-zofa` tools;
- no invented backend routes;
- no browser mailbox endpoint; browser UI keeps using `VITE_FIRELINE_ENDPOINT`;
- no observe-then-claim worker loop in UI code;
- no automatic session `chat(...)` or `run(...)` from mailbox receive/observe;
  mailbox rows feed explicit app or agent bridge logic only;
- mailbox output rows are demo payloads carried through real mailbox messages,
  not a separate product state writer.
