// Projetos práticos e portfólio. Transformam o estudo em entregáveis reais.
// Um projeto é um registro só, mesmo ligado a vários tópicos; o mesmo modelo nunca vira dois projetos.
// Criar um projeto não prova nada: os indicadores contam etapas, entregáveis, tempo investido e publicações.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ExternalLink, FolderGit2, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Badge, Card, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { EmptyState, ErrorState, Skeleton, useToast } from '@/components/ui/feedback'
import { DS_PROJECT_TEMPLATES } from '@/content/dsProjects'
import { topicByKey } from '@/content/dsTrail'
import type { ProjectTemplate } from '@/content/dsTypes'
import { invalidateTables, useAll, useSessions } from '@/hooks/data'
import { DataError, eq, notNull } from '@/lib/data/types'
import { TRACK_LABELS } from '@/lib/labels'
import { netSeconds } from '@/lib/timer/engine'
import { formatDayKey, formatDuration } from '@/lib/time'
import { cn } from '@/lib/cn'
import type { CheckItem, Project } from '@/types/db'
import { ProjectDialog } from './ProjectDialog'
import { DIFFICULTY, PROJECT_STATUS_LABELS, projectProgress } from './projectModel'

const item = (text: string): CheckItem => ({ id: crypto.randomUUID(), text, done: false })

export default function ProjectsPage() {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const topicFilter = params.get('topico')
  const projects = useAll('projects', { order: [{ column: 'created_at', ascending: false }] })
  const sessions = useSessions({ filters: [eq('status', 'completed'), notNull('project_id')] })
  const [tab, setTab] = useState<'mine' | 'templates'>('mine')
  const [openId, setOpenId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const secondsBy = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions.data ?? []) if (s.project_id) m.set(s.project_id, (m.get(s.project_id) ?? 0) + netSeconds(s, s.pauses))
    return m
  }, [sessions.data])

  const rows = useMemo(() => projects.data ?? [], [projects.data])
  const byTemplate = new Map(rows.filter((p) => p.template_key).map((p) => [p.template_key!, p]))
  const mine = topicFilter ? rows.filter((p) => (p.topic_keys ?? []).includes(topicFilter)) : rows
  const templates = topicFilter ? DS_PROJECT_TEMPLATES.filter((t) => t.topicKeys.includes(topicFilter)) : DS_PROJECT_TEMPLATES
  const open = rows.find((p) => p.id === openId) ?? null

  const stats = useMemo(() => {
    const started = rows.filter((p) => p.status !== 'not_started')
    const practiced = new Set(started.filter((p) => projectProgress(p).done > 0).flatMap((p) => p.skills ?? []))
    return {
      started: started.length,
      done: rows.filter((p) => p.status === 'done').length,
      published: rows.filter((p) => p.published).length,
      skills: practiced.size,
      seconds: [...secondsBy.values()].reduce((a, b) => a + b, 0),
    }
  }, [rows, secondsBy])

  const create = async (data: Partial<Project> & { name: string }) => {
    setBusy(true)
    try {
      const [p] = await backend.insert('projects', [data])
      setOpenId(p.id)
      setTab('mine')
      return p
    } catch (e) {
      // o mesmo modelo já virou projeto (em outra aba, por exemplo): abre o existente em vez de duplicar
      if (e instanceof DataError && e.code === 'duplicate' && data.template_key) {
        await invalidateTables(qc, ['projects'])
        const { rows: found } = await backend.list('projects', { filters: [eq('template_key', data.template_key)], limit: 1 })
        if (found[0]) setOpenId(found[0].id)
      } else toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['projects'])
    }
  }

  const fromTemplate = (t: ProjectTemplate) => {
    const existing = byTemplate.get(t.key)
    if (existing) return setOpenId(existing.id)
    void create({ name: t.name, description: t.description, objective: t.objective, track: t.track, skills: t.skills, difficulty: t.difficulty, steps: t.steps.map(item), deliverables: t.deliverables.map(item), topic_keys: t.topicKeys, template_key: t.key })
  }

  if (projects.isError) return <ErrorState error={projects.error} onRetry={() => projects.refetch()} />

  return (
    <div>
      <PageHeader title="Projetos práticos" description="Aplique o que estudou em entregáveis reais para o seu portfólio. O progresso vem das etapas e dos entregáveis concluídos, não da criação do projeto." />

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Iniciados', String(stats.started)],
          ['Concluídos', String(stats.done)],
          ['Publicados', String(stats.published)],
          ['Competências praticadas', String(stats.skills)],
          ['Tempo investido', formatDuration(stats.seconds)],
        ].map(([label, value]) => (
          <Card key={label} className="px-4 py-3">
            <dt className="truncate text-[11px] font-medium text-muted">{label}</dt>
            <dd className="tabular mt-0.5 text-xl font-semibold text-ink">{projects.isPending ? '…' : value}</dd>
          </Card>
        ))}
      </dl>

      {topicFilter && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
          Projetos que praticam <strong className="font-medium text-ink">{topicByKey(topicFilter)?.title ?? topicFilter}</strong>
          <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => setParams({}, { replace: true })}>
            ver todos
          </button>
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          label="Lista"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mine', label: `Meus projetos (${mine.length})` },
            { value: 'templates', label: `Modelos sugeridos (${templates.length})` },
          ]}
        />
        <form
          className="flex w-full min-w-0 gap-2 sm:ml-auto sm:w-auto sm:max-w-sm sm:flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            void create({ name: name.trim().slice(0, 200), ...(topicFilter ? { topic_keys: [topicFilter] } : {}) }).then((p) => p && setName(''))
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome de um novo projeto" aria-label="Nome de um novo projeto" />
          <Button type="submit" variant="primary" icon={<Plus className="size-4" />} loading={busy} disabled={!name.trim()}>
            Criar
          </Button>
        </form>
      </div>

      {tab === 'mine' ? (
        projects.isPending ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : mine.length === 0 ? (
          <EmptyState
            icon={<FolderGit2 className="size-8 text-ink" />}
            title="Nenhum projeto ainda"
            description="Comece por um modelo sugerido ou crie o seu só com o nome. Etapas, entregáveis e link do repositório podem vir depois."
            action={<Button onClick={() => setTab('templates')}>Ver modelos sugeridos</Button>}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mine.map((p) => {
              const prog = projectProgress(p)
              return (
                <Card key={p.id} className="flex flex-col p-4">
                  <button type="button" onClick={() => setOpenId(p.id)} className="text-left">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Badge className={cn(p.status === 'done' && 'border-ink bg-ink text-bg')}>{PROJECT_STATUS_LABELS[p.status]}</Badge>
                      {p.track && <Badge>{TRACK_LABELS[p.track] ?? p.track}</Badge>}
                      {p.published && <Badge>Publicado</Badge>}
                    </span>
                    <span className="mt-2.5 block text-[15px] leading-snug font-semibold text-ink">{p.name}</span>
                    {p.objective && <span className="mt-1 line-clamp-2 block text-sm text-muted">{p.objective}</span>}
                  </button>
                  <div className="mt-auto pt-4">
                    <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
                      <span className="tabular">{prog.total ? `${prog.done} de ${prog.total} itens` : 'Sem etapas definidas'}</span>
                      <span className="tabular">{formatDuration(secondsBy.get(p.id) ?? 0)}</span>
                    </div>
                    <Progress value={prog.pct} className="mt-1.5 h-1" label={`Progresso de ${p.name}`} />
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted">{p.due_date ? `Prazo: ${formatDayKey(p.due_date)}` : DIFFICULTY[p.difficulty]}</span>
                      {p.repo_url && (
                        <a href={p.repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-ink underline underline-offset-2">
                          Repositório <ExternalLink className="size-3" aria-hidden />
                        </a>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const existing = byTemplate.get(t.key)
            return (
              <Card key={t.key} className="flex flex-col p-4">
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge>{TRACK_LABELS[t.track] ?? t.track}</Badge>
                  <Badge>{DIFFICULTY[t.difficulty]}</Badge>
                  <span className="tabular text-xs text-muted">~{t.estimatedHours} h</span>
                </span>
                <span className="mt-2.5 block text-[15px] leading-snug font-semibold text-ink">{t.name}</span>
                <span className="mt-1 line-clamp-3 block text-sm text-muted">{t.description}</span>
                <span className="mt-3 line-clamp-2 block text-xs text-muted">Competências: {t.skills.join(' · ')}</span>
                <div className="mt-auto pt-4">
                  <Button size="sm" variant={existing ? 'secondary' : 'dark'} loading={busy} onClick={() => fromTemplate(t)}>
                    {existing ? 'Abrir meu projeto' : 'Começar este projeto'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <ProjectDialog project={open} seconds={open ? (secondsBy.get(open.id) ?? 0) : 0} onClose={() => setOpenId(null)} />
    </div>
  )
}
