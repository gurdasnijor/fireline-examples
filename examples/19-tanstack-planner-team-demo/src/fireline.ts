import {
  Agent,
  Fireline,
  acp,
} from '@fireline/client/managed-agent'
import type { MailboxSendIntent, PlannerTeamSpec, TeamMemberSpec } from './planner.js'

export interface LaunchTeamOptions {
  readonly endpoint: string
  readonly spec: PlannerTeamSpec
}

export interface LaunchedSession {
  readonly agentId: string
  readonly title: string
  readonly role: string
  readonly mailbox: string
  readonly launchId: string | undefined
  readonly sessionId: string | undefined
  readonly response: unknown
}

export interface MailboxSendAffordance {
  readonly intent: MailboxSendIntent
  readonly state: 'ready' | 'gated'
  readonly reason?: string
}

export interface LaunchTeamResult {
  readonly teamId: string
  readonly planner: LaunchedSession
  readonly members: readonly LaunchedSession[]
  readonly mailboxSends: readonly MailboxSendAffordance[]
}

export async function launchPreviewTeamSessions(options: LaunchTeamOptions): Promise<LaunchTeamResult> {
  const clientRequestId = `${options.spec.id}-${Date.now()}`
  const fireline = new Fireline({
    endpoint: options.endpoint,
    requestedBy: 'examples/19-tanstack-planner-team-demo',
  })

  try {
    const planner = await runTeamAgent({
      fireline,
      member: options.spec.planner,
      prompt: [
        'Review this phase-1 local planner preview.',
        `Objective: ${options.spec.objective}`,
        `Spec source: ${options.spec.source}`,
        `Team: ${options.spec.members.map((member) => `${member.title} -> ${member.mailbox}`).join('; ')}`,
      ].join('\n'),
      clientRequestId,
      source: 'planner',
    })
    const members = []
    for (const member of options.spec.members) {
      members.push(await runTeamAgent({
        fireline,
        member,
        prompt: member.launchPrompt,
        clientRequestId,
        source: member.role,
      }))
    }

    return {
      teamId: options.spec.id,
      planner,
      members,
      mailboxSends: options.spec.mailboxIntents.map((intent) => ({
        intent,
        state: 'gated',
        reason: 'Phase 1 prepares send intents only; real mailbox send/observe wiring waits on mono-8v54 installable artifacts and mono-zofa.',
      })),
    }
  } finally {
    fireline.close()
  }
}

async function runTeamAgent(options: {
  readonly fireline: Fireline
  readonly member: TeamMemberSpec
  readonly prompt: string
  readonly clientRequestId: string
  readonly source: string
}): Promise<LaunchedSession> {
  const agent = new Agent({
    id: options.member.id,
    entrypoint: await acp.inlineJsBundle({
      entrypoint: 'agent.mjs',
      files: [{
        path: 'agent.mjs',
        mediaType: 'text/javascript',
        content: `export default async function handle(ctx) {
  const text = ctx.prompt.find((block) => block.type === "text")?.text ?? ""
  await ctx.session.text(${JSON.stringify(`${options.member.title} session initialized from the app preview. Mailbox: ${options.member.mailbox}. `)} + text.slice(0, 320))
  await ctx.session.complete()
}
`,
      }],
      provenance: {
        producer: 'fireline-examples-discovery',
        source: 'examples/19-tanstack-planner-team-demo',
        revision: `${options.clientRequestId}-${options.source}`,
      },
    }),
    sandbox: {
      provider: 'local',
      fsBackend: 'local',
      labels: {
        example: '19-tanstack-planner-team-demo',
        mode: 'demo-phase-1',
        role: options.member.role,
      },
    },
  })
  const result = await options.fireline.run(agent, {
    prompt: options.prompt,
    cwd: '/',
    idempotencyKey: `${options.clientRequestId}-${options.source}`,
    requestedBy: 'examples/19-tanstack-planner-team-demo',
  })

  return {
    agentId: options.member.id,
    title: options.member.title,
    role: options.member.role,
    mailbox: options.member.mailbox,
    launchId: result.launchId,
    sessionId: result.sessionId,
    response: result.response,
  }
}
