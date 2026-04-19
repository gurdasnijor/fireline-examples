import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/fireline': {
        target: 'http://127.0.0.1:4464',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fireline/, ''),
      },
      '/fireline-streams': {
        target: 'http://127.0.0.1:7501',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fireline-streams/, ''),
      },
    },
  },
  build: {
    outDir: '../../dist/02-editable-agent-web',
    emptyOutDir: true,
  },
})
