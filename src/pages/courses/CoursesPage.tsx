import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FolderSync, GraduationCap, PlayCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Switch } from '@/components/ui/Field'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback'
import { Badge, Card, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { useBackend } from '@/app/data'
import { useCourses } from '@/hooks/useCourses'
import { courseStatus, displayTitle, lastStudied, resumeItem, type CourseStatusFilter, type CourseView } from '@/lib/courseCatalog'
import { KIND_LABELS, materialType, type MaterialKind } from '@/lib/drive'
import { normalizeText } from '@/lib/videoProgress'
import { DriveSources } from './DriveSources'

const STATUS_TABS: Array<{ value: CourseStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'not_started', label: 'Não iniciados' },
  { value: 'completed', label: 'Concluídos' },
]

export const courseLink = (v: CourseView, itemId?: string | null) => `/cursos/${v.course.id}${itemId ? `?item=${itemId}` : ''}`

function CourseCard({ v, source, resumeId }: { v: CourseView; source?: string; resumeId: string | null }) {
  const pct = v.total ? Math.round((v.done / v.total) * 100) : 0
  const status = courseStatus(v)
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="min-w-0">
        {source && <p className="truncate text-xs text-muted">{source}</p>}
        <h3 className="mt-0.5 line-clamp-2 font-semibold text-ink">
          <Link to={courseLink(v)} className="hover:underline">{v.title}</Link>
        </h3>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(Object.entries(v.kinds) as Array<[MaterialKind, number]>).map(([k, n]) => <Badge key={k}>{KIND_LABELS[k]}: {n}</Badge>)}
        {v.missing > 0 && <Badge className="bg-warning/15 text-warning">{v.missing} não encontrado(s)</Badge>}
      </div>
      <div className="mt-auto space-y-1">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{v.done} de {v.total} concluído(s)</span>
          <span className="tabular">{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" label={`Progresso de ${v.title}`} />
      </div>
      <Link to={courseLink(v, resumeId)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent-strong">
        {status === 'completed' ? <CheckCircle2 className="size-4" aria-hidden /> : <PlayCircle className="size-4" aria-hidden />}
        {status === 'completed' ? 'Rever' : status === 'in_progress' ? 'Continuar' : 'Começar'}
      </Link>
    </Card>
  )
}

/** Catálogo de cursos e materiais vindos do Google Drive. */
export default function CoursesPage() {
  const backend = useBackend()
  const [showHidden, setShowHidden] = useState(false)
  const data = useCourses({ includeHidden: showHidden })
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CourseStatusFilter>('all')
  const [kind, setKind] = useState<MaterialKind | ''>('')
  const [sourceId, setSourceId] = useState('')
  const sources = data.sources.data ?? []
  const sourceName = new Map(sources.map((s) => [s.id, s.label ?? s.title]))

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim())
    return data.views.filter((v) => {
      if (sourceId && v.course.source_id !== sourceId) return false
      if (status !== 'all' && courseStatus(v) !== status) return false
      if (kind && !v.kinds[kind]) return false
      if (!q) return true
      return normalizeText(v.title).includes(q) || v.items.some((i) => normalizeText(displayTitle(i)).includes(q))
    })
  }, [data.views, query, status, kind, sourceId])

  // Busca também por aula: mostra os materiais que batem, com link direto.
  const itemHits = useMemo(() => {
    const q = normalizeText(query.trim())
    if (q.length < 2) return []
    return filtered.flatMap((v) => v.items.filter((i) => normalizeText(displayTitle(i)).includes(q)).map((i) => ({ v, i }))).slice(0, 12)
  }, [filtered, query])

  const recent = lastStudied(data.views)
  const recentItem = recent ? resumeItem(recent, data.index) : null
  const missingTable = (data.error as { code?: string } | null)?.code === 'schema'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cursos e materiais"
        description="Seus cursos e materiais do Google Drive, organizados em módulos e aulas. Os arquivos continuam no Drive."
        actions={<Button variant="primary" icon={<FolderSync className="size-4" aria-hidden />} onClick={() => setSourcesOpen(true)}>Pastas do Drive</Button>}
      />
      <p className="text-xs text-muted">
        {backend.kind === 'local'
          ? 'Modo local: o catálogo e o progresso ficam só neste navegador.'
          : 'O catálogo e o progresso ficam na sua conta e sincronizam entre aparelhos.'}{' '}
        Ver os arquivos exige internet e permissão no Drive para a conta Google deste navegador.
      </p>

      {data.isPending ? <Spinner /> : missingTable ? (
        <Card className="flex gap-3 p-4">
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold text-ink">Falta ativar Cursos no banco</p>
            <p className="text-muted">Aplique a migração <code>supabase/migrations/20261103000000_courses_drive.sql</code> no SQL Editor do Supabase (veja docs/CURSOS.md). As outras áreas continuam funcionando.</p>
          </div>
        </Card>
      ) : data.isError ? <ErrorState error={data.error} onRetry={() => void data.refetch()} /> : data.views.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-8" aria-hidden />}
          title={sources.length ? 'Nenhum curso importado ainda' : 'Nenhuma pasta cadastrada'}
          description="Cadastre uma pasta do Google Drive, confira a prévia e importe. Só nomes, tipos e a organização entram no app."
          action={<Button variant="primary" onClick={() => setSourcesOpen(true)}>Adicionar pasta do Drive</Button>}
        />
      ) : (
        <>
          {recent && recentItem && (
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <PlayCircle className="size-8 shrink-0 text-accent-strong" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">Continuar estudando</p>
                <p className="truncate font-semibold text-ink">{displayTitle(recentItem)}</p>
                <p className="truncate text-xs text-muted">{recent.title} · {materialType(recentItem.mime_type).label}</p>
              </div>
              <Link to={courseLink(recent, recentItem.id)} className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong">Continuar</Link>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input aria-label="Buscar curso ou aula" placeholder="Buscar curso ou aula" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Segmented value={status} onChange={setStatus} options={STATUS_TABS} label="Situação" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
            <Field label="Tipo de material">
              {(id) => (
                <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as MaterialKind | '')}>
                  <option value="">Todos</option>
                  {(Object.keys(KIND_LABELS) as MaterialKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </Select>
              )}
            </Field>
            {sources.length > 1 && (
              <Field label="Pasta">
                {(id) => (
                  <Select id={id} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                    <option value="">Todas</option>
                    {sources.map((s) => <option key={s.id} value={s.id}>{s.label ?? s.title}</option>)}
                  </Select>
                )}
              </Field>
            )}
          </div>

          {itemHits.length > 0 && (
            <Card className="p-3">
              <p className="mb-1 text-sm font-semibold text-ink">Aulas e materiais encontrados</p>
              <ul className="divide-y divide-line text-sm">
                {itemHits.map(({ v, i }) => (
                  <li key={i.id}><Link to={courseLink(v, i.id)} className="flex flex-wrap gap-x-2 py-1.5 hover:underline"><span className="text-ink">{displayTitle(i)}</span><span className="text-xs text-muted">{v.title} · {materialType(i.mime_type).label}</span></Link></li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted" aria-live="polite">{filtered.length} curso(s)</p>
            <Switch checked={showHidden} onChange={setShowHidden} label="Mostrar ocultos" />
          </div>
          {filtered.length === 0 ? <p className="text-sm text-muted">Nada encontrado com esses filtros.</p> : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((v) => <li key={v.course.id} className="grid"><CourseCard v={v} source={sources.length > 1 ? sourceName.get(v.course.source_id) : undefined} resumeId={resumeItem(v, data.index)?.id ?? null} /></li>)}
            </ul>
          )}
        </>
      )}
      <DriveSources open={sourcesOpen} onClose={() => setSourcesOpen(false)} sources={sources} />
    </div>
  )
}
