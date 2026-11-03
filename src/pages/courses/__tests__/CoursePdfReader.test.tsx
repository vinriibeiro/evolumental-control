import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { CourseNode } from '@/types/db'

const mocks = vi.hoisted(() => ({
  token: null as string | null,
  clientId: null as string | null,
  items: [] as CourseNode[],
  request: vi.fn<(...args: string[]) => Promise<string>>(),
  save: vi.fn(),
  store: vi.fn(),
}))

vi.mock('@/hooks/useCourses', () => ({ useCourses: () => ({
  views: [{ course: { id: 'course-one' }, title: 'Curso de SQL', items: mocks.items }],
  isPending: false,
  isError: false,
}) }))
vi.mock('@/hooks/useLibrary', () => ({ useLibrary: () => ({ dbName: 'account-one' }) }))
vi.mock('@/lib/googleAuth', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/googleAuth')>(),
  currentDriveReadToken: () => mocks.token,
  getClientId: () => mocks.clientId,
  requestDriveReadToken: mocks.request,
  saveClientId: mocks.save,
}))
vi.mock('@/services/drivePdf', () => ({ DrivePdfStore: class {
  constructor(...args: unknown[]) { mocks.store(...args) }
} }))
vi.mock('@/pages/library/PdfReaderPage', () => ({ PdfReader: (props: { documentId: string; backTo: string; backLabel: string }) => <div data-testid="pdf-reader">{props.documentId} {props.backTo} {props.backLabel}</div> }))

import CoursePdfReaderPage from '../CoursePdfReaderPage'

const clientId = '123456789012-abcdefgh12345678.apps.googleusercontent.com'
const pdf = () => ({ id: 'pdf-one', kind: 'item', title: 'Apostila SQL.pdf', custom_title: null, drive_id: 'drive_pdf_reference_123456789', mime_type: 'application/pdf', resource_key: null, status: 'available' } as CourseNode)
const renderAt = (path = '/cursos/course-one/pdf/pdf-one') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/cursos/:id/pdf/:itemId" element={<CoursePdfReaderPage />} /></Routes></MemoryRouter>)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.token = null
  mocks.clientId = null
  mocks.items = [pdf()]
  mocks.request.mockResolvedValue('read-token-from-user-click')
})
afterEach(cleanup)

describe('PDF dos cursos — autorização e referência', () => {
  it('exibe o material real e explica o escopo sem abrir autorização automaticamente', () => {
    renderAt()
    expect(screen.getByRole('heading', { name: 'Apostila SQL.pdf' })).toBeInTheDocument()
    expect(screen.getByText(/acesso de leitura aos arquivos da sua conta/)).toBeInTheDocument()
    expect(screen.getByLabelText('ID público do cliente OAuth do Google')).toBeInTheDocument()
    expect(mocks.request).not.toHaveBeenCalled()
    expect(mocks.store).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Usar visualizador padrão' })).toHaveAttribute('href', '/cursos/course-one?item=pdf-one')
  })

  it('solicita acesso só após o clique e abre o mesmo PDF sem importá-lo na estante', async () => {
    renderAt()
    fireEvent.change(screen.getByLabelText('ID público do cliente OAuth do Google'), { target: { value: clientId } })
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar leitura do PDF' }))
    expect(await screen.findByTestId('pdf-reader')).toHaveTextContent('drive_pdf_reference_123456789')
    expect(mocks.request).toHaveBeenCalledWith(clientId)
    expect(mocks.store).toHaveBeenCalledWith('account-one', mocks.items[0], 'read-token-from-user-click')
    expect(screen.getByTestId('pdf-reader')).toHaveTextContent('/cursos/course-one?item=pdf-one')
  })

  it('reutiliza apenas o token válido fornecido pelo cache em memória', () => {
    mocks.token = 'valid-memory-token'
    renderAt()
    expect(screen.getByTestId('pdf-reader')).toBeInTheDocument()
    expect(mocks.request).not.toHaveBeenCalled()
    expect(mocks.store).toHaveBeenCalledWith('account-one', mocks.items[0], 'valid-memory-token')
  })

  it('recusa item que não pertence ao curso solicitado', () => {
    renderAt('/cursos/another-course/pdf/pdf-one')
    expect(screen.getByRole('heading', { name: 'PDF não encontrado neste curso' })).toBeInTheDocument()
    expect(mocks.store).not.toHaveBeenCalled()
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('recusa PDF ausente e não oferece autorização para um item indisponível', () => {
    mocks.items[0].status = 'missing'
    renderAt()
    expect(screen.getByRole('heading', { name: 'PDF indisponível no Drive' })).toBeInTheDocument()
    expect(mocks.store).not.toHaveBeenCalled()
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('mantém o consentimento visível quando a pessoa fecha a autorização', async () => {
    mocks.clientId = clientId
    mocks.request.mockRejectedValue(new Error('Autorização cancelada pela pessoa.'))
    renderAt()
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar leitura do PDF' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Autorização cancelada pela pessoa.')
    expect(screen.queryByTestId('pdf-reader')).not.toBeInTheDocument()
  })
})
