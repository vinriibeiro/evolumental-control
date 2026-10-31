// Vídeos já assistidos ("Concluir" na tela de Vídeos). Fica neste aparelho (localStorage), como o progresso do banco de questões.

const KEY = 'evolumental.video.done'
const PANEL_KEY = 'evolumental.video.panel'

export function loadWatched(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveWatched(ids: ReadonlySet<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]))
  } catch {
    // armazenamento bloqueado: vale só nesta sessão
  }
}

/** Painel de conteúdo aberto (padrão) ou recolhido. */
export function loadPanelOpen(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) !== 'closed'
  } catch {
    return true
  }
}

export function savePanelOpen(open: boolean) {
  try {
    localStorage.setItem(PANEL_KEY, open ? 'open' : 'closed')
  } catch {
    // armazenamento bloqueado: vale só nesta sessão
  }
}

/** Texto sem acento e em minúsculas, para a busca do painel. */
export const normalizeText = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
