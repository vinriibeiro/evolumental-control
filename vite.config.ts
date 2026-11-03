/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const pdfjsDirectory = fileURLToPath(new URL('./node_modules/pdfjs-dist/', import.meta.url))
const pdfAssetDirectories = ['cmaps', 'standard_fonts', 'wasm'] as const

/** Recursos auxiliares do leitor; ficam nas dependências e no build, sem binários no Git. */
function pdfAssets(): Plugin {
  return {
    name: 'pdfjs-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next()
        const match = /^\/pdfjs\/(cmaps|standard_fonts|wasm)\/([A-Za-z0-9_.-]+)$/.exec((request.url ?? '').split('?')[0])
        if (!match) return next()
        const [, directory, name] = match
        if (name === '.' || name === '..') {
          response.statusCode = 404
          return response.end('Recurso não encontrado')
        }
        try {
          const source = readFileSync(join(pdfjsDirectory, directory, name))
          const mime: Record<string, string> = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.ttf': 'font/ttf', '.otf': 'font/otf' }
          response.setHeader('Content-Type', mime[extname(name)] ?? 'application/octet-stream')
          response.setHeader('Content-Length', source.length)
          response.end(request.method === 'HEAD' ? undefined : source)
        } catch {
          response.statusCode = 404
          response.end('Recurso não encontrado')
        }
      })
    },
    generateBundle() {
      for (const directory of pdfAssetDirectories) {
        for (const file of readdirSync(join(pdfjsDirectory, directory), { withFileTypes: true })) {
          if (!file.isFile() || !/^[A-Za-z0-9_.-]+$/.test(file.name)) continue
          this.emitFile({ type: 'asset', fileName: `pdfjs/${directory}/${file.name}`, source: readFileSync(join(pdfjsDirectory, directory, file.name)) })
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pdfAssets()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('epubjs') || id.includes('jszip')) return 'leitor-epub'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    // DOM e PostgreSQL embutido consomem muita memória quando uma janela é aberta por núcleo.
    maxWorkers: 2,
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    testTimeout: 30000,
  },
})
