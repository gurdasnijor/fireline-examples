import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const exampleRoot = fileURLToPath(new URL('.', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../', import.meta.url))

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: `${repoRoot}/dist/13-vercel-edge-runtime`,
    emptyOutDir: true,
    lib: {
      entry: `${exampleRoot}/src/edge.ts`,
      name: 'FirelineVercelEdgeRuntimeExample',
      formats: ['iife'],
      fileName: () => 'edge.js',
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
