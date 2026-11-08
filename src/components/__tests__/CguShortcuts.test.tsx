import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CguShortcuts } from '../CguShortcuts'
import { CGU_PLAN, type CguTask } from '@/content/cguPlan'
import { resolveLink } from '@/lib/cguPlan'

afterEach(cleanup)

const plan = (open = vi.fn()) => ({ open, resolve: (t: CguTask) => resolveLink(t.link, { views: [], nodes: [] }) })

describe('Ir direto: teoria e questões do dia', () => {
  it('separa a teoria das questões, cada tarefa com o botão que abre o material', () => {
    const open = vi.fn()
    render(<CguShortcuts plan={plan(open)} tasks={CGU_PLAN[0].tasks} />)
    const teoria = screen.getByRole('region', { name: 'Teoria' })
    const questoes = screen.getByRole('region', { name: 'Questões' })
    const teoriaTasks = CGU_PLAN[0].tasks.filter((t) => t.link.kind === 'drive')
    const qcTasks = CGU_PLAN[0].tasks.filter((t) => t.link.kind === 'qc')
    expect(within(teoria).getAllByRole('button')).toHaveLength(teoriaTasks.length)
    expect(within(questoes).getAllByRole('button')).toHaveLength(qcTasks.length)
    expect(within(teoria).queryByRole('list', { name: 'Filtros do QConcursos' })).not.toBeInTheDocument()
    // questões trazem os links diretos do QConcursos (banca Cebraspe)
    const chips = within(questoes).getAllByRole('link')
    expect(chips.length).toBeGreaterThan(0)
    for (const a of chips) expect(a.getAttribute('href')).toContain('qconcursos.com')

    fireEvent.click(within(questoes).getAllByRole('button')[0])
    expect(open).toHaveBeenCalledWith(qcTasks[0])
    fireEvent.click(within(teoria).getAllByRole('button')[0])
    expect(open).toHaveBeenLastCalledWith(teoriaTasks[0])
  })

  it('não mostra um grupo sem tarefas e some quando não há nada pendente', () => {
    const onlyQc = CGU_PLAN[0].tasks.filter((t) => t.link.kind === 'qc')
    const { container, rerender } = render(<CguShortcuts plan={plan()} tasks={onlyQc} />)
    expect(screen.queryByRole('region', { name: 'Teoria' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Questões' })).toBeInTheDocument()
    rerender(<CguShortcuts plan={plan()} tasks={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
