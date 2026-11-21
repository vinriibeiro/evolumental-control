// Detalhe de um projeto: tudo editável no lugar, salvo a cada alteração. Só o nome é obrigatório.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ExternalLink, Play, Plus, Trash2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useConfirm, useToast } from '@/components/ui/feedback'
import { DS_TOPICS, topicByKey, trackOf } from '@/content/dsTrail'
import { useStartStudy } from '@/features/timer/useStartStudy'
import { invalidateTables } from '@/hooks/data'
import { eq } from '@/lib/data/types'
import { TRACK_LABELS } from '@/lib/labels'
import { formatDuration } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { CheckItem, Patch, Project, ProjectStatus } from '@/types/db'
import { DIFFICULTY, PROJECT_STATUS_LABELS, projectProgress } from './projectModel'

const STATUSES: ProjectStatus[] = ['not_started', 'in_progress', 'in_review', 'done']
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v)

export function ProjectDialog({ project, seconds, onClose }: { project: Project | null; seconds: number; onClose: () => void }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const study = useStartStudy()
  const [p, setP] = useState<Project | null>(project)
  const [repo, setRepo] = useState('')
  const [skill, setSkill] = useState('')
  useEffect(() => {
    setP(project)
    setRepo(project?.repo_url ?? '')
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!project || !p) return null

  // Atualização otimista: a tela responde na hora e a gravação acontece em seguida.
  const save = async (patch: Patch<'projects'>) => {
    setP((cur) => (cur ? ({ ...cur, ...patch } as Project) : cur))
    try {
      await backend.update('projects', [eq('id', project.id)], patch)
    } catch (e) {
      toast.error(e)
      setP(project)
    } finally {
      await invalidateTables(qc, ['projects'])
    }
  }

  const setStatus = async (status: ProjectStatus) => {
    const now = new Date().toISOString()
    if (status === 'done' && !(p.deliverables ?? []).some((d) => d.done)) {
      const ok = await confirm({ title: 'Concluir sem entregável?', message: 'Nenhum entregável foi marcado como pronto. Um projeto concluído normalmente tem pelo menos um resultado real (repositório, notebook, relatório). Concluir mesmo assim?', confirmLabel: 'Concluir mesmo assim' })
      if (!ok) return
    }
    await save({ status, started_at: status !== 'not_started' ? (p.started_at ?? now) : p.started_at, completed_at: status === 'done' ? (p.completed_at ?? now) : null })
  }

  const prog = projectProgress(p)
  const touch = (list: CheckItem[], id: string, patch: Partial<CheckItem>) => list.map((x) => (x.id === id ? { ...x, ...patch } : x))
  // marcar a primeira etapa já tira o projeto de "não iniciado" (não é a criação que conta, é o trabalho)
  const startedPatch = (): Patch<'projects'> => (p.status === 'not_started' ? { status: 'in_progress', started_at: p.started_at ?? new Date().toISOString() } : {})
  const topics = (p.topic_keys ?? []).map((k) => topicByKey(k)).filter(Boolean)
  const materials = topics.flatMap((t) => t!.materials).filter((m, i, all) => all.findIndex((x) => x.url === m.url) === i)

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={p.name}
      description={`${PROJECT_STATUS_LABELS[p.status]} · ${prog.total ? `${prog.done} de ${prog.total} itens` : 'sem etapas'} · ${formatDuration(seconds)} investidos`}
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto"
            icon={<Trash2 className="size-4" />}
            onClick={async () => {
              if (!(await confirm({ title: 'Excluir este projeto?', message: `"${p.name}" será excluído com suas etapas e entregáveis. As sessões de estudo registradas continuam no histórico. Esta ação não pode ser desfeita.`, confirmLabel: 'Excluir projeto', danger: true }))) return
              try {
                await backend.remove('projects', [eq('id', project.id)])
                onClose()
              } catch (e) {
                toast.error(e)
              } finally {
                await invalidateTables(qc, ['projects', 'study_sessions', 'calendar_tasks'])
              }
            }}
          >
            Excluir
          </Button>
          <Button onClick={onClose}>Fechar</Button>
          <Button
            variant="primary"
            icon={<Play className="size-4" />}
            loading={study.pending}
            onClick={() => {
              onClose()
              void study.start({ project_id: p.id, activity_type: 'other', source: { kind: 'project', id: p.id, label: `Projeto: ${p.name}`, href: '/projetos' } })
            }}
          >
            Trabalhar no projeto
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5">
          <Field label="Nome">{(id) => <Input id={id} defaultValue={p.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== p.name && save({ name: e.target.value.trim().slice(0, 200) })} />}</Field>
          <Field label="Objetivo">{(id) => <Textarea id={id} rows={2} defaultValue={p.objective ?? ''} onBlur={(e) => e.target.value.trim() !== (p.objective ?? '') && save({ objective: e.target.value.trim() || null })} placeholder="O que este projeto precisa demonstrar?" />}</Field>
          <Field label="Descrição">{(id) => <Textarea id={id} rows={3} defaultValue={p.description ?? ''} onBlur={(e) => e.target.value.trim() !== (p.description ?? '') && save({ description: e.target.value.trim() || null })} />}</Field>

          <Checklist title="Etapas" items={p.steps ?? []} placeholder="Nova etapa" onChange={(steps, checked) => save({ steps, ...(checked ? startedPatch() : {}) })} touch={touch} />
          <Checklist title="Entregáveis" items={p.deliverables ?? []} placeholder="Novo entregável (ex.: notebook, repositório, relatório)" withUrl onChange={(deliverables, checked) => save({ deliverables, ...(checked ? startedPatch() : {}) })} touch={touch} />

          <Field label="Observações pessoais">{(id) => <Textarea id={id} rows={3} defaultValue={p.notes ?? ''} onBlur={(e) => e.target.value !== (p.notes ?? '') && save({ notes: e.target.value.trim() || null })} />}</Field>
        </div>

        <aside className="space-y-4">
          <Field label="Estado">
            {(id) => (
              <Select id={id} value={p.status} onChange={(e) => void setStatus(e.target.value as ProjectStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dificuldade">
              {(id) => (
                <Select id={id} value={p.difficulty} onChange={(e) => save({ difficulty: Number(e.target.value) })}>
                  {[1, 2, 3].map((d) => (
                    <option key={d} value={d}>
                      {DIFFICULTY[d]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Prazo (opcional)">{(id) => <Input id={id} type="date" value={p.due_date ?? ''} onChange={(e) => save({ due_date: e.target.value || null })} />}</Field>
          </div>
          <Field label="Repositório no GitHub" hint="Só o link. Nenhuma credencial é pedida ou guardada." error={repo && !isUrl(repo) ? 'Informe um endereço começando com https://' : null}>
            {(id, dsc) => (
              <div className="flex gap-1.5">
                <Input id={id} aria-describedby={dsc} value={repo} onChange={(e) => setRepo(e.target.value.trim())} onBlur={() => (repo === '' || isUrl(repo)) && repo !== (p.repo_url ?? '') && save({ repo_url: repo || null })} placeholder="https://github.com/usuario/projeto" />
                {p.repo_url && (
                  <a href={p.repo_url} target="_blank" rel="noreferrer" aria-label="Abrir repositório" className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line text-ink hover:bg-surface-2">
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            )}
          </Field>
          <Checkbox label="Publicado (repositório público ou portfólio)" checked={p.published} onChange={(e) => save({ published: e.target.checked })} />

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Competências envolvidas</p>
            <div className="flex flex-wrap gap-1.5">
              {(p.skills ?? []).map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border border-line py-0.5 pr-1 pl-2.5 text-xs text-ink">
                  {s}
                  <button type="button" aria-label={`Remover ${s}`} onClick={() => save({ skills: p.skills.filter((x) => x !== s) })} className="rounded-full p-0.5 text-muted hover:text-ink">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="mt-2 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                const v = skill.trim().slice(0, 60)
                if (v && !(p.skills ?? []).includes(v)) void save({ skills: [...(p.skills ?? []), v] })
                setSkill('')
              }}
            >
              <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Adicionar competência" aria-label="Adicionar competência" className="h-8 text-xs" />
            </form>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Tópicos das trilhas</p>
            <ul className="space-y-1">
              {topics.map((t) => (
                <li key={t!.key} className="flex items-center gap-1 text-xs">
                  <Link to={`/trilhas?pilar=${trackOf(t!.key)?.key}&topico=${t!.key}`} className="min-w-0 flex-1 truncate text-ink underline underline-offset-2">
                    {TRACK_LABELS[trackOf(t!.key)?.key ?? ''] ?? ''} · {t!.title}
                  </Link>
                  <IconButton label={`Desvincular ${t!.title}`} size="sm" onClick={() => save({ topic_keys: p.topic_keys.filter((k) => k !== t!.key) })}>
                    <X className="size-3.5 text-muted" />
                  </IconButton>
                </li>
              ))}
            </ul>
            <Select aria-label="Vincular a um tópico" className="mt-1.5 h-8 text-xs" value="" onChange={(e) => e.target.value && save({ topic_keys: [...new Set([...(p.topic_keys ?? []), e.target.value])] })}>
              <option value="">Vincular a um tópico…</option>
              {DS_TOPICS.filter((t) => !(p.topic_keys ?? []).includes(t.key)).map((t) => (
                <option key={t.key} value={t.key}>
                  {TRACK_LABELS[trackOf(t.key)?.key ?? ''] ?? ''} · {t.title}
                </option>
              ))}
            </Select>
          </div>

          {materials.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Materiais vinculados</p>
              <ul className="space-y-1 text-xs">
                {materials.slice(0, 6).map((m) => (
                  <li key={m.url}>
                    <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink underline underline-offset-2">
                      <span className="truncate">{m.title}</span> <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </Modal>
  )
}

function Checklist({ title, items, placeholder, withUrl, onChange, touch }: { title: string; items: CheckItem[]; placeholder: string; withUrl?: boolean; onChange: (items: CheckItem[], checked: boolean) => void; touch: (list: CheckItem[], id: string, patch: Partial<CheckItem>) => CheckItem[] }) {
  const [text, setText] = useState('')
  const done = items.filter((i) => i.done).length
  return (
    <section>
      <h3 className="mb-2 flex items-center justify-between text-sm font-medium text-ink">
        {title}
        {items.length > 0 && (
          <span className="tabular text-xs font-normal text-muted">
            {done}/{items.length}
          </span>
        )}
      </h3>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="group flex items-start gap-2 rounded-lg px-1 py-1 hover:bg-surface-2">
            <button
              type="button"
              role="checkbox"
              aria-checked={it.done}
              aria-label={it.done ? `Desmarcar: ${it.text}` : `Concluir: ${it.text}`}
              onClick={() => onChange(touch(items, it.id, { done: !it.done }), !it.done)}
              className={cn('mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-md border', it.done ? 'border-ink bg-ink text-bg' : 'border-muted/60 hover:border-ink')}
            >
              {it.done && <Check className="size-3" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm leading-snug text-ink', it.done && 'text-muted line-through')}>{it.text}</p>
              {withUrl && (
                <input
                  defaultValue={it.url ?? ''}
                  placeholder="Link do entregável (opcional)"
                  aria-label={`Link de ${it.text}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== (it.url ?? '') && (v === '' || isUrl(v))) onChange(touch(items, it.id, { url: v || null }), false)
                  }}
                  className="mt-0.5 w-full bg-transparent text-xs text-muted outline-none placeholder:text-muted/60 focus:text-ink"
                />
              )}
            </div>
            <IconButton label={`Remover: ${it.text}`} size="sm" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => onChange(items.filter((x) => x.id !== it.id), false)}>
              <X className="size-3.5 text-muted" />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          const v = text.trim().slice(0, 300)
          if (!v) return
          onChange([...items, { id: crypto.randomUUID(), text: v, done: false }], false)
          setText('')
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-9" />
        <IconButton label={`Adicionar em ${title}`} type="submit" variant="secondary" size="sm" className="size-9" disabled={!text.trim()}>
          <Plus className="size-4" />
        </IconButton>
      </form>
    </section>
  )
}
