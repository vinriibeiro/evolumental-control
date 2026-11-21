import { describe, expect, it } from 'vitest'
import { MENU, NAV, groupFor, tabsFor, titleFor } from '../nav'

describe('navegação da 2.0: seis áreas', () => {
  it('tem exatamente as seis áreas pedidas, nesta ordem', () => {
    expect(MENU.map((g) => g.label)).toEqual(['Meu Planejamento', 'Trilhas de Estudo', 'Biblioteca', 'Sala de Estudos', 'Metas e Evolução', 'Configurações'])
    expect(MENU[0].to).toBe('/')
  })

  it('cada rota pertence a uma única área e o item do menu abre uma das suas abas', () => {
    const all = MENU.flatMap((g) => [...g.tabs.map((t) => t.to), ...(g.also ?? [])])
    expect(new Set(all).size).toBe(all.length)
    for (const g of MENU) expect(g.tabs.some((t) => t.to === g.to)).toBe(true)
  })

  it('tudo o que existia continua alcançável dentro de alguma área', () => {
    const expected: Record<string, string> = {
      '/': 'Meu Planejamento',
      '/rotinas': 'Meu Planejamento',
      '/revisoes': 'Meu Planejamento',
      '/ciclos': 'Meu Planejamento',
      '/trilhas': 'Trilhas de Estudo',
      '/projetos': 'Trilhas de Estudo',
      '/laboratorio': 'Trilhas de Estudo',
      '/diagnostico/sql': 'Trilhas de Estudo',
      '/materias/123': 'Trilhas de Estudo',
      '/flashcards/revisar': 'Trilhas de Estudo',
      '/banco-de-questoes': 'Trilhas de Estudo',
      '/cgu/aula/1': 'Trilhas de Estudo',
      '/biblioteca': 'Biblioteca',
      '/livros/abc': 'Biblioteca',
      '/livros/pdf/abc': 'Biblioteca',
      '/cursos/abc': 'Biblioteca',
      '/audios': 'Biblioteca',
      '/videos': 'Biblioteca',
      '/ingles': 'Biblioteca',
      '/sala': 'Sala de Estudos',
      '/sala/historico': 'Sala de Estudos',
      '/cronometro': 'Sala de Estudos',
      '/metas': 'Metas e Evolução',
      '/evolucao': 'Metas e Evolução',
      '/relatorio-semanal': 'Metas e Evolução',
      '/questoes': 'Metas e Evolução',
      '/configuracoes': 'Configurações',
    }
    for (const [path, label] of Object.entries(expected)) expect(groupFor(path)?.label, path).toBe(label)
    expect(groupFor('/nao-existe')).toBeUndefined()
    expect(titleFor('/livros/abc')).toBe('Biblioteca')
    expect(titleFor('/nao-existe')).toBe('VLM Control')
  })

  it('mostra as abas só nas páginas principais da área', () => {
    expect(tabsFor('/').map((t) => t.label)).toEqual(['Planejamento', 'Rotinas', 'Revisões', 'Ciclo de estudos'])
    expect(tabsFor('/metas').map((t) => t.label)).toEqual(['Metas', 'Evolução', 'Relatório semanal', 'Exercícios'])
    expect(tabsFor('/sala/historico').map((t) => t.label)).toEqual(['Sessão', 'Histórico'])
    expect(tabsFor('/livros/abc')).toEqual([])
    expect(tabsFor('/materias/123')).toEqual([])
    expect(tabsFor('/configuracoes')).toEqual([])
  })

  it('a busca (Ctrl K) lista as páginas sem repetir endereço', () => {
    const tos = NAV.map((n) => n.to)
    expect(new Set(tos).size).toBe(tos.length)
    for (const to of ['/', '/trilhas', '/biblioteca', '/sala', '/metas', '/configuracoes', '/cgu']) expect(tos).toContain(to)
  })
})
