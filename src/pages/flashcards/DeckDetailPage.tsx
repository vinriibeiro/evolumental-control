import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Copy, Download, Pause, Pencil, Play, Plus, Search, Shuffle, Trash2, Upload } from 'lucide-react'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { Badge, Card, LoadMore, PageHeader } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, QueryState, Spinner, useConfirm, useToast } from '@/components/ui/feedback'
import { fetchAll, invalidateTables, useList, useRemove, useRow, useUpdate } from '@/hooks/data'
import { useDebounced } from '@/hooks/useDebounced'
import { useSettings } from '@/hooks/useSettings'
import { eq, type Filter } from '@/lib/data/types'
import { CARD_STATUS_LABELS } from '@/lib/labels'
import { MASTERY_LABELS, masteryLevel } from '@/lib/srs'
import { downloadText, slugDate } from '@/lib/download'
import { cardsToCsv, parseCardsCsv, type CsvCardRow } from '@/services/flashcards'
import type { CardStatus, Flashcard } from '@/types/db'
import { CardForm } from './CardForm'
import { DeckForm } from './DecksPage'

const PAGE = 30

export default function DeckDetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const deck = useRow('flashcard_decks', id)
  const [term, setTerm] = useState('')
  const [status, setStatus] = useState<'all' | CardStatus>('all')
  const [tag, setTag] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cardForm, setCardForm] = useState<{ card: Flashcard | null } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [editDeck, setEditDeck] = useState(false)
  const debounced = useDebounced(term, 250)
  const settings = useSettings()
  const navigate = useNavigate()
  const backend = useBackend()
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const update = useUpdate('flashcards')
  const remove = useRemove('flashcards')

  const filters: Filter[] = [eq('deck_id', id), ...(status !== 'all' ? [eq('status', status)] : []), ...(tag.trim() ? [{ column: 'tags', op: 'contains' as const, value: [tag.trim()] }] : [])]
  const cards = useList('flashcards', { filters, search: debounced.trim() ? { columns: ['front', 'back', 'note'], term: debounced } : undefined, order: [{ column: 'created_at', ascending: false }], limit, count: true }, { keepPrevious: true })

  // Abre direto um cartão vindo da pesquisa global.
  const openCardId = params.get('cartao')
  const openCard = useRow('flashcards', openCardId)
  const opened = useRef(false)
  useEffect(() => {
    if (openCard.data && !opened.current) {
      opened.current = true
      setCardForm({ card: openCard.data })
    }
  }, [openCard.data])

  useEffect(() => setLimit(PAGE), [debounced, status, tag])

  if (deck.isPending) return <Spinner />
  if (deck.isError) return <ErrorState error={deck.error} onRetry={() => deck.refetch()} />
  if (!deck.data) return <EmptyState title="Baralho não encontrado" action={<Link to="/flashcards" className="text-sm underline">Voltar</Link>} />
  const d = deck.data
  const rows = cards.data?.rows ?? []
  const toggle = (cid: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(cid)) n.delete(cid)
      else n.add(cid)
      return n
    })

  const exportCsv = async () => {
    try {
      const all = await fetchAll(backend, 'flashcards', { filters: [eq('deck_id', id)], order: [{ column: 'created_at' }] })
      downloadText(cardsToCsv(all), `flashcards-${d.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${slugDate()}.csv`, 'text/csv')
    } catch (e) {
      toast.error(e)
    }
  }

  const duplicate = async (c: Flashcard) => {
    try {
      await backend.insert('flashcards', [{ deck_id: c.deck_id, subject_id: c.subject_id, topic_id: c.topic_id, front: c.front, back: c.back, note: c.note, tags: c.tags, due_at: new Date().toISOString() }])
      toast.success('Cartão duplicado.')
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, ['flashcards'])
    }
  }

  return (
    <div>
      <Link to="/flashcards" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Baralhos
      </Link>
      <PageHeader
        title={d.name}
        description={d.description ?? undefined}
        actions={
          <>
            <Button icon={<Pencil className="size-4" />} onClick={() => setEditDeck(true)}>
              Editar
            </Button>
            <Button icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>
              Importar CSV
            </Button>
            <Button icon={<Download className="size-4" />} onClick={exportCsv} disabled={!cards.data?.count}>
              Exportar
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCardForm({ card: null })}>
              Cartão
            </Button>
          </>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <span className="text-sm text-muted">Estudar:</span>
        <Button size="sm" variant="primary" icon={<Play className="size-3.5" />} onClick={() => navigate(`/flashcards/revisar?baralho=${id}&modo=vencidos`)}>
          Vencidos
        </Button>
        <Button size="sm" onClick={() => navigate(`/flashcards/revisar?baralho=${id}&modo=todos`)}>
          Todos
        </Button>
        <Button size="sm" icon={<Shuffle className="size-3.5" />} onClick={() => navigate(`/flashcards/revisar?baralho=${id}&modo=aleatorio`)}>
          Aleatório
        </Button>
        <Button size="sm" onClick={() => navigate(`/flashcards/revisar?baralho=${id}&modo=continuo`)}>
          Modo contínuo (áudio)
        </Button>
        <Button size="sm" disabled={selected.size === 0} onClick={() => navigate(`/flashcards/revisar?modo=selecionados&ids=${[...selected].join(',')}`)}>
          Selecionados ({selected.size})
        </Button>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Pesquisar frente, verso ou nota" aria-label="Pesquisar cartões" className="pl-9" />
        </div>
        <Select aria-label="Filtrar status" className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Todos os status</option>
          {Object.entries(CARD_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Input aria-label="Filtrar por tag" className="w-36" placeholder="Tag exata" value={tag} onChange={(e) => setTag(e.target.value)} />
        <span className="text-xs text-muted">{cards.data?.count ?? 0} cartão(ões)</span>
      </div>

      <QueryState query={cards}>
        {rows.length === 0 ? (
          <EmptyState
            title={debounced || status !== 'all' || tag ? 'Nenhum cartão corresponde aos filtros' : 'Baralho vazio'}
            description={!debounced ? 'Crie cartões manualmente (Ctrl+Enter para salvar e continuar) ou importe um CSV.' : undefined}
            action={
              !debounced ? (
                <Button variant="primary" onClick={() => setCardForm({ card: null })}>
                  Criar cartão
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                  <input type="checkbox" className="mt-1 size-4 accent-[var(--accent-strong)]" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label="Selecionar cartão" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => setCardForm({ card: c })}>
                    <p className="line-clamp-2 text-sm font-medium break-words text-ink">{c.front}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm break-words text-muted">{c.back}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge>{CARD_STATUS_LABELS[c.status]}</Badge>
                      <Badge>{MASTERY_LABELS[masteryLevel(c)]}</Badge>
                      <Badge>
                        Próxima: {new Date(c.due_at).toLocaleDateString('pt-BR', { timeZone: settings.timezone })}
                      </Badge>
                      {c.tags.slice(0, 4).map((t) => (
                        <Badge key={t}>#{t}</Badge>
                      ))}
                    </div>
                  </button>
                  <ActionMenu label="Ações do cartão">
                    {(close) => (
                      <>
                        <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), setCardForm({ card: c }))}>
                          Editar
                        </MenuItem>
                        <MenuItem icon={<Copy className="size-4" />} onClick={() => (close(), void duplicate(c))}>
                          Duplicar
                        </MenuItem>
                        <MenuItem
                          icon={c.status === 'suspended' ? <Play className="size-4" /> : <Pause className="size-4" />}
                          onClick={() => {
                            close()
                            update.mutate({ id: c.id, patch: { status: c.status === 'suspended' ? (c.repetitions > 0 ? 'review' : 'new') : 'suspended' } })
                          }}
                        >
                          {c.status === 'suspended' ? 'Reativar' : 'Suspender'}
                        </MenuItem>
                        <MenuItem
                          icon={<Trash2 className="size-4" />}
                          danger
                          onClick={async () => {
                            close()
                            if (await confirm({ title: 'Excluir cartão?', message: 'O histórico de respostas deste cartão também será removido.', danger: true, confirmLabel: 'Excluir' }))
                              remove.mutateAsync(c.id).catch(toast.error)
                          }}
                        >
                          Excluir
                        </MenuItem>
                      </>
                    )}
                  </ActionMenu>
                </li>
              ))}
            </ul>
            <LoadMore hasMore={(cards.data?.count ?? 0) > limit} loading={cards.isFetching} onClick={() => setLimit((l) => l + PAGE)} />
          </Card>
        )}
      </QueryState>

      <CardForm open={Boolean(cardForm)} card={cardForm?.card} onClose={() => setCardForm(null)} defaults={{ deckId: id, subjectId: d.subject_id, topicId: d.topic_id }} />
      <ImportCsvModal open={importOpen} onClose={() => setImportOpen(false)} deckId={id} subjectId={d.subject_id} topicId={d.topic_id} />
      <DeckForm open={editDeck} deck={d} onClose={() => setEditDeck(false)} />
    </div>
  )
}

function ImportCsvModal({ open, onClose, deckId, subjectId, topicId }: { open: boolean; onClose: () => void; deckId: string; subjectId: string | null; topicId: string | null }) {
  const [rows, setRows] = useState<CsvCardRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  useEffect(() => {
    if (open) {
      setRows(null)
      setFileName('')
      setProgress(0)
    }
  }, [open])
  const valid = useMemo(() => (rows ?? []).filter((r) => !r.error), [rows])
  const invalid = (rows ?? []).length - valid.length

  const onFile = async (f: File | undefined) => {
    if (!f) return
    if (f.size > 20 * 1024 * 1024) return toast.error('Arquivo muito grande (máx. 20 MB). Divida em partes.')
    setFileName(f.name)
    setRows(parseCardsCsv(await f.text()))
  }

  const run = async () => {
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const payload = valid.map((r) => ({ deck_id: deckId, subject_id: subjectId, topic_id: topicId, front: r.front, back: r.back, note: r.note, tags: r.tags, due_at: now }))
      for (let i = 0; i < payload.length; i += 500) {
        await backend.insert('flashcards', payload.slice(i, i + 500))
        setProgress(Math.min(payload.length, i + 500))
      }
      toast.success(`${payload.length} cartão(ões) importado(s).`)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['flashcards'])
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Importar cartões de CSV"
      description="Colunas: frente, verso, observacao (opcional), tags (opcional, separadas por |). Aceita vírgula ou ponto e vírgula; o cabeçalho é opcional."
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={run} loading={busy} disabled={valid.length === 0}>
            {busy ? `Importando ${progress}/${valid.length}` : `Importar ${valid.length} cartão(ões)`}
          </Button>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-6 text-center hover:bg-surface">
        <Upload className="size-6 text-muted" />
        <span className="text-sm text-ink">{fileName || 'Escolher arquivo .csv'}</span>
        <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {rows && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-ink">
            <strong>{valid.length}</strong> válido(s){invalid > 0 && <span className="text-danger"> · {invalid} com erro (serão ignorados)</span>}
          </p>
          <div className="scroll-thin max-h-72 overflow-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-muted">
                  <th className="px-2 py-1.5">Linha</th>
                  <th className="px-2 py-1.5">Frente</th>
                  <th className="px-2 py-1.5">Verso</th>
                  <th className="px-2 py-1.5">Tags</th>
                  <th className="px-2 py-1.5">Situação</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.line} className="border-t border-line align-top">
                    <td className="tabular px-2 py-1.5 text-muted">{r.line}</td>
                    <td className="max-w-48 truncate px-2 py-1.5 text-ink">{r.front}</td>
                    <td className="max-w-48 truncate px-2 py-1.5 text-ink">{r.back}</td>
                    <td className="max-w-32 truncate px-2 py-1.5 text-muted">{r.tags.join(', ')}</td>
                    <td className={`px-2 py-1.5 ${r.error ? 'text-danger' : 'text-success'}`}>{r.error ?? 'OK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <p className="mt-1 text-xs text-muted">Prévia das primeiras 200 linhas.</p>}
        </div>
      )}
    </Modal>
  )
}

export { IconButton }
