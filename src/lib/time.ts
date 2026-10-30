// Datas e fusos horários. Dias são representados como chaves 'YYYY-MM-DD'
// no fuso do usuário; instantes são milissegundos UTC.

export type DayKey = string

const dtfCache = new Map<string, Intl.DateTimeFormat>()
function partsFormatter(tz: string) {
  let f = dtfCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    dtfCache.set(tz, f)
  }
  return f
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'
  } catch {
    return 'America/Sao_Paulo'
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function zonedParts(ms: number, tz: string) {
  const parts = partsFormatter(tz).formatToParts(new Date(ms))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

/** Deslocamento (ms) do fuso em relação ao UTC no instante dado. */
export function tzOffsetMs(ms: number, tz: string): number {
  const p = zonedParts(ms, tz)
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s)
  return asUtc - Math.floor(ms / 1000) * 1000
}

const pad = (n: number) => String(n).padStart(2, '0')

export function dayKey(ms: number, tz: string): DayKey {
  const p = zonedParts(ms, tz)
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`
}

/**
 * Instante atual arredondado ao minuto (ISO). Estável durante o minuto, por
 * isso serve em filtros de consultas sem gerar recargas a cada renderização.
 */
export function minuteIso(offsetMs = 0): string {
  return new Date(Math.floor((Date.now() + offsetMs) / 60000) * 60000).toISOString()
}

export function todayKey(tz: string): DayKey {
  return dayKey(Date.now(), tz)
}

function parseKey(key: DayKey) {
  const [y, m, d] = key.split('-').map(Number)
  return { y, m, d }
}

/** Instante UTC (ms) de um horário local 'HH:MM' no dia informado. */
export function zonedTime(key: DayKey, hhmm: string, tz: string): number {
  const { y, m, d } = parseKey(key)
  const [hh, mm] = hhmm.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  let result = guess - tzOffsetMs(guess, tz)
  // Segunda iteração corrige transições de horário de verão.
  const off2 = tzOffsetMs(result, tz)
  result = guess - off2
  return result
}

export function zonedDayStart(key: DayKey, tz: string): number {
  return zonedTime(key, '00:00', tz)
}

export function addDays(key: DayKey, n: number): DayKey {
  const { y, m, d } = parseKey(key)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

/** 0 = domingo … 6 = sábado */
export function weekday(key: DayKey): number {
  const { y, m, d } = parseKey(key)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Semana começa na segunda-feira. */
export function startOfWeek(key: DayKey): DayKey {
  const wd = weekday(key)
  return addDays(key, -((wd + 6) % 7))
}

export function startOfMonth(key: DayKey): DayKey {
  return key.slice(0, 8) + '01'
}

export function endOfMonth(key: DayKey): DayKey {
  const { y, m } = parseKey(key)
  const dt = new Date(Date.UTC(y, m, 0))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export function addMonths(key: DayKey, n: number): DayKey {
  const { y, m } = parseKey(key)
  const dt = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-01`
}

export function diffDays(a: DayKey, b: DayKey): number {
  const pa = parseKey(a)
  const pb = parseKey(b)
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000)
}

export function eachDay(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = []
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k)
  return out
}

export type PeriodKind = 'day' | 'week' | 'month' | 'custom'
export interface DayRange {
  from: DayKey
  to: DayKey // inclusivo
}

export function periodRange(kind: PeriodKind, anchor: DayKey, custom?: DayRange): DayRange {
  switch (kind) {
    case 'day':
      return { from: anchor, to: anchor }
    case 'week': {
      const from = startOfWeek(anchor)
      return { from, to: addDays(from, 6) }
    }
    case 'month':
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) }
    case 'custom':
      return custom && custom.from <= custom.to ? custom : { from: anchor, to: anchor }
  }
}

/** Intervalo [início, fim) em instantes UTC para consultas. */
export function rangeInstants(range: DayRange, tz: string): { fromMs: number; toMs: number } {
  return { fromMs: zonedDayStart(range.from, tz), toMs: zonedDayStart(addDays(range.to, 1), tz) }
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Início e fim (em minutos) de uma janela de horário do dia. Um fim "00:00" depois de um início
 * maior que zero significa a meia-noite que encerra o dia (24:00), ex.: 22:00 às 00:00 = 2 h.
 */
export function windowRange(w: { start: string; end: string }): [number, number] {
  const start = hhmmToMinutes(w.start)
  const end = hhmmToMinutes(w.end)
  return [start, end === 0 && start > 0 ? 1440 : end]
}

/** Total de minutos válidos de uma lista de janelas (janelas inválidas contam zero). */
export function windowsTotalMinutes(list: Array<{ start: string; end: string }> = []): number {
  return list.reduce((sum, w) => {
    const [a, b] = windowRange(w)
    return sum + Math.max(0, b - a)
  }, 0)
}

export function minutesToHhmm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

// ---------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------

/** 3725 → "01:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

/** 3725 → "1h 02min"; 300 → "5min"; 0 → "0min" */
export function formatDuration(totalSeconds: number, opts: { seconds?: boolean } = {}): string {
  const neg = totalSeconds < 0
  const s = Math.abs(Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  let out: string
  if (h > 0) out = `${h}h ${pad(m)}min`
  else if (opts.seconds && m === 0) out = `${sec}s`
  else if (opts.seconds) out = `${m}min ${pad(sec)}s`
  else out = `${m}min`
  return neg ? `-${out}` : out
}

export function formatHours(totalSeconds: number, digits = 1): string {
  return `${(totalSeconds / 3600).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })}h`
}

export function formatDayKey(key: DayKey, style: 'short' | 'long' | 'weekday' | 'month' = 'short'): string {
  const { y, m, d } = parseKey(key)
  const date = new Date(Date.UTC(y, m - 1, d, 12))
  const opts: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { day: '2-digit', month: '2-digit', timeZone: 'UTC' }
      : style === 'long'
        ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }
        : style === 'weekday'
          ? { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }
          : { month: 'long', year: 'numeric', timeZone: 'UTC' }
  return new Intl.DateTimeFormat('pt-BR', opts).format(date)
}

export function formatTime(ms: number, tz: string, hourFormat: '24h' | '12h' = '24h'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: hourFormat === '12h',
  }).format(new Date(ms))
}

export function formatDateTime(ms: number, tz: string, hourFormat: '24h' | '12h' = '24h'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: hourFormat === '12h',
  }).format(new Date(ms))
}
