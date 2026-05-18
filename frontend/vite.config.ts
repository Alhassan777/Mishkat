import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'
import path from 'path'

function ayahGraphPlugin() {
  let isBuild = false

  const loadGraph = () => {
    const rootGraphPath = path.resolve(__dirname, '../output/ayah_graph.json')
    const fallbackGraphPath = path.resolve(__dirname, './public/data/ayah_graph.json')
    const candidatePaths = [rootGraphPath, fallbackGraphPath]

    for (const graphPath of candidatePaths) {
      try {
        const raw = readFileSync(graphPath, { encoding: 'utf8' }).replace(/^﻿/, '')
        const graph = JSON.parse(raw)
        return { graph, path: graphPath }
      } catch {
        // try next candidate
      }
    }

    throw new Error(
      `Unable to load ayah graph. Tried:\n- ${rootGraphPath}\n- ${fallbackGraphPath}\nGenerate it first with: python build_ayah_graph.py`
    )
  }

  return {
    name: 'ayah-graph-loader',
    configResolved(config: { command: string }) {
      isBuild = config.command === 'build'
    },
    buildStart() {
      const { graph, path: loadedPath } = loadGraph()
      if (isBuild) {
        this.emitFile({
          type: 'asset',
          fileName: 'data/ayah_graph.json',
          source: JSON.stringify(graph),
        })
      }

      console.log(`[ayah-graph-plugin] Loaded graph from: ${loadedPath}`)
    },
    configureServer(server: { middlewares: { use: (path: string, fn: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (data: string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use('/data/ayah_graph.json', (_req, res, _next) => {
        const { graph } = loadGraph()
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(graph))
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ayahGraphPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
