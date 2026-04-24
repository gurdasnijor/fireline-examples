import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { launchPlannerTeam, type LaunchTeamResult } from './fireline.js'
import { buildPlannerTeamSpec, type PlannerTeamSpec } from './planner.js'
import './styles.css'

const queryClient = new QueryClient()

const rootRoute = createRootRoute({
  component: () => (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlannerTeamDemo,
})

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function PlannerTeamDemo() {
  const [endpoint, setEndpoint] = useState(import.meta.env.VITE_FIRELINE_ENDPOINT ?? '')
  const [prompt, setPrompt] = useState('Plan a launch-ready team for a mailbox-backed customer triage workflow.')
  const [spec, setSpec] = useState<PlannerTeamSpec>(() => buildPlannerTeamSpec(prompt))
  const [result, setResult] = useState<LaunchTeamResult | undefined>()
  const canLaunch = endpoint.trim().length > 0
  const mutation = useMutation({
    mutationFn: async () => {
      const nextSpec = buildPlannerTeamSpec(prompt)
      setSpec(nextSpec)
      const launch = await launchPlannerTeam({
        endpoint,
        spec: nextSpec,
      })
      setResult(launch)
      return launch
    },
  })
  const launchState = useMemo(() => {
    if (mutation.isPending) return 'launching'
    if (mutation.error) return 'blocked'
    if (result) return 'sessions ready'
    return 'planned'
  }, [mutation.error, mutation.isPending, result])

  function refreshPlan() {
    setSpec(buildPlannerTeamSpec(prompt))
    setResult(undefined)
  }

  return (
    <main className="app-shell">
      <section className="workbench">
        <header className="topbar">
          <div>
            <p className="eyebrow">Fireline examples / TanStack</p>
            <h1>Planner team demo</h1>
          </div>
          <div className={`run-state ${launchState.replace(' ', '-')}`}>{launchState}</div>
        </header>

        <div className="layout">
          <section className="prompt-panel" aria-label="planner prompt">
            <label>
              Fireline endpoint
              <input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="runtime dev endpoint"
              />
            </label>
            <label>
              Planning objective
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={9}
              />
            </label>
            <div className="button-row">
              <button type="button" onClick={refreshPlan}>Plan team</button>
              <button
                type="button"
                className="primary"
                disabled={!canLaunch || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                Launch sessions
              </button>
            </div>
            {mutation.error ? <p className="error">{String(mutation.error)}</p> : null}
          </section>

          <section className="stage" aria-label="team dashboard">
            <div className="panel roster">
              <div className="panel-head">
                <h2>Roster</h2>
                <span>{spec.members.length + 1} agents</span>
              </div>
              <Roster spec={spec} result={result} />
            </div>

            <div className="panel inboxes">
              <div className="panel-head">
                <h2>Mailbox outbox</h2>
                <span>{spec.mailboxIntents.length} sends</span>
              </div>
              <MailboxOutbox spec={spec} result={result} />
            </div>

            <div className="panel outputs">
              <div className="panel-head">
                <h2>Outputs</h2>
                <span>{result ? 'live' : 'waiting'}</span>
              </div>
              <Outputs result={result} />
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

function Roster(props: { readonly spec: PlannerTeamSpec; readonly result: LaunchTeamResult | undefined }) {
  const launched = new Map([
    ...(props.result ? [[props.result.planner.agentId, props.result.planner] as const] : []),
    ...(props.result?.members.map((member) => [member.agentId, member] as const) ?? []),
  ])
  const members = [props.spec.planner, ...props.spec.members]
  return (
    <div className="table">
      {members.map((member) => {
        const live = launched.get(member.id)
        return (
          <article className="row" key={member.id}>
            <div>
              <strong>{member.title}</strong>
              <span>{member.skills.join(' / ')}</span>
            </div>
            <code>{member.mailbox}</code>
            <span className={live ? 'pill ready' : 'pill'}>{live ? 'session ready' : 'planned'}</span>
          </article>
        )
      })}
    </div>
  )
}

function MailboxOutbox(props: { readonly spec: PlannerTeamSpec; readonly result: LaunchTeamResult | undefined }) {
  const sent = new Set(props.result?.mailboxSends.map((send) => send.intent.id) ?? [])
  return (
    <div className="mail-list">
      {props.spec.mailboxIntents.map((intent) => (
        <article className="mail-item" key={intent.id}>
          <div>
            <strong>{intent.payload.role}</strong>
            <span>{intent.kind}</span>
          </div>
          <code>{intent.to}</code>
          <p>{intent.payload.instructions}</p>
          <span className={sent.has(intent.id) ? 'pill gated' : 'pill ready'}>
            {sent.has(intent.id) ? 'send gated' : 'ready'}
          </span>
        </article>
      ))}
    </div>
  )
}

function Outputs(props: { readonly result: LaunchTeamResult | undefined }) {
  if (!props.result) {
    return <div className="empty-state">No sessions launched.</div>
  }
  return (
    <div className="output-stack">
      {[props.result.planner, ...props.result.members].map((session) => (
        <article className="output" key={session.agentId}>
          <div>
            <strong>{session.title}</strong>
            <span>{session.sessionId ?? 'session pending'}</span>
          </div>
          <pre>{formatResponse(session.response)}</pre>
        </article>
      ))}
    </div>
  )
}

function formatResponse(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
