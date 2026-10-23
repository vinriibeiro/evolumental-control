import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { COLLAPSIBLE_GROUPS, groupForPath, isNavActive, NAV, titleFor } from '../nav'
import { SidebarNav } from '../SidebarNav'

const item = (label: string) => NAV.find((n) => n.label === label)!

describe('categorias e rota ativa (puro)', () => {
  it('a ordem das categorias é Estudar, Planejar, Fixar, Analisar, EvoQuest', () => {
    expect(COLLAPSIBLE_GROUPS.map((g) => g.label)).toEqual(['Estudar', 'Planejar', 'Fixar', 'Analisar', 'EvoQuest'])
  })

  it('cada categoria tem os itens pedidos', () => {
    const of = (g: string) => NAV.filter((n) => n.group === g).map((n) => n.label)
    expect(of('hoje')).toEqual(['Hoje'])
    expect(of('estudar')).toEqual(['Visão geral', 'Explorador de estudos', 'Trilhas', 'Cronômetro', 'Questões'])
    expect(of('planejar')).toEqual(['Cronograma', 'Ciclo de estudos', 'Calendário', 'Metas'])
    expect(of('fixar')).toEqual(['Revisões', 'Flashcards', 'Mapas mentais', 'Caderno de erros'])
    expect(of('analisar')).toEqual(['Relatórios'])
    expect(of('evoquest')).toEqual(['Continuar aventura', 'Mundo', 'Minha Cidade', 'Diário', 'Treino'])
  })

  it('subpáginas mantêm a categoria e o item (Explorador em qualquer profundidade)', () => {
    for (const p of ['/materias', '/materias/abc', '/materias/abc/topico/xyz', '/materias/pasta/p1']) {
      expect(groupForPath(p)).toBe('estudar')
      expect(isNavActive(item('Explorador de estudos'), p)).toBe(true)
    }
  })

  it('Questões e Caderno de erros não ficam ativos ao mesmo tempo', () => {
    expect(isNavActive(item('Questões'), '/questoes')).toBe(true)
    expect(isNavActive(item('Caderno de erros'), '/questoes')).toBe(false)
    expect(isNavActive(item('Caderno de erros'), '/questoes/caderno')).toBe(true)
    expect(isNavActive(item('Questões'), '/questoes/caderno')).toBe(false)
    expect(groupForPath('/questoes/caderno')).toBe('fixar')
  })

  it('itens do EvoQuest distinguem os parâmetros; rotas internas caem na categoria EvoQuest', () => {
    expect(isNavActive(item('Continuar aventura'), '/evoquest')).toBe(true)
    expect(isNavActive(item('Continuar aventura'), '/evoquest', '?painel=mapa')).toBe(false)
    expect(isNavActive(item('Mundo'), '/evoquest', '?painel=mapa')).toBe(true)
    expect(isNavActive(item('Treino'), '/evoquest/treino')).toBe(true)
    expect(isNavActive(item('Continuar aventura'), '/evoquest/treino')).toBe(false)
    expect(groupForPath('/evoquest/jogar')).toBe('evoquest')
    expect(groupForPath('/evoquest/sql/licao/u1')).toBe('evoquest')
  })

  it('Visão geral só na raiz; Hoje é a própria categoria fixa', () => {
    expect(isNavActive(item('Visão geral'), '/')).toBe(true)
    expect(isNavActive(item('Visão geral'), '/metas')).toBe(false)
    expect(groupForPath('/espaco')).toBe('hoje')
    expect(groupForPath('/configuracoes')).toBe('conta')
    expect(groupForPath('/rota-inexistente')).toBeNull()
  })

  it('título do cabeçalho', () => {
    expect(titleFor('/materias/x/topico/y')).toBe('Explorador de estudos')
    expect(titleFor('/questoes/caderno')).toBe('Caderno de erros')
    expect(titleFor('/evoquest/treino')).toBe('Treino')
  })
})

function Nav({ to }: { to: string }) {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(to)}>
      ir {to}
    </button>
  )
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <SidebarNav collapsed={false} />
              <Nav to="/materias/abc/topico/1" />
              <Nav to="/cronograma" />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

const header = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })

describe('barra lateral em accordion (componente)', () => {
  beforeEach(() => sessionStorage.clear())

  it('em /espaco: Hoje visível, categorias recolhidas, com aria-expanded/aria-controls', () => {
    renderAt('/espaco')
    expect(screen.getByRole('link', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page')
    for (const g of COLLAPSIBLE_GROUPS) {
      const b = header(g.label)
      expect(b).toHaveAttribute('aria-expanded', 'false')
      const list = document.getElementById(b.getAttribute('aria-controls')!)!
      expect(list).not.toBeVisible()
    }
    expect(screen.queryByRole('link', { name: 'Trilhas' })).toBeNull()
  })

  it('clicar expande e recolhe; só uma categoria aberta por vez', async () => {
    const user = userEvent.setup()
    renderAt('/espaco')
    await user.click(header('Estudar'))
    expect(header('Estudar')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Trilhas' })).toBeVisible()
    await user.click(header('Planejar'))
    expect(header('Planejar')).toHaveAttribute('aria-expanded', 'true')
    expect(header('Estudar')).toHaveAttribute('aria-expanded', 'false')
    await user.click(header('Planejar'))
    expect(header('Planejar')).toHaveAttribute('aria-expanded', 'false')
  })

  it('a rota abre a categoria certa, destaca o item e marca a categoria', () => {
    renderAt('/materias/abc/topico/xyz')
    expect(header('Estudar')).toHaveAttribute('aria-expanded', 'true')
    const list = within(document.getElementById('nav-group-estudar')!)
    expect(list.getByRole('link', { name: 'Explorador de estudos' })).toHaveAttribute('aria-current', 'page')
  })

  it('navegar dentro da mesma categoria não reabre o que o usuário recolheu; mudar de categoria abre a nova', async () => {
    const user = userEvent.setup()
    renderAt('/materias')
    await user.click(header('Estudar')) // recolhe
    expect(header('Estudar')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('contém a página atual')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ir /materias/abc/topico/1' }))
    expect(header('Estudar')).toHaveAttribute('aria-expanded', 'false')
    await user.click(screen.getByRole('button', { name: 'ir /cronograma' }))
    expect(header('Planejar')).toHaveAttribute('aria-expanded', 'true')
  })

  it('teclado: Tab chega ao cabeçalho e Enter/Espaço alternam', async () => {
    const user = userEvent.setup()
    renderAt('/espaco')
    header('Fixar').focus()
    await user.keyboard('{Enter}')
    expect(header('Fixar')).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard(' ')
    expect(header('Fixar')).toHaveAttribute('aria-expanded', 'false')
  })

  it('o estado aberto fica guardado durante a sessão', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAt('/espaco')
    await user.click(header('Analisar'))
    unmount()
    renderAt('/espaco')
    expect(header('Analisar')).toHaveAttribute('aria-expanded', 'true')
  })

  it('recolhida (72 px): só ícones, todos acessíveis pelo nome', () => {
    render(
      <MemoryRouter initialEntries={['/cronograma']}>
        <SidebarNav collapsed />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Cronograma' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link')).toHaveLength(NAV.filter((n) => n.group !== 'conta').length)
  })
})
