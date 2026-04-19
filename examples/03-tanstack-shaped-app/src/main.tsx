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
  const [launchUrl, setLaunchUrl] = useState('http://127.0.0.1:4464/v1/launches')
  const [durableStreamsUrl, setDurableStreamsUrl] = useState('http://127.0.0.1:7501/v1/stream')
  const [prompt, setPrompt] = useState('Hello from TanStack Router + Query.')
  const mutation = useMutation({
    mutationFn: () => runInlineLaunch({
      launchUrl,
      durableStreamsUrl,
      prompt,
      example: '03-tanstack-shaped-app',
    }),
  })

  return (
    <main>
      <p className="eyebrow">Discovery, not canonical</p>
      <h1>TanStack-shaped Fireline app</h1>
      <section className="controls">
        <label>
          Launch endpoint
          <input value={launchUrl} onChange={(event) => setLaunchUrl(event.target.value)} />
        </label>
        <label>
          Durable streams endpoint
          <input value={durableStreamsUrl} onChange={(event) => setDurableStreamsUrl(event.target.value)} />
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
