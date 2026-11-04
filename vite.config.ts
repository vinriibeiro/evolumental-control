/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const pdfjsDirectory = fileURLToPath(new URL('./node_modules/pdfjs-dist/', import.meta.url))
const pdfAssetDirectories = ['cmaps', 'standard_fonts', 'wasm'] as const
const practiceDirectory = fileURLToPath(new URL('./node_modules/pyodide/', import.meta.url))
const practiceFiles = new Set(['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'])

/** Recursos do leitor e do laboratório são copiados das dependências para o build. */
function runtimeAssets(): Plugin {
  return {
    name: 'runtime-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next()
        const path = (request.url ?? '').split('?')[0]
        const pdf = /^\/pdfjs\/(cmaps|standard_fonts|wasm)\/([A-Za-z0-9_.-]+)$/.exec(path)
        const practice = /^\/practice-runtime\/([A-Za-z0-9_.-]+)$/.exec(path)
        const filename = pdf && !['.', '..'].includes(pdf[2]) ? join(pdfjsDirectory, pdf[1], pdf[2])
          : practice && practiceFiles.has(practice[1]) ? join(practiceDirectory, practice[1]) : null
        if (!filename) return next()
        try {
          const source = readFileSync(filename)
          const mime: Record<string, string> = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.mjs': 'text/javascript', '.ttf': 'font/ttf', '.otf': 'font/otf', '.zip': 'application/zip', '.json': 'application/json' }
          response.setHeader('Content-Type', mime[extname(filename)] ?? 'application/octet-stream')
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
      for (const name of practiceFiles) {
        this.emitFile({ type: 'asset', fileName: `practice-runtime/${name}`, source: readFileSync(join(practiceDirectory, name)) })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), runtimeAssets()],
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
