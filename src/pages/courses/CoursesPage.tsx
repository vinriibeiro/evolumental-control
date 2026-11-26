import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  FolderSync,
  GraduationCap,
  Link2,
  PlayCircle,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Switch } from '@/components/ui/Field'
import { EmptyState, ErrorState, Spinner, useToast } from '@/components/ui/feedback'
import { Badge, Card, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { useBackend } from '@/app/data'
import { useAll, useTransaction } from '@/hooks/data'
import { useLookups } from '@/hooks/domain'
import { useCourses } from '@/hooks/useCourses'
import { courseStatus, displayTitle, lastStudied, lessonOf, resumeItem, type CourseStatusFilter, type CourseView } from '@/lib/courseCatalog'
import { formatDuration, KIND_LABELS, materialType, type MaterialKind } from '@/lib/drive'
import { DRIVE_READ_SCOPE, consumeRedirectToken } from '@/lib/googleAuth'
import { normalizeText } from '@/lib/videoProgress'
import { TEO_SOURCE } from '@/lib/youtubeCourses'
import { COURSE_TABLES } from '@/services/courses'
import { DATA_AREAS, detectDataArea, type DataAreaId } from '@/services/courseIntegration'
import { installYoutubeCourses } from '@/services/youtubeCourses'
import { cn } from '@/lib/cn'
import { AddCourseToCycleModal, QuickDriveCourseModal, ScheduleCourseModal } from './CourseIntegrationModals'
import { DriveSources } from './DriveSources'

const STATUS_TABS: Array<{ value: CourseStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'not_started', label: 'Não iniciados' },
  { value: 'completed', label: 'Concluídos' },
]

export const courseLink = (v: CourseView, itemId?: string | null) => `/cursos/${v.course.id}${itemId ? `?item=${itemId}` : ''}`

function CourseCard({
  v,
  source,
  resumeId,
  areaLabel,
  areaColor,
  inCycle,
  onAddToCycle,
  onSchedule,
}: {
  v: CourseView
  source?: string
  resumeId: string | null
  areaLabel: string
  areaColor: string
  inCycle: boolean
  onAddToCycle: (v: CourseView) => void
  onSchedule: (v: CourseView) => void
}) {
  const pct = v.total ? Math.round((v.done / v.total) * 100) : 0
  const status = courseStatus(v)
  const dur = formatDuration(v.durationMs)
  return (
    <Card className="group flex flex-col overflow-hidden transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-md">
      <Link to={courseLink(v, resumeId)} tabIndex={-1} aria-hidden className="relative flex h-36 items-center overflow-hidden border-b border-line bg-surface px-6">
        <span className="text-5xl font-semibold tracking-tighter text-accent-strong/25">{v.title.trim().slice(0, 2).toLocaleUpperCase('pt-BR')}</span>
        <GraduationCap className="absolute -right-3 -bottom-5 size-32 rotate-[-12deg] text-accent-strong/10 transition-transform group-hover:rotate-0" />
        <div className="absolute top-3.5 left-4 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-line bg-bg px-2.5 py-1 text-[11px] font-semibold text-ink">
            {status === 'completed' ? 'Concluído' : status === 'in_progress' ? `${pct}% concluído` : 'Não iniciado'}
          </span>
          <Badge color={areaColor}>{areaLabel}</Badge>
          {inCycle && <Badge color="var(--success)">No ciclo</Badge>}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="min-w-0">
          {source && <p className="truncate text-xs text-muted">{source}</p>}
          <h3 className="mt-1 line-clamp-2 text-lg leading-snug font-semibold tracking-tight text-ink">
            <Link to={courseLink(v)} className="hover:underline">{v.title}</Link>
          </h3>
          <p className="mt-2 text-xs text-muted">{v.total} {v.total === 1 ? 'aula' : 'aulas'}{dur ? ` · ${dur} de vídeo` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(v.kinds) as Array<[MaterialKind, number]>).map(([k, n]) => <Badge key={k}>{KIND_LABELS[k]}: {n}</Badge>)}
          {v.missing > 0 && <Badge className="bg-warning/15 text-warning">{v.missing} não encontrado(s)</Badge>}
        </div>
        <div className="mt-auto space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{v.done} de {v.total} concluída(s)</span>
              <span className="tabular">{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" label={`Progresso de ${v.title}`} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" icon={<RefreshCcw className="size-3.5" aria-hidden />} onClick={() => onAddToCycle(v)}>
              {inCycle ? '+ Bloco no ciclo' : '+ Ciclo'}
            </Button>
            <Button size="sm" variant="secondary" icon={<CalendarPlus className="size-3.5" aria-hidden />} onClick={() => onSchedule(v)}>
              Agendar
            </Button>
          </div>
          <Link to={courseLink(v, resumeId)} className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent/40 hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong">
            <span className="inline-flex items-center gap-2">
              {status === 'completed' ? <CheckCircle2 className="size-4" aria-hidden /> : <PlayCircle className="size-4" aria-hidden />}
              {status === 'completed' ? 'Rever' : status === 'in_progress' ? 'Continuar' : 'Começar'}
            </span>
            <ArrowUpRight className="size-4 text-muted" aria-hidden />
          </Link>
        </div>
      </div>
    </Card>
  )
}

/** Catálogo de cursos e materiais vindos do Google Drive, 100% integrado ao ciclo e cronograma em Dados. */
export default function CoursesPage() {
  const backend = useBackend()
  const lookups = useLookups()
  const [showHidden, setShowHidden] = useState(false)
  const data = useCourses({ includeHidden: showHidden })
  const cycleItems = useAll('study_cycle_items')
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const [cycleTarget, setCycleTarget] = useState<CourseView | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<CourseView | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  // Volta do Google no fluxo "Conectar com o Google" (mesma aba): lê o token do fragmento da URL e reabre as pastas do
  // Drive — ou segue para a tela que pediu a autorização (por exemplo, o leitor de um PDF).
  useEffect(() => {
    const result = consumeRedirectToken()
    if (!result) return
    if (!result.ok) {
      setSourcesOpen(true)
      toast.error(result.message)
      return
    }
    toast.success(result.scope === DRIVE_READ_SCOPE ? 'Leitura do PDF autorizada nesta aba.' : 'Google Drive conectado (só leitura de metadados).')
    if (result.returnTo) navigate(result.returnTo, { replace: true })
    else setSourcesOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const installTeo = useTransaction(COURSE_TABLES, (b) => installYoutubeCourses(b))
  const addTeo = async () => {
    try {
      const r = await installTeo.mutateAsync(undefined)
      toast.success(r.inserted ? `${r.courses} cursos e ${r.lessons} aulas do Téo Me Why em Cursos (${r.inserted} itens novos).` : 'Os cursos do Téo Me Why já estavam em Cursos.')
    } catch (e) {
      toast.error(e)
    }
  }

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<CourseStatusFilter>('all')
  const [kind, setKind] = useState<MaterialKind | ''>('')
  const [sourceId, setSourceId] = useState('')
  const [areaFilter, setAreaFilter] = useState<DataAreaId | ''>('')

  const sources = data.sources.data ?? []
  const sourceName = new Map(sources.map((s) => [s.id, s.label ?? s.title]))
  const teoInstalled = sources.some((s) => s.drive_folder_id === TEO_SOURCE.folderId)
  const teoButton = !teoInstalled && (
    <Button icon={<PlayCircle className="size-4" aria-hidden />} loading={installTeo.isPending} onClick={() => void addTeo()}>
      Cursos do Téo (YouTube)
    </Button>
  )

  const subjectsInCycle = useMemo(() => new Set((cycleItems.data ?? []).map((i) => i.subject_id)), [cycleItems.data])
  const areaOf = useMemo(() => {
    const map = new Map<string, ReturnType<typeof detectDataArea>>()
    for (const v of data.views) {
      const subName = v.course.subject_id ? lookups.subjectName(v.course.subject_id) : null
      map.set(v.course.id, detectDataArea(v.title, subName))
    }
    return map
  }, [data.views, lookups])

  const areaCounts = useMemo(() => {
    const counts = new Map<DataAreaId, number>()
    for (const area of areaOf.values()) counts.set(area.id, (counts.get(area.id) ?? 0) + 1)
    return counts
  }, [areaOf])

  const filtered = useMemo(() => {
    const q = normalizeText(query.trim())
    return data.views.filter((v) => {
      if (sourceId && v.course.source_id !== sourceId) return false
      if (status !== 'all' && courseStatus(v) !== status) return false
      if (kind && !v.kinds[kind]) return false
      if (areaFilter && areaOf.get(v.course.id)?.id !== areaFilter) return false
      if (!q) return true
      return normalizeText(v.title).includes(q) || v.lessons.some((l) => normalizeText(l.title).includes(q)) || v.items.some((i) => normalizeText(displayTitle(i)).includes(q))
    })
  }, [data.views, query, status, kind, sourceId, areaFilter, areaOf])

  // Busca também por aula: mostra os materiais que batem, com link direto.
  const itemHits = useMemo(() => {
    const q = normalizeText(query.trim())
    if (q.length < 2) return []
    return filtered.flatMap((v) => v.lessons.filter((l) => normalizeText(l.title).includes(q) || normalizeText(displayTitle(l.primary)).includes(q)).map((l) => ({ v, i: l.primary, title: l.title }))).slice(0, 12)
  }, [filtered, query])

  const recent = lastStudied(data.views)
  const recentItem = recent ? resumeItem(recent, data.index) : null
  const missingTable = (data.error as { code?: string } | null)?.code === 'schema'
  const totals = data.views.reduce(
    (acc, v) => ({
      lessons: acc.lessons + v.total,
      done: acc.done + v.done,
      inProgress: acc.inProgress + (courseStatus(v) === 'in_progress' ? 1 : 0),
      inCycle: acc.inCycle + (v.course.subject_id && subjectsInCycle.has(v.course.subject_id) ? 1 : 0),
    }),
    { lessons: 0, done: 0, inProgress: 0, inCycle: 0 },
  )
  const hasFilters = Boolean(query.trim() || status !== 'all' || kind || sourceId || areaFilter)
  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setKind('')
    setSourceId('')
    setAreaFilter('')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cursos do Google Drive"
        description="Seus cursos da área de dados integrados 100% ao ciclo de estudos, cronograma e cronômetro. Os arquivos continuam no seu Google Drive."
        actions={
          <div className="flex flex-wrap gap-2">
            {teoButton}
            <Button icon={<Link2 className="size-4" aria-hidden />} onClick={() => setQuickOpen(true)}>
              Adicionar por link
            </Button>
            <Button variant="primary" icon={<FolderSync className="size-4" aria-hidden />} onClick={() => setSourcesOpen(true)}>
              Pastas do Drive
            </Button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-xs leading-relaxed text-muted">
          {backend.kind === 'local'
            ? 'Modo local: o catálogo e o progresso ficam só neste navegador.'
            : 'O catálogo e o progresso ficam na sua conta e sincronizam entre aparelhos.'}{' '}
          Conecte uma pasta completa em <strong>Pastas do Drive</strong> ou cadastre um curso rápido em <strong>Adicionar por link</strong>.
        </p>
        {sources.length > 0 && <Switch checked={showHidden} onChange={setShowHidden} label="Mostrar ocultos" />}
      </div>

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
          title={sources.length ? 'Nenhum curso importado ainda' : 'Traga seus cursos do Google Drive'}
          description="Conecte uma pasta do Google Drive para importar todos os seus cursos de Dados de uma vez, ou cole o link de um curso agora mesmo para colocar no seu ciclo e cronograma."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={<FolderSync className="size-4" />} onClick={() => setSourcesOpen(true)}>Importar pasta do Drive</Button>
              <Button icon={<Link2 className="size-4" />} onClick={() => setQuickOpen(true)}>Adicionar por link</Button>
              {teoButton}
            </div>
          }
        />
      ) : (
        <>
          <section aria-label="Resumo dos cursos" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'No seu catálogo', value: data.views.length, detail: `${totals.inCycle} no ciclo de estudos` },
              { label: 'Em andamento', value: totals.inProgress, detail: 'para seguir aprendendo' },
              { label: 'Aulas concluídas', value: totals.done, detail: `de ${totals.lessons} no catálogo` },
              { label: 'Seu progresso', value: `${totals.lessons ? Math.round((totals.done / totals.lessons) * 100) : 0}%`, detail: 'das aulas concluídas' },
            ].map((stat) => (
              <Card key={stat.label} className="p-4 sm:p-5">
                <p className="text-xs font-medium text-muted">{stat.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">{stat.value}</p>
                <p className="mt-1 text-xs text-muted">{stat.detail}</p>
              </Card>
            ))}
          </section>

          {recent && recentItem && (
            <Card className="relative overflow-hidden border-accent/25 bg-accent/5 p-5 sm:p-7">
              <BookOpen className="pointer-events-none absolute -top-4 -right-3 size-36 -rotate-12 text-accent-strong/5" aria-hidden />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-accent/20 bg-bg text-accent-strong"><PlayCircle className="size-6" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.18em] text-accent-strong uppercase">Continuar estudando</p>
                  <p className="mt-2 line-clamp-2 text-xl font-semibold tracking-tight text-ink">{lessonOf(recent, recentItem.id)?.title ?? displayTitle(recentItem)}</p>
                  <p className="mt-2 text-sm text-muted">{recent.title} · {materialType(recentItem.mime_type).label}</p>
                  <Progress value={recent.total ? (recent.done / recent.total) * 100 : 0} className="mt-4 h-1.5 max-w-sm" label={`Progresso de ${recent.title}`} />
                </div>
                <Link to={courseLink(recent, recentItem.id)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong">Continuar <ArrowUpRight className="size-4" aria-hidden /></Link>
              </div>
            </Card>
          )}

          {/* Filtro rápido por Área de Dados */}
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por área de dados">
            <button
              type="button"
              onClick={() => setAreaFilter('')}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                areaFilter === '' ? 'border-ink bg-ink text-bg' : 'border-line bg-bg text-muted hover:text-ink',
              )}
            >
              Todas as áreas ({data.views.length})
            </button>
            {DATA_AREAS.filter((a) => (areaCounts.get(a.id) ?? 0) > 0).map((area) => {
              const active = areaFilter === area.id
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setAreaFilter(active ? '' : area.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    active ? 'border-ink bg-ink text-bg' : 'border-line bg-bg text-muted hover:text-ink',
                  )}
                >
                  {area.label} ({areaCounts.get(area.id)})
                </button>
              )
            })}
          </div>

          <Card className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-ink">Explore seu catálogo</h2>
                <p className="mt-1 text-xs text-muted">Encontre um curso, uma aula ou envie direto para seu ciclo e cronograma.</p>
              </div>
              {hasFilters && filtered.length > 0 && <Button size="sm" variant="ghost" icon={<X className="size-3.5" aria-hidden />} onClick={clearFilters}>Limpar filtros</Button>}
            </div>
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
          </Card>

          {itemHits.length > 0 && (
            <Card className="p-3">
              <p className="mb-1 text-sm font-semibold text-ink">Aulas e materiais encontrados</p>
              <ul className="divide-y divide-line text-sm">
                {itemHits.map(({ v, i, title }) => (
                  <li key={i.id}><Link to={courseLink(v, i.id)} className="flex flex-wrap gap-x-2 py-1.5 hover:underline"><span className="text-ink">{title}</span><span className="text-xs text-muted">{v.title} · {materialType(i.mime_type).label}</span></Link></li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'curso' : 'cursos'}{hasFilters ? ` de ${data.views.length}` : ' no seu catálogo'}</p>
          </div>
          {filtered.length === 0 ? <EmptyState icon={<Search className="size-7" aria-hidden />} title="Nenhum curso encontrado" description="Experimente outro termo ou remova os filtros para ver seu catálogo." action={<Button onClick={clearFilters}>Limpar filtros</Button>} /> : (
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((v) => {
                const area = areaOf.get(v.course.id) ?? DATA_AREAS[DATA_AREAS.length - 1]
                const inCycle = Boolean(v.course.subject_id && subjectsInCycle.has(v.course.subject_id))
                return (
                  <li key={v.course.id} className="grid">
                    <CourseCard
                      v={v}
                      source={sources.length > 1 ? sourceName.get(v.course.source_id) : undefined}
                      resumeId={resumeItem(v, data.index)?.id ?? null}
                      areaLabel={area.label}
                      areaColor={area.color}
                      inCycle={inCycle}
                      onAddToCycle={setCycleTarget}
                      onSchedule={setScheduleTarget}
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
      <DriveSources open={sourcesOpen} onClose={() => setSourcesOpen(false)} sources={sources} />
      <QuickDriveCourseModal open={quickOpen} onClose={() => setQuickOpen(false)} />
      <AddCourseToCycleModal course={cycleTarget} onClose={() => setCycleTarget(null)} />
      <ScheduleCourseModal course={scheduleTarget} onClose={() => setScheduleTarget(null)} />
    </div>
  )
}
