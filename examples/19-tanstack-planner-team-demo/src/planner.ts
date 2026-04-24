export type TeamRole = 'planner' | 'research' | 'implementation' | 'review' | 'operator' | 'documentation'

export type WorkItemStatus = 'draft' | 'ready' | 'launched' | 'gated'

export interface TeamMemberSpec {
  readonly id: string
  readonly role: TeamRole
  readonly title: string
  readonly mailbox: string
  readonly objective: string
  readonly skills: readonly string[]
  readonly launchPrompt: string
}

export interface MailboxSendIntent {
  readonly id: string
  readonly to: string
  readonly kind: string
  readonly payload: {
    readonly objective: string
    readonly role: string
    readonly instructions: string
  }
  readonly metadata: {
    readonly demo: 'tanstack-planner-team'
    readonly phase: 'phase-1'
    readonly source: string
  }
  readonly status: WorkItemStatus
}

export interface PlannerTeamSpec {
  readonly id: string
  readonly objective: string
  readonly planner: TeamMemberSpec
  readonly members: readonly TeamMemberSpec[]
  readonly mailboxIntents: readonly MailboxSendIntent[]
}

const ROLE_LIBRARY: readonly Omit<TeamMemberSpec, 'id' | 'mailbox' | 'objective' | 'launchPrompt'>[] = [
  {
    role: 'research',
    title: 'Research Lead',
    skills: ['scope mapping', 'source review', 'risk notes'],
  },
  {
    role: 'implementation',
    title: 'Implementation Lead',
    skills: ['task breakdown', 'runtime sequencing', 'handoff notes'],
  },
  {
    role: 'review',
    title: 'Review Lead',
    skills: ['acceptance checks', 'edge cases', 'release blockers'],
  },
  {
    role: 'operator',
    title: 'Operations Lead',
    skills: ['launch readiness', 'state tracking', 'incident notes'],
  },
  {
    role: 'documentation',
    title: 'Docs Lead',
    skills: ['user framing', 'decision records', 'handoff copy'],
  },
]

export function buildPlannerTeamSpec(prompt: string): PlannerTeamSpec {
  const objective = normalizeObjective(prompt)
  const id = `planner-team-${stableSlug(objective).slice(0, 42)}`
  const roles = selectRoles(objective)
  const planner = buildMember({
    role: 'planner',
    title: 'Planning Agent',
    skills: ['team design', 'handoff routing', 'completion criteria'],
  }, objective, id)
  const members = roles.map((role) => buildMember(role, objective, id))

  return {
    id,
    objective,
    planner,
    members,
    mailboxIntents: members.map((member) => ({
      id: `${id}:${member.id}:initial-task`,
      to: member.mailbox,
      kind: 'team.initial-task',
      payload: {
        objective,
        role: member.title,
        instructions: member.launchPrompt,
      },
      metadata: {
        demo: 'tanstack-planner-team',
        phase: 'phase-1',
        source: 'examples/19-tanstack-planner-team-demo',
      },
      status: 'ready',
    })),
  }
}

function buildMember(
  template: Omit<TeamMemberSpec, 'id' | 'mailbox' | 'objective' | 'launchPrompt'>,
  objective: string,
  teamId: string,
): TeamMemberSpec {
  const slug = stableSlug(`${teamId}-${template.role}`)
  return {
    ...template,
    id: slug,
    mailbox: `mailbox:${teamId}/${template.role}`,
    objective,
    launchPrompt: [
      `You are the ${template.title} for this Fireline demo team.`,
      `Objective: ${objective}`,
      `Return a concise phase-1 readiness note for ${template.skills.join(', ')}.`,
    ].join('\n'),
  }
}

function selectRoles(objective: string) {
  const lower = objective.toLowerCase()
  const selected = ROLE_LIBRARY.filter((role) => {
    if (role.role === 'operator') {
      return /\b(deploy|launch|ops|incident|production|runtime)\b/.test(lower)
    }
    if (role.role === 'documentation') {
      return /\b(doc|guide|copy|readme|publish|explain)\b/.test(lower)
    }
    return true
  })
  return selected.slice(0, 4)
}

function normalizeObjective(prompt: string) {
  const trimmed = prompt.replace(/\s+/g, ' ').trim()
  return trimmed.length > 0
    ? trimmed
    : 'Plan a Fireline demo team that can turn a user goal into routed work.'
}

function stableSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'planner-team'
}
