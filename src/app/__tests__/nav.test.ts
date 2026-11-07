import { describe, expect, it } from 'vitest'
import { MENU, NAV, OUTSIDE_MENU, groupFor, tabsFor, titleFor } from '../nav'

describe('menu lateral agrupado', () => {
  it('tem poucos itens e cobre todas as páginas do menu completo, exceto as deixadas de fora de propósito', () => {
    expect(MENU.length).toBeLessThanOrEqual(6)
    const inMenu = new Set(MENU.flatMap((g) => g.tabs.map((t) => t.to)))
    for (const n of NAV) expect(inMenu.has(n.to) || OUTSIDE_MENU.has(n.to), `${n.to} ficou fora do menu`).toBe(true)
    expect([...OUTSIDE_MENU].sort()).toEqual(['/ingles', '/videos'])
    // continuam acessíveis pela URL e pela busca, com título
    expect(titleFor('/ingles')).toBe('Inglês')
    expect(titleFor('/videos')).toBe('Vídeos')
    expect(titleFor('/livros/abc')).toBe('Livros')
    expect(titleFor('/biblioteca')).toBe('Biblioteca')
  })

  it('Biblioteca é uma pasta com todos os materiais, na ordem do fluxo, e abre nela mesma', () => {
    const lib = MENU.find((g) => g.label === 'Biblioteca')!
    expect(lib.to).toBe('/biblioteca')
    expect(lib.tabs.map((t) => t.label)).toEqual(['Biblioteca', 'Matérias', 'Trilhas', 'Cursos', 'Livros', 'Áudios', 'Flashcards', 'Banco de questões'])
    for (const removed of ['/ingles', '/videos', '/revisoes', '/questoes']) expect(lib.tabs.some((t) => t.to === removed), removed).toBe(false)
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
    expect(groupFor('/revisoes')?.label).toBe('Calendário')
    expect(groupFor('/audios')?.label).toBe('Biblioteca')
    expect(groupFor('/biblioteca/abc')?.label).toBe('Biblioteca')
    expect(groupFor('/livros/abc')?.label).toBe('Biblioteca')
    expect(groupFor('/livros/pdf/abc')?.label).toBe('Biblioteca')
    expect(groupFor('/cursos/abc')?.label).toBe('Biblioteca')
    expect(groupFor('/materias/123')?.label).toBe('Biblioteca')
    expect(groupFor('/questoes')?.label).toBe('Metas e relatórios')
    expect(groupFor('/flashcards/revisar')?.label).toBe('Biblioteca')
    expect(groupFor('/ingles')).toBeUndefined()
    expect(groupFor('/videos')).toBeUndefined()
    expect(groupFor('/nao-existe')).toBeUndefined()
  })

  it('mostra as abas só nas páginas principais do grupo', () => {
    expect(tabsFor('/calendario').map((t) => t.label)).toEqual(['Calendário', 'Rotinas', 'Revisões'])
    expect(tabsFor('/biblioteca').map((t) => t.label)).toEqual(['Biblioteca', 'Matérias', 'Trilhas', 'Cursos', 'Livros', 'Áudios', 'Flashcards', 'Banco de questões'])
    expect(tabsFor('/metas').map((t) => t.label)).toEqual(['Metas', 'Relatórios', 'Desempenho'])
    expect(tabsFor('/livros').map((t) => t.label)).toContain('Livros')
    expect(tabsFor('/biblioteca/abc')).toEqual([])
    expect(tabsFor('/livros/abc')).toEqual([])
    expect(tabsFor('/materias/123')).toEqual([])
    expect(tabsFor('/cronometro')).toEqual([])
    expect(tabsFor('/configuracoes')).toEqual([])
  })
})
