// Gera os ícones PNG do aplicativo (PWA) a partir do símbolo vetorial.
// Uso: node scripts/gerar-icones.mjs  (requer Edge ou Chrome instalado)
import { chromium } from 'playwright-core'
import { existsSync, mkdirSync } from 'node:fs'

const OUT = 'public/icons'
mkdirSync(OUT, { recursive: true })

const STROKES = `
  <circle cx="30" cy="26" r="13"/>
  <path d="M30 18v8"/>
  <path d="M30 26 L49 9"/>
  <path d="M41.5 8.5 H49.5 V16.5"/>
  <path d="M8 45c7.5-3.6 16-3.6 24 1.6v11c-8-5.2-16.5-5.2-24-1.6z"/>
  <path d="M56 45c-7.5-3.6-16-3.6-24 1.6v11c8-5.2 16.5-5.2 24-1.6z"/>`

// "any": cantos arredondados, símbolo grande. "maskable": fundo cheio e
// símbolo dentro da zona segura (80% central), pois o sistema recorta o ícone.
const svg = (kind) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  <rect width="64" height="64" rx="${kind === 'any' ? 14 : 0}" fill="#3B2B20"/>
  <g transform="translate(${kind === 'any' ? '6.4 6.4) scale(0.8' : '12.8 12.8) scale(0.6'})" fill="none" stroke="#F5DEB3" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">${STROKES}</g>
</svg>`

const targets = [
  ['icon-192.png', 192, 'any'],
  ['icon-512.png', 512, 'any'],
  ['icon-maskable-192.png', 192, 'maskable'],
  ['icon-maskable-512.png', 512, 'maskable'],
  ['apple-touch-icon.png', 180, 'maskable'],
]

const exe = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find(existsSync)
const browser = await chromium.launch({ executablePath: exe, headless: true })
for (const [file, size, kind] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(kind)}</body></html>`)
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground: kind === 'any', clip: { x: 0, y: 0, width: size, height: size } })
  await page.close()
  console.log(`${OUT}/${file}`)
}
await browser.close()
