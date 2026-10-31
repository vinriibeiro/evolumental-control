import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '@/components/ui/feedback'

const mutateAsync = vi.fn().mockResolvedValue(undefined)
const backend = {
  list: vi.fn(),
  update: vi.fn().mockResolvedValue([]),
}
vi.mock('@/hooks/data', () => ({ useUpdate: () => ({ mutateAsync, isPending: false }), invalidateTables: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/app/data', () => ({ useBackend: () => backend }))
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ timezone: 'America/Sao_Paulo' }) }))

import { StudiedButton } from '../StudiedButton'

afterEach(() => {
  cleanup()
  mutateAsync.mockClear()
  backend.list.mockReset()
  backend.update.mockClear()
})

const renderButton = (status: 'not_started' | 'in_progress' | 'completed') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <StudiedButton topic={{ id: 't1', name: 'Lesson 01', status }} />
      </ToastProvider>
    </QueryClientProvider>,
  )

describe('botão "Marcar como estudado"', () => {
  it('conclui o tópico, avança o ciclo e fecha o bloco do cronograma', async () => {
    backend.list.mockImplementation(async (table: string) => {
      if (table === 'study_cycles') return { rows: [{ id: 'c1', name: 'Ciclo', status: 'active', current_index: 0, current_progress_seconds: 600, completed_rounds: 0 }] }
      if (table === 'study_cycle_items') return { rows: [{ id: 'i1', sort_order: 0, topic_id: 't1' }, { id: 'i2', sort_order: 1, topic_id: 't2' }] }
      return { rows: [{ id: 'p1', topic_id: 't1', status: 'pending', date: '2000-01-01' }] }
    })
    renderButton('in_progress')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como estudado' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 't1', patch: { status: 'completed' } }))
    await waitFor(() => expect(backend.update).toHaveBeenCalledTimes(2))
    const tables = backend.update.mock.calls.map((c) => c[0])
    expect(tables).toEqual(['study_cycles', 'study_plan_items'])
    expect(backend.update.mock.calls[0][2]).toEqual({ current_index: 1, current_progress_seconds: 0, completed_rounds: 0 })
    expect(backend.update.mock.calls[1][2]).toEqual({ status: 'done' })
  })

  it('mesmo sem ciclo nem cronograma, só conclui o tópico', async () => {
    backend.list.mockResolvedValue({ rows: [] })
    renderButton('not_started')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como estudado' }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(backend.list).toHaveBeenCalled())
    expect(backend.update).not.toHaveBeenCalled()
  })

  it('desfaz a marcação de um tópico já estudado, sem mexer no ciclo', async () => {
    renderButton('completed')
    const btn = screen.getByRole('button', { name: 'Estudado · desfazer' })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(btn)
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 't1', patch: { status: 'in_progress' } }))
    expect(backend.list).not.toHaveBeenCalled()
  })
})
