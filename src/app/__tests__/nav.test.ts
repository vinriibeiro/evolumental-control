import { describe, expect, it } from 'vitest'
import { MENU, NAV, groupFor, tabsFor, titleFor } from '../nav'

describe('navegação: sete áreas focadas em Dados, Cursos do Drive, Meus Cadernos e Organização', () => {
  it('tem exatamente as sete áreas principais, nesta ordem', () => {
    expect(MENU.map((g) => g.label)).toEqual([
      'Meu Planejamento',
      'Cursos do Drive',
      'Estudos em Dados',
      'Meus Cadernos',
      'Sala de Estudos',
      'Metas e Evolução',
      'Configurações',
    ])
    expect(MENU[0].to).toBe('/')
    expect(MENU[1].to).toBe('/cursos')
    expect(MENU[3].to).toBe('/cadernos')
  })

  it('cada rota pertence a uma única área e o item do menu abre uma das suas abas', () => {
    const all = MENU.flatMap((g) => [...g.tabs.map((t) => t.to), ...(g.also ?? [])])
    expect(new Set(all).size).toBe(all.length)
    for (const g of MENU) expect(g.tabs.some((t) => t.to === g.to)).toBe(true)
  })

  it('mantém toda organização e rotas de dados/cursos alcançáveis, sem inglês', () => {
    const expected: Record<string, string> = {
      '/': 'Meu Planejamento',
      '/ciclos': 'Meu Planejamento',
      '/rotinas': 'Meu Planejamento',
      '/revisoes': 'Meu Planejamento',
      '/cursos': 'Cursos do Drive',
      '/cursos/abc': 'Cursos do Drive',
      '/biblioteca': 'Cursos do Drive',
      '/livros/abc': 'Cursos do Drive',
      '/audios': 'Cursos do Drive',
      '/videos': 'Cursos do Drive',
      '/trilhas': 'Estudos em Dados',
      '/projetos': 'Estudos em Dados',
      '/laboratorio': 'Estudos em Dados',
      '/diagnostico/sql': 'Estudos em Dados',
      '/materias/123': 'Estudos em Dados',
      '/flashcards/revisar': 'Estudos em Dados',
      '/banco-de-questoes': 'Estudos em Dados',
      '/cadernos': 'Meus Cadernos',
      '/cadernos/favoritos': 'Meus Cadernos',
      '/cadernos/recentes': 'Meus Cadernos',
      '/cadernos/conexoes': 'Meus Cadernos',
      '/cadernos/lixeira': 'Meus Cadernos',
      '/cadernos/abc': 'Meus Cadernos',
      '/cadernos/abc/pagina/xyz': 'Meus Cadernos',
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
    expect(groupFor('/ingles')).toBeUndefined()
    expect(groupFor('/nao-existe')).toBeUndefined()
    expect(titleFor('/cursos/abc')).toBe('Cursos do Drive')
    expect(titleFor('/nao-existe')).toBe('VLM Control')
  })

  it('mostra as abas só nas páginas principais da área', () => {
    expect(tabsFor('/').map((t) => t.label)).toEqual(['Planejamento', 'Ciclo de estudos', 'Rotinas', 'Revisões'])
    expect(tabsFor('/cursos').map((t) => t.label)).toEqual(['Meus Cursos', 'Estante', 'Vídeos', 'Áudios'])
    expect(tabsFor('/cadernos').map((t) => t.label)).toEqual(['Cadernos', 'Favoritos', 'Recentes', 'Conexões', 'Lixeira'])
    expect(tabsFor('/cadernos/abc')).toEqual([])
    expect(tabsFor('/cadernos/abc/pagina/xyz')).toEqual([])
    expect(tabsFor('/metas').map((t) => t.label)).toEqual(['Metas', 'Evolução', 'Relatório semanal', 'Exercícios'])
    expect(tabsFor('/sala/historico').map((t) => t.label)).toEqual(['Sessão', 'Histórico'])
    expect(tabsFor('/livros/abc')).toEqual([])
    expect(tabsFor('/materias/123')).toEqual([])
    expect(tabsFor('/configuracoes')).toEqual([])
  })

  it('a busca (Ctrl K) lista as páginas sem repetir endereço e sem inglês', () => {
    const tos = NAV.map((n) => n.to)
    expect(new Set(tos).size).toBe(tos.length)
    expect(tos).not.toContain('/ingles')
    for (const to of ['/', '/cursos', '/trilhas', '/cadernos', '/biblioteca', '/sala', '/metas', '/configuracoes']) expect(tos).toContain(to)
  })
})
