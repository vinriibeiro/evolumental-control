import { describe, expect, it } from 'vitest'
import { MENU, NAV, groupFor, tabsFor } from '../nav'

describe('menu lateral agrupado', () => {
  it('tem poucos itens e cobre todas as páginas do menu completo', () => {
    expect(MENU.length).toBeLessThanOrEqual(6)
    const noMenu = new Set(MENU.flatMap((g) => g.tabs.map((t) => t.to)))
    for (const n of NAV) expect(noMenu.has(n.to), `${n.to} ficou fora do menu`).toBe(true)
  })

  it('cada rota pertence a um único grupo e o primeiro item abre uma das suas abas', () => {
    const all = MENU.flatMap((g) => g.tabs.map((t) => t.to))
    expect(new Set(all).size).toBe(all.length)
    for (const g of MENU) expect(g.tabs.some((t) => t.to === g.to)).toBe(true)
  })

  it('identifica o grupo, inclusive em telas de detalhe', () => {
    expect(groupFor('/')?.label).toBe('Visão geral')
    expect(groupFor('/espaco')?.label).toBe('Visão geral')
    expect(groupFor('/rotinas')?.label).toBe('Calendário')
    expect(groupFor('/audios')?.label).toBe('Biblioteca')
    expect(groupFor('/biblioteca/abc')?.label).toBe('Biblioteca')
    expect(groupFor('/materias/123')?.label).toBe('Biblioteca')
    expect(groupFor('/questoes')?.label).toBe('Biblioteca')
    expect(groupFor('/flashcards/revisar')?.label).toBe('Biblioteca')
    expect(groupFor('/nao-existe')).toBeUndefined()
  })

  it('mostra as abas só nas páginas principais do grupo', () => {
    expect(tabsFor('/calendario').map((t) => t.label)).toEqual(['Calendário', 'Rotinas'])
    expect(tabsFor('/biblioteca').map((t) => t.label)).toEqual(['Matérias', 'Trilhas', 'Inglês', 'Livros', 'Áudios', 'Flashcards', 'Revisões', 'Banco de questões', 'Desempenho'])
    expect(tabsFor('/biblioteca/abc')).toEqual([])
    expect(tabsFor('/materias/123')).toEqual([])
    expect(tabsFor('/cronometro')).toEqual([])
    expect(tabsFor('/configuracoes')).toEqual([])
  })
})
