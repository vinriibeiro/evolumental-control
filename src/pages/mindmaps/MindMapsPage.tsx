import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, Folder, Network, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Card, PageHeader } from '@/components/ui/layout'
import { ActionMenu, MenuItem } from '@/components/ui/Menu'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, QueryState, useToast } from '@/components/ui/feedback'
import { SubjectTopicSelect } from '@/components/SubjectTopicSelect'
import { useSafeDelete } from '@/components/useSafeDelete'
import { useAll, useTransaction, useUpdate } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useSettings } from '@/hooks/useSettings'
import { createMindMap, duplicateMindMap } from '@/services/mindmaps'
import { dayKey, formatDayKey } from '@/lib/time'
import type { MindMap } from '@/types/db'

export default function MindMapsPage() {
  // A listagem não precisa do conteúdo, mas o modo genérico traz a linha inteira;
  // os mapas são carregados por completo apenas no editor.
  const maps = useAll('mind_maps', { order: [{ column: 'updated_at', ascending: false }] })
  const [term, setTerm] = useState('')
  // ?novo=mapa (paleta de comandos) abre o formulário de novo mapa.
  const [form, setForm] = useState<{ map: MindMap | null } | null>(() => (new URLSearchParams(window.location.search).get('novo') === 'mapa' ? { map: null } : null))
  const lookups = useLookups()
  const settings = useSettings()
  const navigate = useNavigate()
  const toast = useToast()
  const safeDelete = useSafeDelete('mind_maps')
  const dup = useTransaction(['mind_maps'], (b, m: MindMap) => duplicateMindMap(b, m))

  const groups = useMemo(() => {
    const t = term.trim().toLowerCase()
    const list = (maps.data ?? []).filter(
      (m) => !t || m.title.toLowerCase().includes(t) || (m.folder ?? '').toLowerCase().includes(t) || m.data.nodes.some((n) => String(n.data?.label ?? '').toLowerCase().includes(t)),
    )
    const g = new Map<string, MindMap[]>()
    for (const m of list) g.set(m.folder?.trim() || '', [...(g.get(m.folder?.trim() || '') ?? []), m])
    return [...g].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0], 'pt-BR')))
  }, [maps.data, term])

  return (
    <div>
      <PageHeader
        title="Mapas mentais"
        description="Crie mapas editáveis e vincule-os às matérias e tópicos."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setForm({ map: null })}>
            Novo mapa
          </Button>
        }
      />
      <div className="relative mb-4 max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Pesquisar mapas e conteúdo dos nós" aria-label="Pesquisar mapas" className="pl-9" />
      </div>
      <QueryState query={maps}>
        {groups.length === 0 ? (
          <EmptyState
            icon={<Network className="size-8" />}
            title={term ? 'Nenhum mapa encontrado' : 'Nenhum mapa mental ainda'}
            action={
              !term ? (
                <Button variant="primary" onClick={() => setForm({ map: null })}>
                  Criar mapa
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
                  {list.map((m) => (
                    <Card key={m.id} className="flex items-start gap-2 p-4">
                      <Link to={`/mapas/${m.id}`} className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink hover:underline">{m.title}</p>
                        <p className="truncate text-xs text-muted">
                          {m.subject_id ? lookups.subjectName(m.subject_id) : 'Sem matéria'}
                          {m.topic_id ? ` › ${lookups.topicName(m.topic_id)}` : ''}
                        </p>
                        <p className="mt-2 text-xs text-muted">
                          {m.data.nodes.length} nós · atualizado em {formatDayKey(dayKey(new Date(m.updated_at).getTime(), settings.timezone))}
                        </p>
                      </Link>
                      <ActionMenu label={`Ações de ${m.title}`}>
                        {(close) => (
                          <>
                            <MenuItem icon={<Pencil className="size-4" />} onClick={() => (close(), setForm({ map: m }))}>
                              Renomear / organizar
                            </MenuItem>
                            <MenuItem
                              icon={<Copy className="size-4" />}
                              onClick={() => {
                                close()
                                dup.mutateAsync(m).then(() => toast.success('Mapa duplicado.'), toast.error)
                              }}
                            >
                              Duplicar
                            </MenuItem>
                            <MenuItem icon={<Trash2 className="size-4" />} danger onClick={() => (close(), void safeDelete(m.id, m.title))}>
                              Excluir
                            </MenuItem>
                          </>
                        )}
                      </ActionMenu>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </QueryState>
      <MapForm open={Boolean(form)} map={form?.map ?? null} onClose={() => setForm(null)} onCreated={(m) => navigate(`/mapas/${m.id}`)} />
    </div>
  )
}

export function MapForm({ open, map, onClose, onCreated }: { open: boolean; map: MindMap | null; onClose: () => void; onCreated?: (m: MindMap) => void }) {
  const [title, setTitle] = useState('')
  const [folder, setFolder] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState<{ subjectId: string | null; topicId: string | null }>({ subjectId: null, topicId: null })
  const [error, setError] = useState<string | null>(null)
  const update = useUpdate('mind_maps')
  const create = useTransaction(['mind_maps'], (b, input: Parameters<typeof createMindMap>[1]) => createMindMap(b, input))
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    setTitle(map?.title ?? '')
    setFolder(map?.folder ?? '')
    setDescription(map?.description ?? '')
    setLink({ subjectId: map?.subject_id ?? null, topicId: map?.topic_id ?? null })
    setError(null)
  }, [open, map])
  const save = async () => {
    if (!title.trim()) return setError('Informe o título.')
    const data = { title: title.trim().slice(0, 200), folder: folder.trim().slice(0, 120) || null, description: description.trim() || null, subject_id: link.subjectId, topic_id: link.topicId }
    try {
      if (map) {
        // Mantém o rótulo do nó central sincronizado com o título, se ainda forem iguais.
        await update.mutateAsync({ id: map.id, patch: data })
        toast.success('Mapa atualizado.')
      } else onCreated?.(await create.mutateAsync(data))
      onClose()
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={map ? 'Organizar mapa' : 'Novo mapa mental'}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={save} loading={update.isPending || create.isPending}>
            {map ? 'Salvar' : 'Criar e abrir'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Título / tema central" required error={error}>
          {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Pasta (opcional)">{(id) => <Input id={id} value={folder} onChange={(e) => setFolder(e.target.value)} />}</Field>
        <SubjectTopicSelect subjectId={link.subjectId} topicId={link.topicId} onChange={setLink} subjectLabel="Matéria (opcional)" />
        <Field label="Descrição">{(id) => <Textarea id={id} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
      </div>
    </Modal>
  )
}
