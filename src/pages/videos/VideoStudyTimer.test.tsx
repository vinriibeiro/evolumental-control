import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { LocalBackend } from '@/lib/data/local'
import { getLiveSession, nextPhase, startSession } from '@/services/sessions'
import { ToastProvider } from '@/components/ui/feedback'
import { TimerAlerts } from '@/features/timer/TimerAlerts'
import { VideoStudyTimer } from './VideoStudyTimer'
import { playChime } from '@/lib/timer/sound'

let backend: LocalBackend
vi.mock('@/app/data', () => ({ useBackend: () => backend }))
vi.mock('@/hooks/useNow', () => ({ useNow: () => Date.now() }))
vi.mock('@/lib/timer/sound', () => ({ unlockAudio: vi.fn(), playChime: vi.fn() }))

const T0 = Date.parse('2026-11-01T21:00:00Z')
let subjectId: string
let topicId: string
let client: QueryClient

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  vi.clearAllMocks()
  sessionStorage.clear()
  backend = new LocalBackend(`video-timer-${crypto.randomUUID()}`)
  const [subject] = await backend.insert('subjects', [{ name: 'Python' }])
  const [topic] = await backend.insert('topics', [{ name: 'Introdução', subject_id: subject.id }])
  subjectId = subject.id
  topicId = topic.id
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.useRealTimers()
})

function room() {
  return <QueryClientProvider client={client}><ToastProvider><MemoryRouter initialEntries={['/videos']}><VideoStudyTimer subjectId={subjectId} topicId={topicId} /><TimerAlerts /></MemoryRouter></ToastProvider></QueryClientProvider>
}
const timer = () => within(screen.getByRole('region', { name: 'Temporizador de estudo' }))

describe('sessão de foco junto à aula (backend local real)', () => {
  it('valida duração e inicia videoaula vinculada ao tópico, sem sessões duplicadas', async () => {
    render(room())
    const input = await screen.findByLabelText('Duração do estudo em minutos')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar foco' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe entre 1 e 1440')
    expect(await getLiveSession(backend)).toBeNull()
    fireEvent.change(input, { target: { value: '25,5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar foco' }))
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar foco' }))
    await screen.findByRole('button', { name: 'Pausar foco' })
    const live = await getLiveSession(backend)
    expect(live).toMatchObject({ subject_id: subjectId, topic_id: topicId, activity_type: 'video', mode: 'countdown', planned_seconds: 1530 })
    expect(await backend.count('study_sessions', [])).toBe(1)
  })

  it('pausa, continua e finaliza para revisão, preservando o tempo líquido', async () => {
    const view = render(room())
    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar foco' }))
    await screen.findByRole('button', { name: 'Pausar foco' })
    vi.setSystemTime(T0 + 120000)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar foco' }))
    await screen.findByRole('button', { name: 'Continuar foco' })
    vi.setSystemTime(T0 + 600000)
    view.rerender(room())
    expect(screen.getByText('00:48:00')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar foco' }))
    await screen.findByRole('button', { name: 'Pausar foco' })
    vi.setSystemTime(T0 + 660000)
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar foco' }))
    expect(await screen.findByRole('link', { name: 'Revisar e salvar sessão' })).toHaveAttribute('href', '/cronometro')
    expect((await getLiveSession(backend))?.status).toBe('pending_review')
  })

  it('avisa antes do fim e ao terminar uma única vez, inclusive ao remontar a tela', async () => {
    await startSession(backend, { subject_id: subjectId, topic_id: topicId, activity_type: 'video', mode: 'countdown', planned_minutes: 5 })
    const view = render(room())
    await screen.findByRole('button', { name: 'Pausar foco' })
    expect(playChime).not.toHaveBeenCalled()
    vi.setSystemTime(T0 + 240000)
    view.rerender(room())
    expect(timer().getByRole('status')).toHaveTextContent('Seu tempo está acabando')
    expect(playChime).toHaveBeenCalledExactlyOnceWith('warning')
    vi.setSystemTime(T0 + 250000)
    view.rerender(room())
    expect(playChime).toHaveBeenCalledTimes(1)
    vi.setSystemTime(T0 + 300000)
    view.rerender(room())
    expect(timer().getByRole('alert')).toHaveTextContent('Tempo de foco concluído')
    expect(playChime).toHaveBeenLastCalledWith('focus-end')
    view.unmount()
    render(room())
    await screen.findByRole('button', { name: 'Continuar estudando' })
    expect(playChime).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar estudando' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('reutiliza sessão existente e volta do intervalo do Pomodoro sem criar outra', async () => {
    const s = await startSession(backend, { subject_id: subjectId, topic_id: topicId, activity_type: 'theory', mode: 'pomodoro', pomodoro: { focus: 1, shortBreak: 1, longBreak: 1, rounds: 2 } })
    vi.setSystemTime(T0 + 60000)
    await nextPhase(backend, { ...s, pauses: [] })
    vi.setSystemTime(T0 + 120000)
    render(room())
    fireEvent.click(await screen.findByRole('button', { name: 'Voltar ao foco' }))
    await screen.findByRole('button', { name: 'Pausar foco' })
    expect((await getLiveSession(backend))?.timer_state?.phaseIndex).toBe(2)
    expect(await backend.count('study_sessions', [])).toBe(1)
  })

  it('respeita som desativado no aviso antecipado e no final', async () => {
    await backend.updateProfile({ settings: { sound: false } })
    await startSession(backend, { subject_id: subjectId, topic_id: topicId, activity_type: 'video', mode: 'countdown', planned_minutes: 1 })
    vi.setSystemTime(T0 + 49000)
    const view = render(room())
    await timer().findByText(/Seu tempo está acabando/)
    vi.setSystemTime(T0 + 60000)
    view.rerender(room())
    await timer().findByText(/Tempo de foco concluído/)
    expect(playChime).not.toHaveBeenCalled()
  })

  it('não avisa durante uma pausa manual; retoma a contagem de onde parou', async () => {
    await startSession(backend, { subject_id: subjectId, topic_id: topicId, activity_type: 'video', mode: 'countdown', planned_minutes: 1 })
    const view = render(room())
    await screen.findByRole('button', { name: 'Pausar foco' })
    vi.setSystemTime(T0 + 10000)
    fireEvent.click(screen.getByRole('button', { name: 'Pausar foco' }))
    await screen.findByRole('button', { name: 'Continuar foco' })
    vi.setSystemTime(T0 + 120000)
    view.rerender(room())
    expect(timer().getByText('00:00:50')).toBeTruthy()
    expect(playChime).not.toHaveBeenCalled()
  })

  it('mantém aviso global acessível quando a página de vídeos está vazia', async () => {
    await startSession(backend, { subject_id: null, topic_id: null, activity_type: 'theory', mode: 'countdown', planned_minutes: 1 })
    vi.setSystemTime(T0 + 60000)
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/videos']}><TimerAlerts /></MemoryRouter></QueryClientProvider>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Tempo de foco concluído!')
  })
})
