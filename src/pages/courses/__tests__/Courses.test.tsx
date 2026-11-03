import 'fake-indexeddb/auto'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ConfirmProvider, ToastProvider } from '@/components/ui/feedback'
import { LocalBackend } from '@/lib/data/local'
import { crawlFolder } from '@/lib/driveCrawl'
import { addSource, applySync, sourceConfig } from '@/services/courses'
import { fetchAll } from '@/hooks/data'
import { FakeDrive, fid, noSleep } from '@/test/fakeDrive'

let backend: LocalBackend
let n = 0
vi.mock('@/app/data', () => ({ useBackend: () => backend }))
vi.mock('@/pages/videos/VideoStudyTimer', () => ({ VideoStudyTimer: (p: { activity: string }) => <div>Temporizador ({p.activity})</div> }))

import CoursesPage from '../CoursesPage'
import CoursePage from '../CoursePage'

/** Curso SQL: "Modulo 1" (vídeo + apostila + zip = 1 aula com materiais), "Modulo 2" (1 vídeo) e um PDF solto. */
async function seed() {
  const d = new FakeDrive()
  const root = d.folder('Cursos')
  const c = d.folder('Curso SQL', root)
  const m1 = d.folder('Modulo 1', c)
  d.file('Aula 1.mp4', m1, 'video/mp4', fid('v1'), { durationMillis: '600000' })
  d.file('Apostila.pdf', m1, 'application/pdf', fid('p1'))
  d.file('Exercicios.zip', m1, 'application/zip', fid('z1'))
  const m2 = d.folder('Modulo 2', c)
  d.file('Aula 2.mp4', m2, 'video/mp4', fid('v2'), { durationMillis: '300000' })
  d.file('Resumo final.pdf', c, 'application/pdf', fid('r1'))
  const source = await addSource(backend, root, 'Cursos')
  await applySync(backend, source, await crawlFolder(d, root, { sleep: noSleep }), sourceConfig(source))
  return (await fetchAll(backend, 'course_nodes')).find((x) => x.kind === 'course')!
}

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <ConfirmProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/cursos" element={<CoursesPage />} />
              <Route path="/cursos/:id" element={<CoursePage />} />
            </Routes>
          </MemoryRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>,
  )
const srcs = () => [...document.querySelectorAll('iframe')].map((f) => f.getAttribute('src') ?? '')
const preview = (id: string) => `https://drive.google.com/file/d/${id}/preview`
const lessonArea = () => within(screen.getByRole('region', { name: 'Aula' }))
const outline = () => within(screen.getByRole('complementary', { name: 'Conteúdo do curso' }))
const progressOf = async (driveId: string) => (await fetchAll(backend, 'course_progress')).find((p) => p.drive_id === driveId)

beforeEach(() => {
  backend = new LocalBackend(`courses-ui-${++n}`)
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('Cursos e materiais', () => {
  it('sem pastas, explica como começar e informa o modo local', async () => {
    renderAt('/cursos')
    expect(await screen.findByText('Nenhuma pasta cadastrada')).toBeInTheDocument()
    expect(screen.getByText(/ficam só neste navegador/)).toBeInTheDocument()
  })

  it('catálogo conta aulas (pasta com vídeo + materiais = 1 aula), duração e busca', async () => {
    await seed()
    renderAt('/cursos')
    expect(await screen.findByRole('link', { name: 'Curso SQL' })).toBeInTheDocument()
    expect(screen.getByText('3 aula(s) · 15 min de vídeo')).toBeInTheDocument()
    expect(screen.getByText('0 de 3 concluída(s)')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar curso ou aula' }), { target: { value: 'modulo 2' } })
    expect(await screen.findByText('Aulas e materiais encontrados')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar curso ou aula' }), { target: { value: 'nada disso' } })
    expect(await screen.findByText('Nada encontrado com esses filtros.')).toBeInTheDocument()
  })

  it('aula com materiais: videoaula, abas, "Concluir e avançar", desmarcar pelo sumário e persistência ao recarregar', async () => {
    const course = await seed()
    const first = renderAt(`/cursos/${course.id}`)
    await waitFor(() => expect(srcs()).toEqual([preview(fid('v1'))]))
    expect(screen.getByText('Temporizador (video)')).toBeInTheDocument()
    expect(lessonArea().getByRole('heading', { name: 'Modulo 1' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Videoaula' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /Materiais da aula \(2\)/ })).toBeInTheDocument()

    fireEvent.click(lessonArea().getByRole('button', { name: 'Concluir e avançar' }))
    await waitFor(() => expect(srcs()).toEqual([preview(fid('v2'))]))
    expect(lessonArea().getByRole('heading', { name: 'Modulo 2' })).toBeInTheDocument()
    await waitFor(async () => expect((await progressOf(fid('v1')))?.completed_at).toBeTruthy())

    // o check do sumário desmarca sem sair da aula atual
    fireEvent.click(await outline().findByRole('button', { name: 'Desmarcar conclusão de Modulo 1' }))
    await waitFor(async () => expect((await progressOf(fid('v1')))?.completed_at).toBeNull())
    expect(srcs()).toEqual([preview(fid('v2'))])
    fireEvent.click(outline().getByRole('button', { name: 'Concluir Modulo 2' }))
    await outline().findByText('1 de 3 concluídos')

    // material da aula 1 aberto na aba; ao recarregar, volta para ele
    fireEvent.click(outline().getByRole('button', { name: /^Modulo 1/ }))
    await waitFor(() => expect(srcs()).toEqual([preview(fid('v1'))]))
    fireEvent.click(screen.getByRole('tab', { name: 'Apostila.pdf' }))
    await waitFor(() => expect(srcs()).toEqual([preview(fid('p1'))]))
    expect(screen.getByText('Temporizador (reading)')).toBeInTheDocument()
    await waitFor(async () => expect((await progressOf(fid('p1')))?.last_opened_at).toBeTruthy())
    first.unmount()

    renderAt(`/cursos/${course.id}`)
    await waitFor(() => expect(srcs()).toEqual([preview(fid('p1'))]))
    expect(outline().getByText('1 de 3 concluídos')).toBeInTheDocument()
    cleanup()
    renderAt('/cursos')
    expect(await screen.findByText('Continuar estudando')).toBeInTheDocument()
    for (const l of screen.getAllByRole('link', { name: 'Continuar' })) expect(l).toHaveAttribute('href', expect.stringContaining('item='))
  })

  it('material ao lado do vídeo, formato sem visualizador e atalhos de teclado', async () => {
    const course = await seed()
    renderAt(`/cursos/${course.id}`)
    await waitFor(() => expect(srcs()).toEqual([preview(fid('v1'))]))
    fireEvent.click(screen.getByRole('button', { name: 'Ao lado do vídeo' }))
    await waitFor(() => expect(srcs()).toEqual([preview(fid('v1')), preview(fid('p1'))]))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar material ao lado' }))
    await waitFor(() => expect(srcs()).toHaveLength(1))

    fireEvent.click(screen.getByRole('tab', { name: 'Exercicios.zip' }))
    expect(await screen.findByText('Sem visualização dentro da plataforma')).toBeInTheDocument()
    expect(srcs()).toHaveLength(0)

    fireEvent.keyDown(document, { key: 'n' })
    await waitFor(() => expect(srcs()).toEqual([preview(fid('v2'))]))
    fireEvent.keyDown(document, { key: 'c' })
    await waitFor(async () => expect((await progressOf(fid('v2')))?.completed_at).toBeTruthy())
    fireEvent.keyDown(document, { key: 'p' })
    await waitFor(() => expect(srcs()).toEqual([preview(fid('v1'))]))
    fireEvent.keyDown(document, { key: 'm' })
    expect(document.querySelector('[data-theater="true"]')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('[data-theater="true"]')).toBeNull()
  })

  it('item não encontrado no Drive é sinalizado e mantém a alternativa', async () => {
    const course = await seed()
    const v1 = (await fetchAll(backend, 'course_nodes')).find((x) => x.drive_id === fid('v1'))!
    await backend.update('course_nodes', [{ column: 'id', op: 'eq', value: v1.id }], { status: 'missing', missing_since: new Date().toISOString() })
    renderAt(`/cursos/${course.id}?item=${v1.id}`)
    expect(await screen.findByText(/Não foi encontrado no Drive na última atualização/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Abrir no Drive/ }).length).toBeGreaterThan(0)
  })

  it('renomear a aula na organização é gravado sem mexer no nome do Drive', async () => {
    const course = await seed()
    renderAt(`/cursos/${course.id}`)
    await waitFor(() => expect(srcs()).toEqual([preview(fid('v1'))]))
    fireEvent.click(lessonArea().getByRole('button', { name: 'Organizar' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Nome na plataforma'), { target: { value: 'Boas-vindas' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(async () => expect((await fetchAll(backend, 'course_nodes')).find((x) => x.drive_id === fid('Modulo 1'))).toMatchObject({ custom_title: 'Boas-vindas', title: 'Modulo 1' }))
    expect(await lessonArea().findByRole('heading', { name: 'Boas-vindas' })).toBeInTheDocument()
  })
})
