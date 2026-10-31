import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/app/auth'
import { ToastProvider } from '@/components/ui/feedback'
import type { BankIndex, BankQuestion } from '@/lib/questionBank'

const mutateAsync = vi.fn().mockResolvedValue(undefined)
vi.mock('@/hooks/data', () => ({ useInsert: () => ({ mutateAsync, isPending: false }) }))
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ timezone: 'America/Sao_Paulo' }) }))

import QuestionBankPage from '../QuestionBankPage'

const mk = (id: string, extra: Partial<BankQuestion> = {}): BankQuestion => ({
  id,
  tema: 'SQL',
  subtema: 'JOINs',
  nivel: 'basico',
  tipo: 'multipla_escolha',
  estilo: 'concurso',
  enunciado: `Enunciado ${id}\n\`\`\`sql\nSELECT 1;\n\`\`\`\nQual a saída?`,
  alternativas: ['(1).', '(2).', '(3).', '(4).'],
  gabarito: 'A',
  explicacao: `Explicação ${id}`,
  ...extra,
})
const joins = [mk('sql-0001'), mk('sql-0002', { nivel: 'extremo', tipo: 'certo_errado', alternativas: undefined, gabarito: 'E' })]
const index: BankIndex = { total: 2, temas: [{ tema: 'SQL', prefixo: 'sql', total: 2, subtemas: [{ nome: 'JOINs', arquivo: 'joins.json', total: 2 }] }] }

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (String(url).endsWith('index.json') ? index : joins) })),
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  mutateAsync.mockClear()
})

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter>
            <QuestionBankPage />
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )

describe('banco de questões', () => {
  it('carrega, mostra o código do enunciado, corrige e comenta a resposta', async () => {
    renderPage()
    expect(await screen.findByText('2 questão(ões)')).toBeTruthy()
    expect(document.querySelector('pre code')?.textContent).toBe('SELECT 1;')
    fireEvent.click(screen.getAllByRole('button', { name: 'Alternativa B' })[0])
    expect(await screen.findByText(/Você errou\. A resposta é A\./)).toBeTruthy()
    expect(screen.getByText('Explicação sql-0001')).toBeTruthy()
    // não deixa responder de novo
    expect((screen.getAllByRole('button', { name: 'Alternativa A' })[0] as HTMLButtonElement).disabled).toBe(true)
    expect(JSON.parse(localStorage.getItem('vlm.questoes.local')!)['sql-0001']).toEqual([1, 0, 0, 0])
  })

  it('filtra por nível e salva a sessão em Desempenho', async () => {
    renderPage()
    await screen.findByText('2 questão(ões)')
    fireEvent.click(screen.getByRole('button', { name: 'Extremo' }))
    expect(await screen.findByText('1 questão(ões)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Alternativa E' }))
    expect(await screen.findByText('Você acertou!')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Salvar em Desempenho/ }))
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ total: 1, correct: 1, wrong: 0, source: 'Banco de questões', subject_id: null }))
  })

  it('favorita e filtra as favoritas', async () => {
    renderPage()
    await screen.findByText('2 questão(ões)')
    fireEvent.click(screen.getAllByRole('button', { name: 'Favoritar' })[1])
    fireEvent.change(screen.getByRole('combobox', { name: 'Situação' }), { target: { value: 'favoritas' } })
    expect(await screen.findByText('1 questão(ões)')).toBeTruthy()
    expect(screen.getAllByText(/sql-0002/).length).toBeGreaterThan(0)
    expect(screen.queryByText('sql-0001')).toBeNull()
  })
})
