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
const joins = [mk('sql-0001'), mk('sql-0002', { nivel: 'extremo', tipo: 'certo_errado', alternativas: undefined, gabarito: 'E' }), mk('sql-0003')]
const index: BankIndex = { total: 3, temas: [{ tema: 'SQL', prefixo: 'sql', total: 3, subtemas: [{ nome: 'JOINs', arquivo: 'joins.json', total: 3 }] }] }

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (String(url).endsWith('index.json') ? index : joins) })),
  )
  window.scrollTo = vi.fn()
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
const bring = async () => fireEvent.click(await screen.findByRole('button', { name: /Trazer (novas )?questões/ }))

describe('banco de questões', () => {
  it('só monta a lista quando o usuário clica em "Trazer questões"', async () => {
    renderPage()
    expect(await screen.findByText('Monte a sua lista')).toBeTruthy()
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]))).toEqual([expect.stringContaining('index.json')])
    await bring()
    expect(await screen.findByText('3 questão(ões)')).toBeTruthy()
    expect(document.querySelector('pre code')?.textContent).toBe('SELECT 1;')
  })

  it('corrige e comenta a resposta, e não deixa responder de novo', async () => {
    renderPage()
    await bring()
    await screen.findByText('3 questão(ões)')
    fireEvent.click(screen.getByRole('button', { name: 'Alternativa B' }))
    expect(await screen.findByText(/Você errou\. A resposta é A\./)).toBeTruthy()
    expect(screen.getByText('Explicação sql-0001')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Alternativa A' }) as HTMLButtonElement).disabled).toBe(true)
    expect(JSON.parse(localStorage.getItem('vlm.questoes.local')!)['sql-0001']).toEqual([1, 0, 0, 0])
  })

  it('os filtros só valem depois de trazer de novo; salva a sessão em Desempenho', async () => {
    renderPage()
    await bring()
    await screen.findByText('3 questão(ões)')
    fireEvent.click(screen.getByRole('button', { name: 'Extremo' }))
    expect(screen.getByText('3 questão(ões)')).toBeTruthy() // ainda não aplicou
    await bring()
    expect(await screen.findByText('1 questão(ões)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Alternativa E' }))
    expect(await screen.findByText('Você acertou!')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /Salvar em Desempenho/ })[0])
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ total: 1, correct: 1, wrong: 0, source: 'Banco de questões', subject_id: null }))
  })

  it('a quantidade limita a lista', async () => {
    renderPage()
    fireEvent.change(await screen.findByRole('combobox', { name: 'Quantidade' }), { target: { value: '10' } })
    await bring()
    await screen.findByText('3 questão(ões)')
    fireEvent.change(screen.getByRole('combobox', { name: 'Quantidade' }), { target: { value: '0' } })
    await bring()
    expect(await screen.findByText('3 questão(ões)')).toBeTruthy()
  })

  it('mostra uma questão por vez e navega com os botões e as setas do teclado', async () => {
    renderPage()
    await bring()
    await screen.findByText('3 questão(ões)')
    expect(screen.getByText('Questão 1 de 3')).toBeTruthy()
    expect(screen.getByText('sql-0001')).toBeTruthy()
    expect(screen.queryByText('sql-0002')).toBeNull()
    expect((screen.getByRole('button', { name: /Anterior/ }) as HTMLButtonElement).disabled).toBe(true)
    // sem responder, o botão se chama "Pular"; depois de responder, "Próxima"
    fireEvent.click(screen.getByRole('button', { name: /Pular/ }))
    expect(screen.getByText('Questão 2 de 3')).toBeTruthy()
    expect(screen.getByText('sql-0002')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('Questão 1 de 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Alternativa A' }))
    expect(await screen.findByText('Você acertou!')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Próxima/ })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('Questão 3 de 3')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Pular/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Alternativa A' }))
    expect(await screen.findByText(/Fim da lista: 2 de 2 certas/)).toBeTruthy()
  })

  it('favorita e filtra as favoritas', async () => {
    renderPage()
    await bring()
    await screen.findByText('3 questão(ões)')
    fireEvent.click(screen.getByRole('button', { name: /Pular/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Favoritar' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Situação' }), { target: { value: 'favoritas' } })
    await bring()
    expect(await screen.findByText('1 questão(ões)')).toBeTruthy()
    expect(screen.getAllByText(/sql-0002/).length).toBeGreaterThan(0)
    expect(screen.queryByText('sql-0001')).toBeNull()
  })
})
