import Papa from 'papaparse'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadText(text: string, filename: string, mime: string) {
  // BOM para o Excel reconhecer acentos em CSV.
  const prefix = mime.startsWith('text/csv') ? String.fromCharCode(0xfeff) : ''
  downloadBlob(new Blob([prefix + text], { type: `${mime};charset=utf-8` }), filename)
}

export function downloadCsv(rows: Array<Record<string, unknown>>, filename: string) {
  downloadText(Papa.unparse(rows, { delimiter: ';' }), filename, 'text/csv')
}

export function downloadJson(data: unknown, filename: string) {
  downloadText(JSON.stringify(data, null, 2), filename, 'application/json')
}

export function slugDate() {
  return new Date().toISOString().slice(0, 10)
}
