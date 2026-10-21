import { describe, expect, it } from 'vitest'
import { layoutDay, snap } from '@/lib/calendarLayout'

describe('grade do calendário', () => {
  it('eventos sem sobreposição ocupam a largura toda', () => {
    const r = layoutDay([
      { key: 'a', start: 480, end: 540 },
      { key: 'b', start: 540, end: 600 },
    ])
    expect(r.map((p) => [p.event.key, p.lane, p.lanes])).toEqual([
      ['a', 0, 1],
      ['b', 0, 1],
    ])
  })
  it('eventos sobrepostos dividem a coluna e reaproveitam faixas livres', () => {
    const r = layoutDay([
      { key: 'a', start: 480, end: 600 },
      { key: 'b', start: 510, end: 540 },
      { key: 'c', start: 550, end: 580 },
    ])
    const m = Object.fromEntries(r.map((p) => [p.event.key, [p.lane, p.lanes]]))
    expect(m).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2] })
  })
  it('arredonda para blocos de 30 minutos', () => {
    expect(snap(44)).toBe(30)
    expect(snap(46)).toBe(60)
    expect(snap(-20)).toBe(-30)
  })
})
