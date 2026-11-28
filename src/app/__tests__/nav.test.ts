import { describe, expect, it } from 'vitest'
import { MENU, NAV, groupFor, tabsFor, titleFor } from '../nav'

describe('navegação do VLM', () => {
  it('organiza as áreas na ordem de uso', () => {
    expect(MENU.map(({ label, to }) => [label, to])).toEqual([
      ['Meu Planejamento', '/'],
      ['Meus Cursos', '/cursos'],
      ['Meus Livros', '/biblioteca'],
      ['Meus Cadernos', '/cadernos'],
      ['Sala de Estudos', '/sala'],
      ['Configurações', '/configuracoes'],
    ])
  })

  it('cada rota pertence a uma única área e a busca alcança as abas', () => {
    const paths = MENU.flatMap((group) => [...group.tabs.map((tab) => tab.to), ...(group.also ?? [])])
    expect(new Set(paths).size).toBe(paths.length)
    for (const group of MENU) expect(group.tabs.some((tab) => tab.to === group.to)).toBe(true)
    const searchPaths = NAV.map((item) => item.to)
    expect(new Set(searchPaths).size).toBe(searchPaths.length)
    for (const path of ['/', '/materias', '/ciclos', '/revisoes', '/cursos', '/biblioteca', '/cadernos', '/sala', '/metas', '/flashcards']) {
      expect(searchPaths).toContain(path)
    }
  })

  it('mantém os detalhes nas áreas correspondentes', () => {
    const expected = {
      '/materias/123': 'Meu Planejamento',
      '/flashcards/revisar': 'Meu Planejamento',
      '/cursos/pastas/formacao-dsa': 'Meus Cursos',
      '/cursos/123/pdf/456': 'Meus Cursos',
      '/livros/123': 'Meus Livros',
      '/biblioteca/123': 'Meus Livros',
      '/cadernos/123/pagina/456': 'Meus Cadernos',
      '/cronometro': 'Sala de Estudos',
      '/evolucao': 'Sala de Estudos',
      '/relatorio-semanal': 'Sala de Estudos',
    }
    for (const [path, title] of Object.entries(expected)) {
      expect(groupFor(path)?.label, path).toBe(title)
      expect(titleFor(path)).toBe(title)
    }
    expect(titleFor('/nao-existe')).toBe('VLM Control')
  })

  it('remove as áreas de trilhas, rotinas prontas e questões da navegação e da busca', () => {
    for (const path of ['/trilhas', '/rotinas', '/projetos', '/diagnostico/sql', '/questoes', '/banco-de-questoes', '/cgu', '/laboratorio']) {
      expect(groupFor(path), path).toBeUndefined()
      expect(NAV.some((item) => item.to === path)).toBe(false)
    }
  })

  it('mostra abas nas páginas principais de cada área', () => {
    expect(tabsFor('/').map((tab) => tab.label)).toEqual(['Planejamento', 'Matérias', 'Ciclo de estudos', 'Revisões'])
    expect(tabsFor('/cursos').map((tab) => tab.label)).toEqual(['Meus Cursos', 'Vídeos', 'Áudios'])
    expect(tabsFor('/cadernos').map((tab) => tab.label)).toEqual(['Cadernos', 'Favoritos', 'Recentes', 'Conexões', 'Lixeira'])
    expect(tabsFor('/sala/historico').map((tab) => tab.label)).toEqual(['Sessão', 'Histórico', 'Metas', 'Evolução', 'Relatório semanal'])
    for (const path of ['/cadernos/123', '/cursos/pastas/formacao-dsa', '/livros/123', '/materias/123', '/configuracoes']) {
      expect(tabsFor(path), path).toEqual([])
    }
  })
})
