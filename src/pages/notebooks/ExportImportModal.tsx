import { useRef, useState } from 'react'
import { Download, FileCode2, FileJson, FileText, FolderArchive, Printer, Upload } from 'lucide-react'
import { useBackend } from '@/app/data'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { invalidateTables } from '@/hooks/data'
import { useNotebooks } from '@/hooks/useNotebooks'
import { eq, inList, isNull } from '@/lib/data/types'
import {
  buildNotebookJsonBundle,
  docToMarkdown,
  docToSanitizedHtml,
  executeNotebookImport,
  exportNotebookAsZipBlob,
  exportPageAsPdfBytes,
  planNotebookImportFromFile,
  slugifyFilename,
  triggerBlobDownload,
  type NotebookImportPlan,
} from '@/lib/notebookPortability'
import type { Notebook, NotebookContentDoc, NotebookNode } from '@/types/db'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  notebook: Notebook
  /** Quando presente, permite exportar a página atual ou o caderno inteiro. */
  page?: NotebookNode | null
  pageDoc?: NotebookContentDoc | null
}

export function NotebookExportModal({ open, onClose, notebook, page, pageDoc }: ExportModalProps) {
  const backend = useBackend()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const loadFullNotebookBundle = async () => {
    const nodes = (await backend.list('notebook_nodes', { filters: [eq('notebook_id', notebook.id), isNull('deleted_at')] })).rows
    const pageIds = nodes.filter((n) => n.node_type === 'page').map((n) => n.id)
    const [contents, tags, tagLinks, pageLinks] = await Promise.all([
      pageIds.length > 0 ? backend.list('notebook_page_contents', { filters: [inList('node_id', pageIds)] }) : Promise.resolve({ rows: [] }),
      backend.list('notebook_tags'),
      backend.list('notebook_tag_links'),
      pageIds.length > 0 ? backend.list('notebook_page_links', { filters: [inList('source_node_id', pageIds)] }) : Promise.resolve({ rows: [] }),
    ])
    const nodeSet = new Set(nodes.map((n) => n.id))
    const filteredTagLinks = tagLinks.rows.filter((tl) => tl.notebook_id === notebook.id || (tl.node_id && nodeSet.has(tl.node_id)))
    const usedTagIds = new Set(filteredTagLinks.map((tl) => tl.tag_id))
    return buildNotebookJsonBundle({
      notebook,
      nodes,
      contents: contents.rows,
      tags: tags.rows.filter((t) => usedTagIds.has(t.id)),
      tag_links: filteredTagLinks,
      page_links: pageLinks.rows,
    })
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
      toast.success('Exportação gerada com sucesso.')
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Exportar conteúdo"
      description={page ? `Página "${page.title}" ou caderno "${notebook.title}"` : `Caderno "${notebook.title}"`}
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      <div className="space-y-4">
        {page && pageDoc && (
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">Página atual ({page.title})</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                variant="secondary"
                icon={<FileText className="size-4" />}
                loading={busy === 'page-md'}
                onClick={() =>
                  void run('page-md', async () => {
                    const md = docToMarkdown(pageDoc, page.title)
                    triggerBlobDownload(new Blob([md], { type: 'text/markdown;charset=utf-8' }), `${slugifyFilename(page.title)}.md`)
                  })
                }
              >
                Markdown
              </Button>
              <Button
                variant="secondary"
                icon={<FileCode2 className="size-4" />}
                loading={busy === 'page-html'}
                onClick={() =>
                  void run('page-html', async () => {
                    const html = docToSanitizedHtml(pageDoc, page.title, `Caderno: ${notebook.title}`)
                    triggerBlobDownload(new Blob([html], { type: 'text/html;charset=utf-8' }), `${slugifyFilename(page.title)}.html`)
                  })
                }
              >
                HTML limpo
              </Button>
              <Button
                variant="primary"
                icon={<Printer className="size-4" />}
                loading={busy === 'page-pdf'}
                onClick={() =>
                  void run('page-pdf', async () => {
                    const bytes = await exportPageAsPdfBytes(page.title, pageDoc, `Caderno: ${notebook.title}`)
                    triggerBlobDownload(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }), `${slugifyFilename(page.title)}.pdf`)
                  })
                }
              >
                PDF A4
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Caderno completo ({notebook.title})</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              icon={<FileJson className="size-4" />}
              loading={busy === 'nb-json'}
              onClick={() =>
                void run('nb-json', async () => {
                  const bundle = await loadFullNotebookBundle()
                  triggerBlobDownload(
                    new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json;charset=utf-8' }),
                    `${slugifyFilename(notebook.title)}.vlm.json`,
                  )
                })
              }
            >
              JSON estruturado
            </Button>
            <Button
              variant="secondary"
              icon={<FolderArchive className="size-4" />}
              loading={busy === 'nb-zip'}
              onClick={() =>
                void run('nb-zip', async () => {
                  const bundle = await loadFullNotebookBundle()
                  const zipBlob = await exportNotebookAsZipBlob(bundle)
                  triggerBlobDownload(zipBlob, `${slugifyFilename(notebook.title)}.zip`)
                })
              }
            >
              Pacote ZIP (MD + JSON)
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            O pacote ZIP preserva a hierarquia de pastas em Markdown e inclui o arquivo <code>notebook.json</code> para reimportação fiel.
          </p>
        </div>
      </div>
    </Modal>
  )
}

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImported: (notebookId: string) => void
}

export function NotebookImportModal({ open, onClose, onImported }: ImportModalProps) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const notebooksQuery = useNotebooks()
  const fileRef = useRef<HTMLInputElement>(null)

  const [plan, setPlan] = useState<NotebookImportPlan | null>(null)
  const [targetNotebookId, setTargetNotebookId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const activeNotebooks = (notebooksQuery.data ?? []).filter((n) => !n.archived_at)

  const handleFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    try {
      const nextPlan = await planNotebookImportFromFile(file)
      setPlan(nextPlan)
      setNewTitle(nextPlan.suggestedNotebookTitle)
      setTargetNotebookId('')
    } catch (e) {
      toast.error(e)
    }
  }

  const confirmImport = async () => {
    if (!plan) return
    setBusy(true)
    try {
      const res = await executeNotebookImport(backend, plan, {
        targetNotebookId: targetNotebookId || null,
        newNotebookTitle: newTitle,
      })
      await invalidateTables(qc, ['notebooks', 'notebook_nodes', 'notebook_page_contents'])
      toast.success(`Importação concluída (${res.createdCount} item(ns)).`)
      setPlan(null)
      onClose()
      onImported(res.notebookId)
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (busy) return
        setPlan(null)
        onClose()
      }}
      size="md"
      title="Importar para Meus Cadernos"
      description="Suporta Markdown (.md), JSON do Meus Cadernos (.json) e pacotes ZIP do Notion ou Obsidian (.zip)."
      footer={
        <>
          <Button
            onClick={() => {
              setPlan(null)
              onClose()
            }}
            disabled={busy}
          >
            Cancelar
          </Button>
          {plan && (
            <Button variant="primary" icon={<Download className="size-4" />} loading={busy} disabled={plan.items.length === 0} onClick={() => void confirmImport()}>
              Confirmar importação
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-line bg-surface-2/60 p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{plan ? plan.sourceLabel : 'Escolha um arquivo para gerar a prévia'}</p>
            <p className="text-xs text-muted">A importação sempre cria cópias novas e nunca sobrescreve seus cadernos existentes.</p>
          </div>
          <Button size="sm" variant="secondary" icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
            Selecionar arquivo
          </Button>
          <input ref={fileRef} type="file" accept=".md,.markdown,.txt,.json,.zip" className="sr-only" onChange={(e) => void handleFile(e.target.files?.[0])} />
        </div>

        {plan && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-line bg-surface px-3 py-2">
                <span className="text-muted">Seções detectadas</span>
                <p className="tabular text-base font-semibold text-ink">{plan.sectionsCount}</p>
              </div>
              <div className="rounded-lg border border-line bg-surface px-3 py-2">
                <span className="text-muted">Páginas detectadas</span>
                <p className="tabular text-base font-semibold text-ink">{plan.pagesCount}</p>
              </div>
            </div>

            {plan.warnings.length > 0 && (
              <ul className="list-disc space-y-1 rounded-lg border border-warning/30 bg-warning/5 py-2 pr-3 pl-6 text-xs text-warning">
                {plan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            <Field label="Destino da importação">
              {(id) => (
                <Select id={id} value={targetNotebookId} onChange={(e) => setTargetNotebookId(e.target.value)}>
                  <option value="">Criar um novo caderno</option>
                  {activeNotebooks.map((nb) => (
                    <option key={nb.id} value={nb.id}>
                      Adicionar em: {nb.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {!targetNotebookId && (
              <Field label="Nome do novo caderno" required>
                {(id) => <Input id={id} value={newTitle} maxLength={200} onChange={(e) => setNewTitle(e.target.value)} />}
              </Field>
            )}

            {plan.items.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted">Prévia da estrutura ({Math.min(12, plan.items.length)} de {plan.items.length}):</p>
                <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-2 text-xs">
                  {plan.items.slice(0, 12).map((it) => (
                    <li key={it.tempId} className="flex items-center justify-between gap-2 text-ink">
                      <span className="truncate">{it.title}</span>
                      <span className="text-[10px] text-muted uppercase">{it.nodeType === 'section' ? 'Seção' : 'Página'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
