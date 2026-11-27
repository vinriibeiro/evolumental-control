import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookText, Check, ExternalLink, FilePlus2, Loader2, Save, X } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Select } from '@/components/ui/Field'
import { Card } from '@/components/ui/layout'
import { Spinner, useToast } from '@/components/ui/feedback'
import {
  useAllActiveNotebookNodes,
  useNotebookNodeMutations,
  useNotebookStudyMutations,
  useNotebooks,
  usePageContent,
} from '@/hooks/useNotebooks'
import { docToPlainText, plainTextToDoc } from '@/lib/notebooks'
import { findLessonNotebookPage } from '@/services/notebookStudies'
import type { NotebookNode } from '@/types/db'

interface CourseNotesPanelProps {
  lessonNodeId: string
  courseTitle: string
  lessonTitle: string
  subjectId?: string | null
  topicId?: string | null
  splitWidth: number
  onChangeSplitWidth: (w: number) => void
  onClose: () => void
}

/**
 * Painel de anotações vinculado à aula atual (modo estudo dividido na Sala de Cursos).
 * Nunca cria cadernos automaticamente: o usuário escolhe um caderno próprio para vincular ou criar uma página.
 */
export function CourseNotesPanel({
  lessonNodeId,
  courseTitle,
  lessonTitle,
  subjectId,
  topicId,
  splitWidth,
  onChangeSplitWidth,
  onClose,
}: CourseNotesPanelProps) {
  const backend = useBackend()
  const toast = useToast()
  const notebooksQuery = useNotebooks()
  const allNodesQuery = useAllActiveNotebookNodes()
  const studyMut = useNotebookStudyMutations()
  const nodeMut = useNotebookNodeMutations()

  const activeNotebooks = useMemo(
    () => (notebooksQuery.data ?? []).filter((n) => !n.deleted_at && !n.archived_at),
    [notebooksQuery.data],
  )

  const linkedQuery = useQuery({
    queryKey: ['data', ['notebook_resource_links', 'notebook_nodes'], 'lesson-note', backend.kind, lessonNodeId],
    queryFn: () => findLessonNotebookPage(backend, lessonNodeId),
  })

  const [selectedNotebookId, setSelectedNotebookId] = useState('')
  const [selectedPage, setSelectedPage] = useState<NotebookNode | null>(null)

  useEffect(() => {
    setSelectedPage(linkedQuery.data?.page ?? null)
  }, [linkedQuery.data, lessonNodeId])

  useEffect(() => {
    if (!selectedNotebookId && activeNotebooks.length > 0) setSelectedNotebookId(activeNotebooks[0].id)
  }, [activeNotebooks, selectedNotebookId])

  const pagesInChosenNotebook = useMemo(
    () => (allNodesQuery.data ?? []).filter((n) => n.notebook_id === selectedNotebookId && n.node_type === 'page' && !n.deleted_at),
    [allNodesQuery.data, selectedNotebookId],
  )

  const handleCreateLessonPage = async () => {
    if (!selectedNotebookId) return
    try {
      const res = await studyMut.createLessonPage.mutateAsync({
        notebookId: selectedNotebookId,
        lessonNodeId,
        courseTitle,
        lessonTitle,
        subjectId,
        topicId,
      })
      setSelectedPage(res.page)
      toast.success('Página da aula criada no seu caderno.')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <BookText className="size-4 shrink-0 text-accent" aria-hidden />
          <span className="truncate text-xs font-semibold text-ink">Anotações da aula</span>
        </div>
        <div className="flex items-center gap-1">
          <label className="hidden items-center gap-1 text-[10px] text-muted lg:inline-flex" title="Ajustar largura do painel de anotações">
            Largura
            <input
              type="range"
              min={30}
              max={60}
              step={5}
              value={splitWidth}
              onChange={(e) => onChangeSplitWidth(Number(e.target.value))}
              aria-label="Largura do painel de anotações"
              className="w-16 accent-[var(--accent)]"
            />
          </label>
          {selectedPage && (
            <Link
              to={`/cadernos/${selectedPage.notebook_id}/pagina/${selectedPage.id}`}
              title="Abrir página completa em Meus Cadernos"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
            >
              <ExternalLink className="size-3.5" />
            </Link>
          )}
          <IconButton label="Fechar painel de anotações" size="sm" className="size-7" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5">
        {linkedQuery.isPending ? (
          <Spinner label="Verificando anotações…" />
        ) : !selectedPage ? (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-muted">
              Vincule esta aula a uma página de um dos seus cadernos para anotar lado a lado enquanto assiste.
            </p>
            {activeNotebooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-muted">
                <p>Você ainda não tem cadernos criados.</p>
                <Link to="/cadernos" className="mt-2 inline-block font-medium text-accent underline">
                  Criar meu primeiro caderno em Meus Cadernos
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label="Seu caderno">
                  {(id) => (
                    <Select id={id} value={selectedNotebookId} onChange={(e) => setSelectedNotebookId(e.target.value)}>
                      {activeNotebooks.map((nb) => (
                        <option key={nb.id} value={nb.id}>
                          {nb.title}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Button
                  size="sm"
                  variant="primary"
                  className="w-full"
                  icon={<FilePlus2 className="size-3.5" />}
                  loading={studyMut.createLessonPage.isPending}
                  onClick={() => void handleCreateLessonPage()}
                >
                  Criar página para esta aula neste caderno
                </Button>

                {pagesInChosenNotebook.length > 0 && (
                  <Field label="Ou abrir página existente deste caderno">
                    {(id) => (
                      <Select
                        id={id}
                        value=""
                        onChange={(e) => {
                          const found = pagesInChosenNotebook.find((p) => p.id === e.target.value)
                          if (found) setSelectedPage(found)
                        }}
                      >
                        <option value="">Escolher página existente…</option>
                        {pagesInChosenNotebook.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                )}
              </div>
            )}
          </div>
        ) : (
          <CompactLessonEditor
            key={selectedPage.id}
            page={selectedPage}
            onChangePage={() => setSelectedPage(null)}
            saveContent={nodeMut.saveContent}
          />
        )}
      </div>
    </Card>
  )
}

function CompactLessonEditor({
  page,
  onChangePage,
  saveContent,
}: {
  page: NotebookNode
  onChangePage: () => void
  saveContent: ReturnType<typeof useNotebookNodeMutations>['saveContent']
}) {
  const contentQuery = usePageContent(page.id)
  const toast = useToast()
  const [text, setText] = useState('')
  const [rev, setRev] = useState(1)
  const [dirty, setDirty] = useState(false)
  const [status, setStatus] = useState<'saved' | 'dirty' | 'saving'>('saved')
  const loadedRef = useRef<string | null>(null)

  useEffect(() => {
    if (!contentQuery.data || loadedRef.current === page.id) return
    loadedRef.current = page.id
    setText(docToPlainText(contentQuery.data.content_json))
    setRev(contentQuery.data.revision)
    setDirty(false)
    setStatus('saved')
  }, [contentQuery.data, page.id])

  const persist = async () => {
    setStatus('saving')
    try {
      const saved = await saveContent.mutateAsync({
        nodeId: page.id,
        expectedRevision: rev,
        contentJson: plainTextToDoc(text),
      })
      setRev(saved.revision)
      setDirty(false)
      setStatus('saved')
    } catch (e) {
      setStatus('dirty')
      toast.error(e)
    }
  }

  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => {
      void persist()
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, text])

  if (contentQuery.isPending) return <Spinner label="Carregando página…" />

  return (
    <div className="flex h-full flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <p className="truncate font-semibold text-ink">{page.title}</p>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted">
          {status === 'saving' && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Salvando…
            </span>
          )}
          {status === 'saved' && (
            <span className="inline-flex items-center gap-1">
              <Check className="size-3" /> Salvo
            </span>
          )}
          {status === 'dirty' && (
            <button type="button" onClick={() => void persist()} className="inline-flex items-center gap-1 font-medium text-ink hover:text-accent">
              <Save className="size-3" /> Salvar
            </button>
          )}
          <button type="button" onClick={onChangePage} className="underline hover:text-ink">
            Trocar
          </button>
        </div>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setDirty(true)
          setStatus('dirty')
        }}
        aria-label={`Anotações de ${page.title}`}
        placeholder="Anote aqui durante a aula… Salvo automaticamente na sua página do caderno."
        className="min-h-[340px] flex-1 resize-y rounded-xl border border-line bg-bg p-3 text-sm leading-relaxed text-ink outline-none focus:border-ink"
      />
    </div>
  )
}
