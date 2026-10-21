import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Archive, ArchiveRestore, Folder, Layers, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Card, PageHeader, Segmented, StatCard } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, QueryState, useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useSafeDelete } from '@/components/useSafeDelete'
import { useAll, useCount, useInsert, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { eq, gte, inList, lte } from '@/lib/data/types'
import { CardForm } from './CardForm'
import type { FlashcardDeck } from '@/types/db'

const ACTIVE = ['new', 'learning', 'review']

export default function DecksPage() {
  const [archived, setArchived] = useState<'active' | 'archived'>('active')
  const [term, setTerm] = useState('')
  const [form, setForm] = useState<{ deck: FlashcardDeck | null } | null>(null)
  const [cardOpen, setCardOpen] = useState(false)
  const decks = useAll('flashcard_decks', { filters: [eq('archived', archived === 'archived')], order: [{ column: 'folder' }, { column: 'name' }] })
  const nowIso = useMemo(() => new Date().toISOString(), [])
  const totalDue = useCount('flashcards', [inList('status', ACTIVE), lte('due_at', nowIso)])
  const totalCards = useCount('flashcards', [])
  const dayAgo = useMemo(() => new Date(Date.now() - 86400000).toISOString(), [])
  const reviewedToday = useCount('flashcard_reviews', [gte('reviewed_at', dayAgo)])
  const navigate = useNavigate()

  const groups = useMemo(() => {
    const t = term.trim().toLowerCase()
    const list = (decks.data ?? []).filter((d) => !t || d.name.toLowerCase().includes(t) || (d.folder ?? '').toLowerCase().includes(t))
    const m = new Map<string, FlashcardDeck[]>()
    for (const d of list) {
      const k = d.folder?.trim() || ''
      m.set(k, [...(m.get(k) ?? []), d])
    }
    return [...m].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0], 'pt-BR')))
  }, [decks.data, term])

  return (
    <div>
      <PageHeader
        title="Flashcards"
        description="Baralhos e cartões ilimitados com repetição espaçada e leitura em voz alta."
        actions={
          <>
            <Button icon={<Plus className="size-4" />} onClick={() => setCardOpen(true)}>
              Cartão rápido
            </Button>
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ deck: null })}>
              Novo baralho
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Para revisar agora" value={totalDue.data ?? '…'} />
        <StatCard label="Cartões" value={totalCards.data ?? '…'} />
        <StatCard label="Respostas nas últimas 24h" value={reviewedToday.data ?? '…'} />
        <Card className="flex flex-col justify-center gap-2 p-4">
          <Button variant="dark" icon={<Play className="size-4" />} disabled={!totalDue.data} onClick={() => navigate('/flashcards/revisar?modo=vencidos')}>
            Revisar vencidos
          </Button>
          <Button size="sm" disabled={!totalCards.data} onClick={() => navigate('/flashcards/revisar?modo=aleatorio')}>
            Revisão aleatória
          </Button>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Pesquisar baralhos ou pastas" aria-label="Pesquisar baralhos" className="pl-9" />
        </div>
        <Segmented label="Mostrar" value={archived} onChange={setArchived} options={[{ value: 'active', label: 'Ativos' }, { value: 'archived', label: 'Arquivados' }]} />
      </div>

      <QueryState query={decks}>
        {groups.length === 0 ? (
          <EmptyState
            icon={<Layers className="size-8" />}
            title={term ? 'Nenhum baralho encontrado' : archived === 'archived' ? 'Nenhum baralho arquivado' : 'Crie seu primeiro baralho'}
            description={!term && archived === 'active' ? 'Organize por matéria, pasta ou tema. Também é possível importar cartões de um CSV.' : undefined}
            action={
              !term && archived === 'active' ? (
                <Button variant="primary" onClick={() => setForm({ deck: null })}>
                  Novo baralho
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-6">
            {groups.map(([folder, list]) => (
              <section key={folder || '_'}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted uppercase">
                  <Folder className="size-3.5" /> {folder || 'Sem pasta'}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((d) => (
                    <DeckCard key={d.id} deck={d} onEdit={() => setForm({ deck: d })} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </QueryState>
      <DeckForm open={Boolean(form)} deck={form?.deck ?? null} onClose={() => setForm(null)} />
      <CardForm open={cardOpen} onClose={() => setCardOpen(false)} />
    </div>
  )
}

function DeckCard({ deck, onEdit }: { deck: FlashcardDeck; onEdit: () => void }) {
  const nowIso = useMemo(() => new Date().toISOString(), [])
  const total = useCount('flashcards', [eq('deck_id', deck.id)])
  const due = useCount('flashcards', [eq('deck_id', deck.id), inList('status', ACTIVE), lte('due_at', nowIso)])
  const update = useUpdate('flashcard_decks')
  const safeDelete = useSafeDelete('flashcard_decks')
  const lookups = useLookups()
  const navigate = useNavigate()
  const toast = useToast()
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <Link to={`/flashcards/${deck.id}`} className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink hover:underline">{deck.name}</p>
          <p className="truncate text-xs text-muted">
            {deck.subject_id ? lookups.subjectName(deck.subject_id) : 'Independente'}
            {deck.topic_id ? ` › ${lookups.topicName(deck.topic_id)}` : ''}
          </p>
        </Link>
        <ActionMenu label={`Ações de ${deck.name}`}>
          {(close) => (
            <>
              <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), onEdit())}>
                Editar
              </MenuItem>
              <MenuItem
                icon={deck.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                onClick={() => {
                  close()
                  update.mutateAsync({ id: deck.id, patch: { archived: !deck.archived } }).then(() => toast.success(deck.archived ? 'Baralho reativado.' : 'Baralho arquivado.'), toast.error)
                }}
              >
                {deck.archived ? 'Reativar' : 'Arquivar'}
              </MenuItem>
              <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => (close(), void safeDelete(deck.id, deck.name, { extra: 'O histórico de respostas dos cartões também será removido.' }))}>
                Excluir
              </MenuItem>
            </>
          )}
        </ActionMenu>
      </div>
      {deck.description && <p className="line-clamp-2 text-xs text-muted">{deck.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-2">
        <p className="tabular text-xs text-muted">
          {total.data ?? '…'} cartões · <span className={due.data ? 'font-semibold text-ink' : ''}>{due.data ?? '…'} para revisar</span>
        </p>
        <Button size="sm" variant={due.data ? 'primary' : 'secondary'} disabled={!total.data} onClick={() => navigate(`/flashcards/revisar?baralho=${deck.id}&modo=${due.data ? 'vencidos' : 'todos'}`)}>
          Estudar
        </Button>
      </div>
    </Card>
  )
}

export function DeckForm({ open, deck, onClose }: { open: boolean; deck: FlashcardDeck | null; onClose: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [folder, setFolder] = useState('')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [error, setError] = useState<string | null>(null)
  const insert = useInsert('flashcard_decks')
  const update = useUpdate('flashcard_decks')
  const toast = useToast()
  const navigate = useNavigate()
  useEffect(() => {
    if (!open) return
    setName(deck?.name ?? '')
    setDescription(deck?.description ?? '')
    setFolder(deck?.folder ?? '')
    setLink({ subjectId: deck?.subject_id ?? null, topicId: deck?.topic_id ?? null })
    setError(null)
  }, [open, deck])
  const save = async () => {
    if (!name.trim()) return setError('Informe o nome do baralho.')
    const data = { name: name.trim().slice(0, 160), description: description.trim() || null, folder: folder.trim().slice(0, 120) || null, subject_id: link.subjectId, topic_id: link.topicId }
    try {
      if (deck) await update.mutateAsync({ id: deck.id, patch: data })
      else {
        const [d] = await insert.mutateAsync(data)
        navigate(`/flashcards/${d.id}`)
      }
      toast.success('Baralho salvo.')
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={deck ? 'Editar baralho' : 'Novo baralho'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={insert.isPending || update.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Nome" required error={error}>
          {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Pasta / categoria (opcional)" hint="Baralhos com a mesma pasta ficam agrupados.">
          {(id, d) => <Input id={id} aria-describedby={d} value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Ex.: Direito" />}
        </Field>
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria (opcional)" />
        <Field label="Descrição">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
