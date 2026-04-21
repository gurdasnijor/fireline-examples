import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { runInlineLaunch } from './run-inline-launch.js'
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
  component: TanStackDiscoveryPage,
})

const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

function TanStackDiscoveryPage() {
  const [endpoint, setEndpoint] = useState(
    import.meta.env.VITE_FIRELINE_ENDPOINT ?? ''
  )
  const [prompt, setPrompt] = useState('Hello from TanStack Router + Query.')
  const mutation = useMutation({
    mutationFn: () => runInlineLaunch({
      endpoint,
      prompt,
      example: '03-tanstack-shaped-app',
    }),
  })

  return (
    <main>
      <p className="eyebrow">Tier 1 managed-agent path</p>
      <h1>TanStack-shaped Fireline app</h1>
      <section className="controls">
        <label>
          Fireline endpoint
          <input
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="http://127.0.0.1:7474/v1/stream/fireline-examples-control"
          />
        </label>
        <label>
          Prompt
          <input value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Run</button>
      </section>
      <pre>{mutation.data ? JSON.stringify(mutation.data, null, 2) : mutation.error ? String(mutation.error) : 'No launch yet.'}</pre>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
