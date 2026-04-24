import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5179,
  },
  build: {
    outDir: '../../dist/19-tanstack-planner-team-demo',
    emptyOutDir: true,
  },
})
