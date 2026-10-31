import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/feedback'

const insert = vi.fn().mockResolvedValue([])
const list = vi.fn()
let cycles: unknown[] = []

vi.mock('@/app/data', () => ({ useBackend: () => ({ insert, list }) }))
vi.mock('@/hooks/data', () => ({
  useAll: (table: string) => ({ data: table === 'study_cycles' ? cycles : [] }),
  invalidateTables: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ timezone: 'America/Sao_Paulo' }) }))
vi.mock('@/hooks/domain', () => ({ useSubjects: () => ({ data: [] }) }))
vi.mock('@/pages/schedule/PlanItemForm', () => ({ PlanItemForm: () => null }))

import { TopicScheduling } from '../TopicScheduling'

afterEach(() => {
  cleanup()
  insert.mockClear()
  list.mockReset()
})

const subject = { id: 's1', name: 'Python' } as never
const topic = { id: 't1', name: 'Aula 1', estimated_minutes: 27 } as never

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <MemoryRouter>
          <TopicScheduling subject={subject} topic={topic} />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  )

describe('tópico → ciclo', () => {
  it('coloca o tópico no fim do ciclo ativo, com a duração estimada', async () => {
    cycles = [{ id: 'c1', name: 'Do zero a cientista de dados' }]
    list.mockResolvedValue({ rows: [{ topic_id: 'x' }, { topic_id: 'y' }] })
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: /Colocar no ciclo/ }))
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
    expect(insert).toHaveBeenCalledWith('study_cycle_items', [expect.objectContaining({ cycle_id: 'c1', subject_id: 's1', topic_id: 't1', duration_minutes: 27, sort_order: 2 })])
  })

  it('não repete um tópico que já está no ciclo', async () => {
    cycles = [{ id: 'c1', name: 'Ciclo' }]
    list.mockResolvedValue({ rows: [{ topic_id: 't1' }] })
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: /Colocar no ciclo/ }))
    await waitFor(() => expect(list).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(insert).not.toHaveBeenCalled()
  })
})
