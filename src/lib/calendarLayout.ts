// Posicionamento de eventos na grade de horários (como numa agenda): eventos
// que se sobrepõem dividem a largura da coluna em faixas.

export interface GridEvent {
  key: string
  start: number // minutos desde 00:00
  end: number
}

export interface PlacedEvent<T extends GridEvent> {
  event: T
  lane: number
  lanes: number
}

export function layoutDay<T extends GridEvent>(events: T[]): PlacedEvent<T>[] {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end)
  const out: PlacedEvent<T>[] = []
  let cluster: PlacedEvent<T>[] = []
  let clusterEnd = -1
  const lanesEnd: number[] = []
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1))
    for (const p of cluster) p.lanes = lanes
    out.push(...cluster)
    cluster = []
    lanesEnd.length = 0
  }
  for (const ev of sorted) {
    if (cluster.length && ev.start >= clusterEnd) flush()
    let lane = lanesEnd.findIndex((end) => end <= ev.start)
    if (lane === -1) lane = lanesEnd.length
    lanesEnd[lane] = ev.end
    cluster.push({ event: ev, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, ev.end)
  }
  if (cluster.length) flush()
  return out
}

/** Arredonda minutos para a grade (padrão: 30 min). */
export function snap(minutes: number, step = 30): number {
  return Math.round(minutes / step) * step
}
