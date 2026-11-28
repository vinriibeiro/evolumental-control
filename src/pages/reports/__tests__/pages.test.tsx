import 'fake-indexeddb/auto'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ConfirmProvider, ToastProvider } from '@/components/ui/feedback'
import { LocalBackend } from '@/lib/data/local'
import { addDays, startOfWeek, todayKey } from '@/lib/time'
import type { ReactElement } from 'react'

const TZ = 'America/Sao_Paulo'
let backend: LocalBackend
let n = 0
vi.mock('@/app/data', () => ({ useBackend: () => backend }))
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ timezone: 'America/Sao_Paulo', hourFormat: '24h', dailyGoalMinutes: 180, weeklyGoalMinutes: 1200 }) }))

import GoalsPage from '@/pages/goals/GoalsPage'
import EvolutionPage from '../EvolutionPage'
import WeeklyReportPage from '../WeeklyReportPage'

const show = (page: ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter>{page}</MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )

const today = todayKey(TZ)
/** Meio-dia (horário de Brasília) do dia informado. */
const at = (day: string, minutes = 0) => new Date(new Date(`${day}T15:00:00Z`).getTime() + minutes * 60000).toISOString()

/** Hoje: 2h planejadas de SQL, 30 min estudados, 12 questões (4 certas) de JOIN; uma atividade antiga em aberto. */
async function seed() {
  const [sql] = await backend.insert('subjects', [{ name: 'SQL' }])
  const [join] = await backend.insert('topics', [{ subject_id: sql.id, name: 'JOIN' }])
  const [plan] = await backend.insert('study_plans', [{ name: 'Plano', start_date: addDays(today, -30), end_date: addDays(today, 30), config: {} as never }])
  await backend.insert('study_plan_items', [{ plan_id: plan.id, date: today, start_time: '09:00', duration_minutes: 120, subject_id: sql.id, topic_id: join.id }])
  await backend.insert('study_sessions', [{ subject_id: sql.id, topic_id: join.id, mode: 'manual', status: 'completed', started_at: at(today), ended_at: at(today, 30) }])
  await backend.insert('question_records', [{ date: today, subject_id: sql.id, topic_id: join.id, total: 12, correct: 4, wrong: 8 }])
  await backend.insert('calendar_tasks', [
    { title: 'Entregar exercício de JOIN', date: addDays(startOfWeek(today), -3), category: 'estudos', priority: 3 },
    { title: 'Ler capítulo 2', date: today, category: 'estudos', done: true, done_at: at(today, 60) },
  ])
  return { sql, join }
}

/** Texto das regiões de aviso (o resumo das metas e, às vezes, um toast). */
const statusText = () => screen.getAllByRole('status').map((e) => e.textContent).join(' | ')

beforeEach(() => {
  backend = new LocalBackend(`evolucao-ui-${++n}`)
})
afterEach(() => cleanup())

describe('Metas', () => {
  it('cria uma meta por entregas com poucos campos e cumpre ao marcar todos os itens', async () => {
    show(<GoalsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Meta por entregas' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByLabelText(/Título/), { target: { value: 'Concluir JOIN e resolver 20 exercícios' } })
    fireEvent.change(dialog.getByLabelText('Entregas'), { target: { value: 'Concluir a aula de JOIN\nResolver 20 exercícios' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Salvar' }))

    const pending = within(await screen.findByRole('region', { name: 'Pendentes (1)' }))
    expect(pending.getByText('Concluir JOIN e resolver 20 exercícios')).toBeInTheDocument()
    let [goal] = (await backend.list('study_goals')).rows
    // O banco exige indicador e alvo > 0 em toda meta: o alvo é o número de itens.
    expect(goal).toMatchObject({ kind: 'deliverable', metric: 'topics_completed', period: 'weekly', target: 2, done_at: null, due_date: addDays(startOfWeek(today), 6) })
    expect(goal.checklist!.map((i) => i.text)).toEqual(['Concluir a aula de JOIN', 'Resolver 20 exercícios'])

    fireEvent.click(pending.getByLabelText('Concluir a aula de JOIN'))
    await waitFor(async () => expect((await backend.list('study_goals')).rows[0].checklist![0].done).toBe(true))
    expect((await backend.list('study_goals')).rows[0].done_at).toBeNull()
    fireEvent.click(await screen.findByLabelText('Resolver 20 exercícios'))

    const achieved = within(await screen.findByRole('region', { name: 'Cumpridas (1)' }))
    expect(achieved.getByText('Cumprida')).toBeInTheDocument()
    ;[goal] = (await backend.list('study_goals')).rows
    expect(goal.done_at).not.toBeNull()
    expect(statusText()).toContain('1 cumprida · 0 pendentes')
  })

  it('separa cumpridas e pendentes; metas por número ignoram as por entregas', async () => {
    await seed()
    await backend.insert('study_goals', [
      { title: 'Sessões da semana', kind: 'metric', metric: 'sessions', period: 'weekly', target: 1, start_date: addDays(today, -40) },
      { title: 'Questões da semana', kind: 'metric', metric: 'questions', period: 'weekly', target: 10, start_date: addDays(today, -40) },
      { title: 'Horas da semana', kind: 'metric', metric: 'study_hours', period: 'weekly', target: 10, start_date: addDays(today, -40) },
      { title: 'Publicar projeto', kind: 'deliverable', metric: 'topics_completed', period: 'weekly', target: 1, start_date: addDays(today, -40), due_date: addDays(today, -1), checklist: [{ id: 'a', text: 'Subir o repositório', done: false }] },
    ])
    show(<GoalsPage />)
    const achieved = within(await screen.findByRole('region', { name: 'Cumpridas (1)' }))
    expect(achieved.getByText('Sessões da semana')).toBeInTheDocument()
    expect(screen.queryByText('Questões da semana')).toBeNull()
    const pending = within(screen.getByRole('region', { name: 'Pendentes (2)' }))
    expect(pending.getByText('Horas da semana')).toBeInTheDocument()
    expect(pending.getByText(/Prazo vencido há 1 dia/)).toBeInTheDocument()
    // A meta por entregas não ganha histórico de períodos nem valor de indicador.
    expect(pending.getByText('Publicar projeto').closest('.evl-card')!.querySelector('ol')).toBeNull()
    expect(statusText()).toContain('1 cumprida · 2 pendentes · 1 com prazo vencido')
  })
})

describe('Evolução', () => {
  it('sem registros, diz que os dados são insuficientes em vez de mostrar números', async () => {
    show(<EvolutionPage />)
    expect(await screen.findByText('Sem horas planejadas no período')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma meta vigente no período')).toBeInTheDocument()
    expect(screen.queryByText('Diagnósticos')).toBeNull()
  })

  it('mostra horas, comparação e metas com dados legados no banco', async () => {
    await seed()
    await backend.insert('study_goals', [{ title: 'Questões do mês', kind: 'metric', metric: 'questions', period: 'monthly', target: 10, start_date: addDays(today, -40) }])
    await backend.insert('assessments', [{ track: 'sql', taken_at: at(today), total: 10, correct: 6 }])
    show(<EvolutionPage />)
    expect(await screen.findByText('25% do planejado · 2h')).toBeInTheDocument()
    const table = within(screen.getByRole('table', { name: 'Indicadores do período atual e do período anterior' }))
    expect(within(table.getByRole('row', { name: /Horas estudadas/ })).getByText('30min')).toBeInTheDocument()
    expect(table.queryByRole('row', { name: /Taxa de acerto|Exercícios e questões/ })).toBeNull()
    expect(screen.getByText('Nenhuma meta vigente no período')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Histórico de diagnósticos' })).toBeNull()
    expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Resumo (CSV)' })).toBeEnabled()
  })
})

describe('Relatório semanal', () => {
  it('responde às cinco perguntas, separando Dado de Sugestão por regra', async () => {
    await seed()
    show(<WeeklyReportPage />)
    const headings = (await screen.findAllByRole('heading', { level: 2 })).map((h) => h.textContent)
    expect(headings.slice(0, 5)).toEqual(['1.O que eu planejei?', '2.O que realmente executei?', '3.Onde avancei?', '4.Onde fiquei para trás?', '5.O que devo priorizar na próxima semana?'])
    expect(screen.getByText(/semana atual/)).toBeInTheDocument()
    expect(screen.getByText('Planejei 2h 00min de estudo: 2h 00min em 1 bloco do cronograma.')).toBeInTheDocument()
    expect(screen.getByText(/Estudei 30min líquidos em 1 sessão/)).toBeInTheDocument()
    // A atividade antiga em aberto é dado na seção 4 e vira a primeira sugestão, com a regra ao lado.
    expect(screen.getByText(/1 atividade ficou sem concluir \(de semanas anteriores\)/)).toBeInTheDocument()
    expect(screen.getByText(/Comece pela atividade atrasada: Entregar exercício de JOIN/)).toBeInTheDocument()
    expect(screen.getByText(/Regra: atividade com data vencida e não concluída/)).toBeInTheDocument()
    expect(screen.queryByText(/taxa de acerto|12 questões/i)).toBeNull()
    const next = within(screen.getByRole('heading', { name: /O que devo priorizar/ }).closest('.evl-card') as HTMLElement)
    expect(next.getAllByText('Sugestão por regra').length).toBeGreaterThan(1)
    expect(next.queryByText('Dado')).toBeNull()
    const planned = within(screen.getByRole('heading', { name: /O que eu planejei/ }).closest('.evl-card') as HTMLElement)
    expect(planned.getAllByText('Dado').length).toBeGreaterThan(1)
    expect(planned.queryByText('Sugestão por regra')).toBeNull()
  })

  it('semana anterior sem registros: nada inventado e navegação entre semanas', async () => {
    show(<WeeklyReportPage />)
    expect(await screen.findByText(/nada planejado nem registrado até agora/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Semana anterior' }))
    expect(await screen.findByRole('button', { name: 'Semana atual' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeEnabled())
    expect(screen.getByText(/nada planejado nem registrado\./)).toBeInTheDocument()
    expect(screen.getByText('Planeje a semana antes de começar (blocos de estudo ou atividades com duração): sem plano não há como comparar planejado e realizado.')).toBeInTheDocument()
    expect(screen.getByText('Nenhuma sessão de estudo concluída nesta semana.')).toBeInTheDocument()
  })
})
