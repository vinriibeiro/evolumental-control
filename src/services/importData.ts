// Importação de pacotes/backups JSON (mesmo formato da exportação de
// Configurações). Importa pastas, matérias, tópicos, materiais, baralhos, cartões,
// mapas mentais e sessões de estudo concluídas (com pausas). Sempre cria cópias novas: os IDs do arquivo são
// trocados por IDs novos e os vínculos internos são refeitos, então nada de
// outro usuário ou de outra importação é sobrescrito.
import type { DataBackend } from '@/lib/data/types'
import type { Insert, MindMapData, TableName } from '@/types/db'

type Raw = Record<string, unknown>

export const IMPORT_TABLES = ['study_folders', 'subjects', 'topics', 'study_materials', 'flashcard_decks', 'flashcards', 'mind_maps', 'study_sessions', 'study_session_pauses'] as const
export type ImportTable = (typeof IMPORT_TABLES)[number]

export interface ImportPlan {
  rows: { [K in ImportTable]: Array<Insert<K> & { id: string }> }
  counts: Record<ImportTable, number>
  warnings: string[]
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}
const num = (v: unknown, min: number, max: number, def: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def
}
const int = (v: unknown, min: number, max: number, def: number) => Math.round(num(v, min, max, def))
const oneOf = <T extends string>(v: unknown, opts: readonly T[], def: T): T => (opts.includes(v as T) ? (v as T) : def)
const date = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const iso = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null)
const color = (v: unknown, def = '#DEB887') => (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : def)
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.filter((x): x is Raw => Boolean(x) && typeof x === 'object') : [])

/** Ordena linhas com parent_id para que os pais venham antes dos filhos. */
function sortParentsFirst(raw: Raw[]): Array<{ t: Raw; i: number }> {
  const byOld = new Map(raw.filter((t) => typeof t.id === 'string').map((t) => [t.id as string, t]))
  const depth = (t: Raw) => {
    let d = 0
    let cur: Raw | undefined = t
    const seen = new Set<unknown>()
    while (cur && typeof cur.parent_id === 'string' && byOld.has(cur.parent_id) && !seen.has(cur.parent_id) && d < 100) {
      seen.add(cur.parent_id)
      cur = byOld.get(cur.parent_id)
      d++
    }
    return d
  }
  return raw
    .map((t, i) => ({ t, i, d: depth(t) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
}

/** Valida o arquivo e prepara as linhas com IDs novos. Não grava nada. */
export function planImport(input: unknown): ImportPlan {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Arquivo inválido: o JSON precisa ser um objeto.')
  const src = input as Raw
  const warnings: string[] = []
  const subjMap = new Map<string, string>()
  const topicMap = new Map<string, string>()
  const deckMap = new Map<string, string>()
  const folderMap = new Map<string, string>()
  const remap = (m: Map<string, string>, v: unknown) => (typeof v === 'string' ? (m.get(v) ?? null) : null)
  const newId = (m: Map<string, string>, old: unknown) => {
    const id = crypto.randomUUID()
    if (typeof old === 'string') m.set(old, id)
    return id
  }

  // Pastas (arquivos antigos não têm: tudo vai para a raiz). Pais antes dos filhos.
  const rawFolders = arr(src.study_folders)
  for (const f of rawFolders) if (typeof f.id === 'string') folderMap.set(f.id, crypto.randomUUID())
  const study_folders = sortParentsFirst(rawFolders).flatMap(({ t: f, i }) => {
    const name = str(f.name, 160)
    if (!name) return warnings.push(`Pasta #${i + 1} sem nome foi ignorada.`), []
    const id = (typeof f.id === 'string' && folderMap.get(f.id)) || crypto.randomUUID()
    const kind = oneOf(f.kind, ['area', 'folder'] as const, 'folder')
    const parent = kind === 'area' ? null : remap(folderMap, f.parent_id)
    return [
      {
        id,
        kind,
        parent_id: parent && parent !== id ? parent : null,
        name,
        color: f.color == null ? null : color(f.color),
        icon: str(f.icon, 40),
        sort_order: int(f.sort_order, -1e6, 1e6, i),
        favorite: f.favorite === true,
      },
    ]
  })
  const keptFolders = new Set(study_folders.map((f) => f.id))
  for (const f of study_folders) if (f.parent_id && !keptFolders.has(f.parent_id)) f.parent_id = null

  const subjects = arr(src.subjects).flatMap((s, i) => {
    const name = str(s.name, 160)
    if (!name) return warnings.push(`Matéria #${i + 1} sem nome foi ignorada.`), []
    return [
      {
        id: newId(subjMap, s.id),
        name,
        description: str(s.description, 4000),
        color: color(s.color),
        icon: str(s.icon, 40),
        priority: int(s.priority, 1, 5, 3),
        difficulty: int(s.difficulty, 1, 5, 3),
        weekly_goal_hours: s.weekly_goal_hours == null ? null : num(s.weekly_goal_hours, 0, 168, 0),
        start_date: date(s.start_date),
        target_date: date(s.target_date),
        notes: str(s.notes, 10000),
        status: oneOf(s.status, ['active', 'paused', 'completed', 'archived'] as const, 'active'),
        exam: str(s.exam, 200),
        sort_order: int(s.sort_order, -1e6, 1e6, i),
        folder_id: keptFolders.has(remap(folderMap, s.folder_id) ?? '') ? remap(folderMap, s.folder_id) : null,
        favorite: s.favorite === true,
      },
    ]
  })

  // Tópicos: pais antes dos filhos, independentemente da ordem no arquivo.
  const rawTopics = arr(src.topics)
  for (const t of rawTopics) if (typeof t.id === 'string') topicMap.set(t.id, crypto.randomUUID())
  const topics = sortParentsFirst(rawTopics)
    .flatMap(({ t, i }) => {
      const name = str(t.name, 300)
      const subject_id = remap(subjMap, t.subject_id)
      if (!name || !subject_id) return warnings.push(`Tópico #${i + 1} ignorado (sem nome ou sem matéria correspondente).`), []
      const id = (typeof t.id === 'string' && topicMap.get(t.id)) || crypto.randomUUID()
      const parent = remap(topicMap, t.parent_id)
      return [
        {
          id,
          subject_id,
          parent_id: parent && parent !== id ? parent : null,
          kind: oneOf(t.kind, ['topic', 'folder'] as const, 'topic'),
          favorite: t.favorite === true,
          name,
          description: str(t.description, 4000),
          sort_order: int(t.sort_order, -1e6, 1e6, i),
          status: oneOf(t.status, ['not_started', 'in_progress', 'completed', 'reviewing'] as const, 'not_started'),
          mastery: int(t.mastery, 0, 5, 0),
          priority: int(t.priority, 1, 5, 3),
          weight: num(t.weight, 0.01, 100, 1),
          estimated_minutes: t.estimated_minutes == null ? null : int(t.estimated_minutes, 0, 100000, 0),
          notes: str(t.notes, 10000),
        },
      ]
    })
  // Um tópico cujo pai foi descartado vira raiz.
  const keptTopics = new Set(topics.map((t) => t.id))
  for (const t of topics) if (t.parent_id && !keptTopics.has(t.parent_id)) t.parent_id = null

  const study_materials = arr(src.study_materials).flatMap((m, i) => {
    const title = str(m.title, 300)
    const url = str(m.url, 2000)
    if (!title) return warnings.push(`Material #${i + 1} sem título foi ignorado.`), []
    return [
      {
        id: crypto.randomUUID(),
        title,
        url: url && /^https?:\/\//i.test(url) ? url : null,
        notes: str(m.notes, 4000),
        subject_id: remap(subjMap, m.subject_id),
        topic_id: remap(topicMap, m.topic_id),
      },
    ]
  })

  const flashcard_decks = arr(src.flashcard_decks).flatMap((d, i) => {
    const name = str(d.name, 160)
    if (!name) return warnings.push(`Baralho #${i + 1} sem nome foi ignorado.`), []
    return [
      {
        id: newId(deckMap, d.id),
        name,
        description: str(d.description, 4000),
        folder: str(d.folder, 120),
        subject_id: remap(subjMap, d.subject_id),
        topic_id: remap(topicMap, d.topic_id),
        archived: d.archived === true,
      },
    ]
  })

  const now = new Date().toISOString()
  let skippedCards = 0
  const flashcards = arr(src.flashcards).flatMap((c) => {
    const front = str(c.front, 10000)
    const back = str(c.back, 10000)
    const deck_id = remap(deckMap, c.deck_id)
    if (!front || !back || !deck_id) return skippedCards++, []
    const tags = Array.isArray(c.tags) ? [...new Set(c.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim().slice(0, 60)).filter(Boolean))].slice(0, 50) : []
    const reps = int(c.repetitions, 0, 1e6, 0)
    return [
      {
        id: crypto.randomUUID(),
        deck_id,
        subject_id: remap(subjMap, c.subject_id),
        topic_id: remap(topicMap, c.topic_id),
        front,
        back,
        note: str(c.note, 10000),
        tags,
        status: oneOf(c.status, ['new', 'learning', 'review', 'suspended'] as const, reps > 0 ? 'review' : 'new'),
        ease: num(c.ease, 1.3, 5, 2.5),
        interval_days: num(c.interval_days, 0, 36500, 0),
        repetitions: reps,
        lapses: int(c.lapses, 0, 1e6, 0),
        due_at: iso(c.due_at) ?? now,
        last_reviewed_at: iso(c.last_reviewed_at),
      },
    ]
  })
  if (skippedCards) warnings.push(`${skippedCards} cartão(ões) ignorado(s) (frente/verso vazios ou baralho inexistente no arquivo).`)

  const mind_maps = arr(src.mind_maps).flatMap((m, i) => {
    const title = str(m.title, 200)
    const data = m.data as MindMapData | undefined
    if (!title || !data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) return warnings.push(`Mapa #${i + 1} inválido foi ignorado.`), []
    const nodes = data.nodes
      .filter((n) => n && typeof n.id === 'string' && n.position && Number.isFinite(n.position.x) && Number.isFinite(n.position.y))
      .slice(0, 5000)
      .map((n) => ({
        id: n.id,
        type: 'mind',
        position: { x: n.position.x, y: n.position.y },
        data: {
          label: String(n.data?.label ?? '').slice(0, 500) || 'Sem título',
          color: color(n.data?.color, '#DEB887'),
          size: oneOf(n.data?.size, ['sm', 'md', 'lg'] as const, 'md'),
          shape: oneOf(n.data?.shape, ['rounded', 'pill', 'rect'] as const, 'rounded'),
        },
      }))
    const ids = new Set(nodes.map((n) => n.id))
    const edges = data.edges
      .filter((e) => e && ids.has(e.source) && ids.has(e.target))
      .slice(0, 10000)
      .map((e) => ({ id: typeof e.id === 'string' ? e.id : crypto.randomUUID(), source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, targetHandle: e.targetHandle ?? null }))
    return [
      {
        id: crypto.randomUUID(),
        title,
        description: str(m.description, 4000),
        folder: str(m.folder, 120),
        subject_id: remap(subjMap, m.subject_id),
        topic_id: remap(topicMap, m.topic_id),
        data: { nodes, edges } as MindMapData,
      },
    ]
  })

  // Sessões concluídas (com pausas). Sessões em andamento/canceladas não entram.
  const ACT = ['theory', 'questions', 'review', 'video', 'reading', 'flashcards', 'mock_exam', 'other'] as const
  const MODES = ['stopwatch', 'countdown', 'pomodoro', 'intervals', 'manual'] as const
  const nowMs = Date.now()
  let skippedSessions = 0
  const study_session_pauses: Array<Insert<'study_session_pauses'> & { id: string }> = []
  const study_sessions = arr(src.study_sessions).flatMap((x) => {
    const start = iso(x.started_at)
    const end = iso(x.ended_at)
    if (x.status !== 'completed' || !start || !end) return skippedSessions++, []
    const s0 = Date.parse(start)
    const e0 = Date.parse(end)
    if (e0 <= s0 || e0 - s0 > 86400000 || e0 > nowMs + 60000) return skippedSessions++, []
    const id = crypto.randomUUID()
    for (const p of arr(x.pauses)) {
      const ps = iso(p.started_at)
      const pe = iso(p.ended_at) ?? end
      if (!ps) continue
      const a = Math.max(s0, Date.parse(ps))
      const b = Math.min(e0, Date.parse(pe))
      if (b <= a) continue
      study_session_pauses.push({ id: crypto.randomUUID(), session_id: id, kind: oneOf(p.kind, ['pause', 'break'] as const, 'pause'), started_at: new Date(a).toISOString(), ended_at: new Date(b).toISOString() })
    }
    return [
      {
        id,
        subject_id: remap(subjMap, x.subject_id),
        topic_id: remap(topicMap, x.topic_id),
        activity_type: oneOf(x.activity_type, ACT, 'other'),
        mode: oneOf(x.mode, MODES, 'manual'),
        status: 'completed' as const,
        started_at: start,
        ended_at: end,
        adjustment_seconds: int(x.adjustment_seconds, -86400, 86400, 0),
        notes: str(x.notes, 4000),
      },
    ]
  })
  if (skippedSessions) warnings.push(`${skippedSessions} sessão(ões) ignorada(s) (não concluídas, datas inválidas, no futuro ou com mais de 24 h).`)

  const rows = { study_folders, subjects, topics, study_materials, flashcard_decks, flashcards, mind_maps, study_sessions, study_session_pauses } as ImportPlan['rows']
  const counts = Object.fromEntries(IMPORT_TABLES.map((t) => [t, rows[t].length])) as ImportPlan['counts']
  const unsupported = Object.keys(src).filter((k) => Array.isArray(src[k]) && !(IMPORT_TABLES as readonly string[]).includes(k) && k !== 'study_session_pauses' && (src[k] as unknown[]).length > 0)
  if (unsupported.length) warnings.push(`Não importados nesta versão (histórico): ${unsupported.join(', ')}.`)
  return { rows, counts, warnings }
}

/** Grava o plano em lotes, na ordem que respeita as dependências. */
export async function runImport(backend: DataBackend, plan: ImportPlan, onProgress?: (done: number, total: number) => void): Promise<number> {
  const total = IMPORT_TABLES.reduce((a, t) => a + plan.rows[t].length, 0)
  let done = 0
  for (const table of IMPORT_TABLES) {
    const rows = plan.rows[table]
    // Hierarquias em lotes por nível: um lote nunca contém filho antes do pai.
    const size = 300
    if (table === 'topics' || table === 'study_folders') {
      const levels: Array<Array<{ id: string; parent_id?: string | null }>> = []
      const level = new Map<string, number>()
      for (const t of rows as Array<{ id: string; parent_id?: string | null }>) {
        const l = t.parent_id ? (level.get(t.parent_id) ?? 0) + 1 : 0
        level.set(t.id, l)
        ;(levels[l] ??= []).push(t)
      }
      for (const group of levels) {
        for (let i = 0; i < group.length; i += 300) {
          await backend.insert(table, group.slice(i, i + 300) as never)
          done += Math.min(300, group.length - i)
          onProgress?.(done, total)
        }
      }
      continue
    }
    for (let i = 0; i < rows.length; i += size) {
      await backend.insert(table as TableName, rows.slice(i, i + size) as never)
      done += Math.min(size, rows.length - i)
      onProgress?.(done, total)
    }
  }
  return done
}
