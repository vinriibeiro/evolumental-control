import { CHALLENGES, LEVELS, TRACKS, type Challenge, type ChallengeLevel, type ChallengeTrack } from './catalog'

export interface ChallengeState {
  track: ChallengeTrack
  level: ChallengeLevel
  selectedId: string | null
  completed: string[]
  verified: string[]
  drafts: Record<string, string>
}

export const challengeStorageKey = (scope: string) => `${scope}:challenges:v1`
export const challengeStoragePrefix = (scope: string) => `${scope}:challenges:v2:`
type ChallengeStorage = Pick<Storage, 'getItem' | 'setItem'>
const knownIds = new Set(CHALLENGES.map((challenge) => challenge.id))

/** Somente propriedades explicitamente alteradas são gravadas. */
export interface ChallengePatch {
  track?: ChallengeTrack
  level?: ChallengeLevel
  selectedId?: string | null
  drafts?: Record<string, string>
  completed?: Record<string, boolean>
  verified?: Record<string, boolean>
}

export function initialChallengeState(): ChallengeState {
  return { track: 'python', level: 'first_steps', selectedId: null, completed: [], verified: [], drafts: {} }
}

/** Aceita apenas desafios conhecidos; evita duplicar progresso ao recuperar dados locais. */
export function parseChallengeState(raw: string | null): ChallengeState {
  const initial = initialChallengeState()
  if (!raw) return initial
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dados locais de desafios inválidos.')
  const saved = value as Record<string, unknown>
  const known = new Set(CHALLENGES.map((challenge) => challenge.id))
  const drafts: Record<string, string> = {}
  if (saved.drafts && typeof saved.drafts === 'object' && !Array.isArray(saved.drafts)) {
    for (const [id, text] of Object.entries(saved.drafts)) {
      if (known.has(id) && typeof text === 'string') drafts[id] = text
    }
  }
  return {
    track: TRACKS.some((track) => track.value === saved.track) ? saved.track as ChallengeTrack : initial.track,
    level: LEVELS.some((level) => level.value === saved.level) ? saved.level as ChallengeLevel : initial.level,
    selectedId: typeof saved.selectedId === 'string' && known.has(saved.selectedId) ? saved.selectedId : null,
    completed: [...new Set(Array.isArray(saved.completed) ? saved.completed.filter((id): id is string => typeof id === 'string' && known.has(id)) : [])],
    verified: [],
    drafts,
  }
}

/** Migração aditiva: o legado permanece intacto; cada chave v2 prevalece sobre seu campo v1. */
export function readChallengeState(storage: ChallengeStorage, scope: string): { state: ChallengeState; warning: string } {
  let state = initialChallengeState()
  let warning = ''
  try {
    state = parseChallengeState(storage.getItem(challengeStorageKey(scope)))
  } catch {
    warning = 'Não foi possível ler parte do progresso anterior. Os dados originais foram preservados neste navegador.'
  }
  const prefix = challengeStoragePrefix(scope)
  const read = (key: string): unknown => {
    const raw = storage.getItem(prefix + key)
    if (raw === null) return undefined
    try {
      return JSON.parse(raw) as unknown
    } catch {
      warning = 'Não foi possível ler parte do progresso anterior. Os dados originais foram preservados neste navegador.'
      return undefined
    }
  }
  const track = read('track')
  const level = read('level')
  const selected = read('selectedId')
  if (TRACKS.some((item) => item.value === track)) state.track = track as ChallengeTrack
  if (LEVELS.some((item) => item.value === level)) state.level = level as ChallengeLevel
  if (selected === null || (typeof selected === 'string' && knownIds.has(selected))) state.selectedId = selected
  const completed = new Set(state.completed)
  const verified = new Set<string>()
  for (const id of knownIds) {
    const draft = read(`draft:${id}`)
    const done = read(`completed:${id}`)
    if (typeof draft === 'string') state.drafts[id] = draft
    if (done === true) completed.add(id)
    if (done === false) completed.delete(id)
    if (read(`verified:${id}`) === true) verified.add(id)
  }
  return { state: { ...state, completed: [...completed], verified: [...verified] }, warning }
}

export function mergeChallengePatches(earlier: ChallengePatch, latest: ChallengePatch): ChallengePatch {
  return {
    ...earlier,
    ...latest,
    drafts: { ...earlier.drafts, ...latest.drafts },
    completed: { ...earlier.completed, ...latest.completed },
    verified: { ...earlier.verified, ...latest.verified },
  }
}

export function applyChallengePatch(state: ChallengeState, patch: ChallengePatch): ChallengeState {
  const completed = new Set(state.completed)
  for (const [id, done] of Object.entries(patch.completed ?? {})) {
    if (knownIds.has(id)) { if (done) completed.add(id); else completed.delete(id) }
  }
  const verified = new Set(state.verified)
  for (const [id, passed] of Object.entries(patch.verified ?? {})) {
    if (!knownIds.has(id)) continue
    if (passed) verified.add(id)
    else verified.delete(id)
  }
  return {
    ...state,
    ...(patch.track !== undefined ? { track: patch.track } : {}),
    ...(patch.level !== undefined ? { level: patch.level } : {}),
    ...(patch.selectedId !== undefined ? { selectedId: patch.selectedId } : {}),
    drafts: { ...state.drafts, ...patch.drafts },
    completed: [...completed],
    verified: [...verified],
  }
}

/** Escritas independentes impedem que uma aba apague outros desafios com um snapshot antigo. */
export function persistChallengePatch(storage: ChallengeStorage, scope: string, patch: ChallengePatch): void {
  const prefix = challengeStoragePrefix(scope)
  for (const key of ['track', 'level', 'selectedId'] as const) {
    if (patch[key] !== undefined) storage.setItem(prefix + key, JSON.stringify(patch[key]))
  }
  for (const [id, text] of Object.entries(patch.drafts ?? {})) {
    if (knownIds.has(id)) storage.setItem(`${prefix}draft:${id}`, JSON.stringify(text))
  }
  for (const [id, done] of Object.entries(patch.completed ?? {})) {
    if (knownIds.has(id)) storage.setItem(`${prefix}completed:${id}`, JSON.stringify(done))
  }
  for (const [id, passed] of Object.entries(patch.verified ?? {})) {
    if (knownIds.has(id)) storage.setItem(`${prefix}verified:${id}`, JSON.stringify(passed))
  }
}

export function challengeBackup(state: ChallengeState, preservedLegacy: string | null = null) {
  return {
    format: 'vlm-challenges', schemaVersion: 2, exportedAt: new Date().toISOString(), state, preservedLegacy,
    exercises: CHALLENGES.filter((item) => state.completed.includes(item.id) || state.verified.includes(item.id) || item.id in state.drafts)
      .map((item) => ({ id: item.id, title: item.title, track: item.track, level: item.level })),
  }
}

/** Próximo item pendente na ordem do catálogo, com retorno ao início e sem repetir concluídos. */
export function nextUncompleted(items: Challenge[], completed: string[], currentId: string | null = null): Challenge | null {
  const done = new Set(completed)
  const current = items.findIndex((item) => item.id === currentId)
  for (let offset = 1; offset <= items.length; offset++) {
    const candidate = items[(current + offset) % items.length]
    if (!done.has(candidate.id)) return candidate
  }
  return null
}
