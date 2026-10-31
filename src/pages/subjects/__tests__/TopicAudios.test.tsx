import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/app/auth'
import { ConfirmProvider, ToastProvider } from '@/components/ui/feedback'
import { audioLibraryFor, resetAudioLibrariesForTests } from '@/services/audio'
import { TopicAudios } from '../TopicAudios'

const TOPIC = 'topico-1'
let seed = 0
const mp3 = (name: string) => new File([new Uint8Array(32).fill(++seed)], name, { type: 'audio/mpeg' })

beforeEach(async () => {
  // o jsdom não decodifica áudio: sem isso a leitura de duração esperaria o tempo limite
  vi.stubGlobal('Audio', undefined)
  await resetAudioLibrariesForTests()
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderPlayer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <TopicAudios topicId={TOPIC} />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

/** Adiciona as faixas (ainda sem stub de URL.createObjectURL: assim a leitura de duração é imediata) e prepara o player. */
async function withTracks(names: string[]) {
  const view = renderPlayer()
  await screen.findByText(/Nenhum áudio neste tópico/)
  const input = screen.getByLabelText('Arquivos de áudio para adicionar') as HTMLInputElement
  fireEvent.change(input, { target: { files: names.map(mp3) } })
  await screen.findByRole('button', { name: `Tocar ${trackLabel(names[0])}` })
  const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  URL.createObjectURL = vi.fn(() => 'blob:audio')
  URL.revokeObjectURL = vi.fn()
  const audio = view.container.querySelector('audio') as HTMLAudioElement
  return { audio, play }
}

const trackLabel = (file: string) => {
  const m = /^L\d+_T0*(\d+)_pag0*(\d+)/.exec(file)!
  return `Track ${m[1]} · pág. ${m[2]}`
}

describe('áudios do tópico', () => {
  it('mostra o estado vazio e explica onde os arquivos ficam', async () => {
    renderPlayer()
    expect(await screen.findByText(/Nenhum áudio neste tópico/)).toBeInTheDocument()
    expect(screen.getByText(/só neste aparelho/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar áudios' })).toBeInTheDocument()
  })

  it('adiciona várias faixas de uma vez e as lista em ordem', async () => {
    await withTracks(['L01_T02_pag09.mp3', 'L01_T01_pag07.mp3', 'L01_T10_pag30.mp3'])
    const nomes = screen.getAllByRole('button', { name: /^Tocar Track/ }).map((b) => b.getAttribute('aria-label'))
    expect(nomes).toEqual(['Tocar Track 1 · pág. 7', 'Tocar Track 2 · pág. 9', 'Tocar Track 10 · pág. 30'])
    expect(screen.getByText('· 3 faixas')).toBeInTheDocument()
  })

  it('toca a faixa escolhida e mostra a volta atual', async () => {
    const { audio, play } = await withTracks(['L01_T01_pag07.mp3', 'L01_T02_pag09.mp3'])
    fireEvent.click(screen.getByRole('button', { name: 'Tocar Track 1 · pág. 7' }))
    await waitFor(() => expect(play).toHaveBeenCalled())
    expect(audio.src).toBe('blob:audio')
    expect(await screen.findByText(/Volta 1 de 5 · faixa 1 de 2/)).toBeInTheDocument()
  })

  it('segue a lição por 5 voltas e avisa no fim', async () => {
    const { audio, play } = await withTracks(['L01_T01_pag07.mp3', 'L01_T02_pag09.mp3'])
    fireEvent.change(screen.getByLabelText('Número de repetições'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tocar Track 1 · pág. 7' }))
    await screen.findByText(/Volta 1 de 2 · faixa 1 de 2/)

    fireEvent.ended(audio)
    await screen.findByText(/Volta 1 de 2 · faixa 2 de 2/)
    fireEvent.ended(audio)
    await screen.findByText(/Volta 2 de 2 · faixa 1 de 2/)
    fireEvent.ended(audio)
    await screen.findByText(/Volta 2 de 2 · faixa 2 de 2/)
    const chamadas = play.mock.calls.length
    fireEvent.ended(audio)
    expect(await screen.findByText('Pronto: 2 voltas da lição.')).toBeInTheDocument()
    expect(play.mock.calls.length).toBe(chamadas) // não toca mais nada
  })

  it('no modo "cada faixa" repete a mesma faixa antes de ir para a próxima', async () => {
    const { audio } = await withTracks(['L01_T01_pag07.mp3', 'L01_T02_pag09.mp3'])
    fireEvent.change(screen.getByLabelText('Modo de repetição'), { target: { value: 'faixa' } })
    fireEvent.change(screen.getByLabelText('Número de repetições'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tocar Track 1 · pág. 7' }))
    await screen.findByText(/Repetição 1 de 3 · faixa 1 de 2/)
    fireEvent.ended(audio)
    await screen.findByText(/Repetição 2 de 3 · faixa 1 de 2/)
    fireEvent.ended(audio)
    await screen.findByText(/Repetição 3 de 3 · faixa 1 de 2/)
    fireEvent.ended(audio)
    await screen.findByText(/Repetição 1 de 3 · faixa 2 de 2/)
  })

  it('guarda a velocidade e as repetições escolhidas para a próxima vez', async () => {
    await withTracks(['L01_T01_pag07.mp3'])
    fireEvent.change(screen.getByLabelText('Velocidade'), { target: { value: '0.75' } })
    fireEvent.change(screen.getByLabelText('Número de repetições'), { target: { value: '7' } })
    expect(JSON.parse(localStorage.getItem('evolumental.audio')!)).toEqual({ rate: 0.75, mode: 'licao', repeats: 7 })
  })

  it('remove a faixa só depois de confirmar', async () => {
    await withTracks(['L01_T01_pag07.mp3', 'L01_T02_pag09.mp3'])
    fireEvent.click(screen.getByRole('button', { name: 'Remover Track 1 · pág. 7' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(await audioLibraryFor(null).list(TOPIC)).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Remover Track 1 · pág. 7' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    await waitFor(async () => expect(await audioLibraryFor(null).list(TOPIC)).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tocar Track 1 · pág. 7' })).not.toBeInTheDocument())
  })

  it('recusa arquivo que não é áudio sem quebrar a lista', async () => {
    renderPlayer()
    await screen.findByText(/Nenhum áudio neste tópico/)
    const input = screen.getByLabelText('Arquivos de áudio para adicionar') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'livro.epub', { type: 'application/epub+zip' })] } })
    expect(await screen.findByText(/não parece ser um arquivo de áudio/)).toBeInTheDocument()
    expect(await audioLibraryFor(null).list(TOPIC)).toEqual([])
  })
})
