import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { CGU_PLAN } from '@/content/cguPlan'
import { EMPTY_STATE, lessonPath, type CguState } from '@/lib/cguPlan'

const mocks = vi.hoisted(() => ({ plan: null as unknown }))
vi.mock('@/hooks/useCguPlan', () => ({ useCguPlan: () => mocks.plan }))

import CguLessonPage from '../CguLessonPage'

afterEach(cleanup)

const day3 = CGU_PLAN[2].tasks.filter((t) => t.link.kind === 'drive')

function fakePlan(done: CguState['done'] = {}) {
  const plan = { state: { ...EMPTY_STATE, done }, catalog: { views: [], nodes: [] }, start: vi.fn(), complete: vi.fn(), reopen: vi.fn() }
  mocks.plan = plan
  return plan
}

function Where() {
  const l = useLocation()
  return <p data-testid="onde">{l.pathname}</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/cgu/aula/:taskId"
          element={
            <>
              <CguLessonPage />
              <Where />
            </>
          }
        />
        <Route path="/cgu" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Aula do plano CGU dentro do app', () => {
  it('toca o vídeo no visualizador incorporado e mostra a sequência 03 → 07 com a aula atual marcada', () => {
    const plan = fakePlan()
    renderAt(lessonPath(day3[0].id))
    const frame = screen.getByTitle(/Vídeo.*SQL conceitos gerais \(03\)/i) as HTMLIFrameElement
    expect(frame.src).toBe('https://drive.google.com/file/d/12ayrTMJPdzB9H_i_kEFaK4KSauZVY_7_/preview')
    const seq = screen.getByRole('list', { name: 'Sequência de aulas' })
    const items = within(seq).getAllByRole('link')
    expect(items.map((a) => a.textContent)).toEqual([
      expect.stringContaining('SQL conceitos gerais (03)'),
      expect.stringContaining('DCL (04)'),
      expect.stringContaining('TCL e DTL (05)'),
      expect.stringContaining('DDL (06)'),
      expect.stringContaining('DML e DQL (07)'),
    ])
    expect(items[0]).toHaveAttribute('aria-current', 'page')
    expect(items[1]).toHaveAttribute('href', lessonPath(day3[1].id))
    expect(screen.getByText(/Aula 1 de 5 da sequência/)).toBeInTheDocument()
    expect(plan.start).toHaveBeenCalledWith(day3[0])
  })

  it('Concluir e avançar marca a aula e vai para a próxima da sequência, não para a 07', async () => {
    const plan = fakePlan()
    renderAt(lessonPath(day3[0].id))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir e avançar' }))
    expect(plan.complete).toHaveBeenCalledWith(day3[0])
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent(lessonPath(day3[1].id)))
  })

  it('na última aula, conclui e volta ao plano; na primeira, "Anterior" fica desabilitado', async () => {
    const plan = fakePlan()
    renderAt(lessonPath(day3[4].id))
    expect(screen.getByRole('link', { name: /Anterior/ })).toHaveAttribute('href', lessonPath(day3[3].id))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir última aula' }))
    expect(plan.complete).toHaveBeenCalledWith(day3[4])
    await waitFor(() => expect(screen.getByTestId('onde')).toHaveTextContent('/cgu'))
    cleanup()
    fakePlan()
    renderAt(lessonPath(day3[0].id))
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled()
  })

  it('aula já concluída mostra o estado e permite desmarcar', () => {
    const plan = fakePlan({ [day3[1].id]: '2026-11-09T10:00:00Z' })
    renderAt(lessonPath(day3[1].id))
    expect(screen.getByText('Concluída no plano')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar conclusão' }))
    expect(plan.reopen).toHaveBeenCalledWith(day3[1])
    expect(screen.getByRole('button', { name: 'Próxima aula' })).toBeInTheDocument()
  })

  it('id que não existe no plano avisa e oferece voltar', () => {
    fakePlan()
    renderAt('/cgu/aula/nao-existe')
    expect(screen.getByText('Aula não encontrada')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao plano' })).toHaveAttribute('href', '/cgu')
  })
})
