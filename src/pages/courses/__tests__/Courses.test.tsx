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

async function seed() {
  const d = new FakeDrive()
  const root = d.folder('Cursos')
  const c = d.folder('Curso SQL', root)
  const m = d.folder('Modulo 1', c)
  d.file('Aula 1.mp4', m, 'video/mp4', fid('v1'))
  d.file('Aula 2.pdf', m, 'application/pdf', fid('p2'))
  d.file('Exercicios.zip', m, 'application/zip', fid('z3'))
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
const iframeSrc = () => document.querySelector('iframe')?.getAttribute('src') ?? ''

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

  it('catálogo mostra o curso com tipos, progresso e busca por aula', async () => {
    await seed()
    renderAt('/cursos')
    expect(await screen.findByRole('link', { name: 'Curso SQL' })).toBeInTheDocument()
    expect(screen.getByText('Vídeos: 1')).toBeInTheDocument()
    expect(screen.getByText('0 de 3 concluído(s)')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar curso ou aula' }), { target: { value: 'aula 2' } })
    expect(await screen.findByText('Aulas e materiais encontrados')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar curso ou aula' }), { target: { value: 'nada disso' } })
    expect(await screen.findByText('Nada encontrado com esses filtros.')).toBeInTheDocument()
  })

  it('abre a aula no visualizador do Drive, conclui, desmarca e navega; progresso e última aula persistem ao recarregar', async () => {
    const course = await seed()
    const first = renderAt(`/cursos/${course.id}`)
    await waitFor(() => expect(iframeSrc()).toBe(`https://drive.google.com/file/d/${fid('v1')}/preview`))
    expect(screen.getByText('Temporizador (video)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir no Drive/ })).toHaveAttribute('href', `https://drive.google.com/file/d/${fid('v1')}/view`)

    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(await screen.findByRole('button', { name: 'Desmarcar conclusão' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Desmarcar conclusão' }))
    expect(await screen.findByRole('button', { name: 'Concluir' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    await screen.findByRole('button', { name: 'Desmarcar conclusão' })

    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await waitFor(() => expect(iframeSrc()).toBe(`https://drive.google.com/file/d/${fid('p2')}/preview`))
    expect(screen.getByText('Temporizador (reading)')).toBeInTheDocument()
    await waitFor(async () => expect((await fetchAll(backend, 'course_progress')).find((p) => p.drive_id === fid('p2'))?.last_opened_at).toBeTruthy())
    first.unmount()

    // "recarregar": nova árvore e novo cache, mesmos dados no navegador
    renderAt(`/cursos/${course.id}`)
    await waitFor(() => expect(iframeSrc()).toContain(fid('p2')))
    const panel = within(screen.getByRole('complementary', { name: 'Conteúdo do curso' }))
    expect(panel.getByText('1 de 3 concluídos')).toBeInTheDocument()
    cleanup()
    renderAt('/cursos')
    expect(await screen.findByText('Continuar estudando')).toBeInTheDocument()
    for (const l of screen.getAllByRole('link', { name: 'Continuar' })) expect(l).toHaveAttribute('href', expect.stringContaining('item='))
  })

  it('formato sem visualizador fica no catálogo com "Abrir no Drive" e sem iframe', async () => {
    const course = await seed()
    const zip = (await fetchAll(backend, 'course_nodes')).find((x) => x.drive_id === fid('z3'))!
    renderAt(`/cursos/${course.id}?item=${zip.id}`)
    expect(await screen.findByText('Sem visualização dentro da plataforma')).toBeInTheDocument()
    expect(document.querySelector('iframe')).toBeNull()
    expect(screen.getAllByRole('link', { name: /Abrir no Drive/ }).length).toBeGreaterThan(0)
  })

  it('item não encontrado no Drive é sinalizado e mantém a alternativa', async () => {
    const course = await seed()
    const v1 = (await fetchAll(backend, 'course_nodes')).find((x) => x.drive_id === fid('v1'))!
    await backend.update('course_nodes', [{ column: 'id', op: 'eq', value: v1.id }], { status: 'missing', missing_since: new Date().toISOString() })
    renderAt(`/cursos/${course.id}?item=${v1.id}`)
    expect(await screen.findByText(/Não foi encontrado no Drive na última atualização/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Abrir no Drive/ }).length).toBeGreaterThan(0)
  })

  it('renomear e ocultar na organização é gravado sem mexer no nome do Drive', async () => {
    const course = await seed()
    renderAt(`/cursos/${course.id}`)
    await waitFor(() => expect(iframeSrc()).toContain(fid('v1')))
    fireEvent.click(screen.getAllByRole('button', { name: /Organizar/ }).find((b) => b.textContent?.trim() === 'Organizar' && !b.closest('aside'))!)
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Nome na plataforma'), { target: { value: 'Boas-vindas' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(async () => expect((await fetchAll(backend, 'course_nodes')).find((x) => x.drive_id === fid('v1'))).toMatchObject({ custom_title: 'Boas-vindas', title: 'Aula 1.mp4' }))
    expect(await screen.findByRole('heading', { name: 'Boas-vindas' })).toBeInTheDocument()
  })
})
