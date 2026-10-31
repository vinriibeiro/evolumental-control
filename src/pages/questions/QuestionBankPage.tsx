import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ListChecks, Save, Shuffle, SlidersHorizontal, Star } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Badge, Card, PageHeader, Progress as ProgressBar } from '@/components/ui/layout'
import { EmptyState, QueryState, Spinner, useToast } from '@/components/ui/feedback'
import { useInsert } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import {
  EMPTY_FILTERS,
  LEVELS,
  LEVEL_LABELS,
  STATUS_LABELS,
  STYLE_LABELS,
  TYPE_LABELS,
  answerOptions,
  filterQuestions,
  isCorrect,
  loadProgress,
  parseBlocks,
  recordAnswer,
  saveProgress,
  sessionNote,
  shuffled,
  summarizeProgress,
  toggleFavorite,
  type BankFilters,
  type BankIndex,
  type BankQuestion,
  type Progress,
  type QuestionStyle,
  type QuestionType,
  type StatusFilter,
} from '@/lib/questionBank'
import { cn } from '@/lib/cn'
import { todayKey } from '@/lib/time'

const base = import.meta.env.BASE_URL.replace(/\/$/, '')
/** Quantas questões trazer por vez (0 = todas as que passarem nos filtros). */
const AMOUNTS = [10, 20, 30, 50, 100, 0]

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}/questoes/${path}`)
  if (!res.ok) throw new Error(`Não consegui carregar as questões (${res.status}).`)
  return (await res.json()) as T
}

/** O que o usuário escolheu nos filtros. Só vira lista quando ele clica em "Trazer questões". */
interface Pick {
  tema: string
  subtemas: string[]
  filters: BankFilters
  amount: number
}

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string }>; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = value.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn('h-8 rounded-lg border px-3 text-sm transition-colors', on ? 'border-accent-strong bg-accent/25 text-ink' : 'border-line text-muted hover:bg-surface hover:text-ink')}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Blocks({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parseBlocks(text).map((b, i) =>
        b.type === 'code' ? (
          <pre key={i} className="scroll-thin overflow-x-auto rounded-lg bg-surface p-3 text-xs leading-relaxed text-ink">
            <code>{b.text}</code>
          </pre>
        ) : (
          <p key={i} className="text-sm whitespace-pre-wrap text-ink">
            {b.text}
          </p>
        ),
      )}
    </div>
  )
}

function QuestionCard({ q, number, chosen, favorite, onAnswer, onFavorite }: { q: BankQuestion; number: number; chosen: string | undefined; favorite: boolean; onAnswer: (key: string) => void; onFavorite: () => void }) {
  const answered = chosen !== undefined
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="tabular text-xs font-semibold text-muted">#{number}</span>
        <Badge>{q.subtema}</Badge>
        <Badge>{LEVEL_LABELS[q.nivel]}</Badge>
        <Badge>{TYPE_LABELS[q.tipo]}</Badge>
        <Badge>{STYLE_LABELS[q.estilo]}</Badge>
        <span className="flex-1" />
        <span className="text-[11px] text-muted">{q.id}</span>
        <button type="button" aria-pressed={favorite} aria-label={favorite ? 'Tirar das favoritas' : 'Favoritar'} onClick={onFavorite} className="rounded p-1 text-muted hover:bg-surface hover:text-ink">
          <Star className={cn('size-4', favorite && 'fill-current text-warning')} />
        </button>
      </div>
      <Blocks text={q.enunciado} />
      <ul className="mt-4 space-y-1.5">
        {answerOptions(q).map((o) => {
          const isRight = o.key === q.gabarito
          const isChosen = chosen === o.key
          return (
            <li key={o.key}>
              <button
                type="button"
                disabled={answered}
                aria-label={`Alternativa ${o.key}`}
                onClick={() => onAnswer(o.key)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                  !answered && 'border-line text-ink hover:bg-surface',
                  answered && isRight && 'border-success bg-success/10 text-ink',
                  answered && isChosen && !isRight && 'border-danger bg-danger/10 text-ink',
                  answered && !isRight && !isChosen && 'border-line text-muted',
                )}
              >
                <span className="tabular mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold">{o.key}</span>
                <span className="min-w-0 flex-1 break-words whitespace-pre-wrap">{o.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {answered && (
        <div role="status" className="mt-4 rounded-lg bg-surface p-3">
          <p className={cn('mb-1 text-sm font-semibold', chosen === q.gabarito ? 'text-success' : 'text-danger')}>{chosen === q.gabarito ? 'Você acertou!' : `Você errou. A resposta é ${q.gabarito}.`}</p>
          <p className="text-sm whitespace-pre-wrap text-ink">{q.explicacao}</p>
        </div>
      )}
    </Card>
  )
}

/**
 * Banco de questões. O usuário monta os filtros (tema, subtemas, nível, quantidade…) e clica em "Trazer questões";
 * só então a lista é montada. Depois responde uma questão por vez, com "Anterior" / "Próxima" (ou as setas do teclado).
 */
export default function QuestionBankPage() {
  const auth = useAuth()
  const settings = useSettings()
  const toast = useToast()
  const insert = useInsert('question_records')
  const scope = auth.mode === 'supabase' ? (auth.user?.id ?? 'anon') : 'local'

  const index = useQuery({ queryKey: ['qbank', 'index'], queryFn: () => getJson<BankIndex>('index.json'), staleTime: Infinity })
  const [draft, setDraft] = useState<Pick>({ tema: '', subtemas: [], filters: EMPTY_FILTERS, amount: 20 })
  const [applied, setApplied] = useState<Pick | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [progress, setProgress] = useState<Progress>(() => loadProgress(scope))
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [session, setSession] = useState({ total: 0, correct: 0 })
  const [pos, setPos] = useState(0)
  const [seed, setSeed] = useState(0)

  useEffect(() => setProgress(loadProgress(scope)), [scope])
  useEffect(() => saveProgress(scope, progress), [scope, progress])

  const temas = index.data?.temas ?? []
  const draftTheme = temas.find((t) => t.tema === draft.tema) ?? temas[0]
  const appliedTheme = applied ? temas.find((t) => t.tema === applied.tema) : undefined
  const activeSubs = useMemo(() => (appliedTheme && applied ? (applied.subtemas.length ? appliedTheme.subtemas.filter((s) => applied.subtemas.includes(s.nome)) : appliedTheme.subtemas) : []), [appliedTheme, applied])
  const shards = useQueries({
    queries: activeSubs.map((s) => ({ queryKey: ['qbank', appliedTheme?.prefixo, s.arquivo], queryFn: () => getJson<BankQuestion[]>(`${appliedTheme?.prefixo}/${s.arquivo}`), staleTime: Infinity })),
  })
  const loading = Boolean(applied) && shards.some((s) => s.isPending)
  const failed = shards.find((s) => s.isError)
  const loaded = useMemo(() => shards.flatMap((s) => s.data ?? []), [shards])

  // A lista só muda quando o usuário traz questões de novo ou embaralha (responder não tira a questão da tela).
  const [frozen, setFrozen] = useState<{ ids: string[] } | null>(null)
  const filtered = useMemo(() => (applied ? filterQuestions(loaded, applied.filters, progress) : []), [loaded, applied]) // eslint-disable-line react-hooks/exhaustive-deps
  const filteredKey = filtered.map((q) => q.id).join(',')
  useEffect(() => {
    const list = seed ? shuffled(filtered) : filtered
    setFrozen({ ids: (applied?.amount ? list.slice(0, applied.amount) : list).map((q) => q.id) })
    setPos(0)
  }, [filteredKey, seed, applied?.amount]) // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(loaded.map((q) => [q.id, q])), [loaded])
  const ordered = useMemo(() => (frozen?.ids ?? []).map((id) => byId.get(id)).filter((q): q is BankQuestion => Boolean(q)), [frozen, byId])
  const current = ordered[pos] ?? null
  const answeredHere = ordered.filter((q) => chosen[q.id] !== undefined).length
  const stats = summarizeProgress(progress, loaded.map((q) => q.id))

  const setF = <K extends keyof BankFilters>(k: K, v: BankFilters[K]) => setDraft((d) => ({ ...d, filters: { ...d.filters, [k]: v } }))
  const goTo = (i: number) => {
    if (i < 0 || i >= ordered.length) return
    setPos(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const bring = () => {
    if (!draftTheme) return
    const next = { ...draft, tema: draftTheme.tema }
    if (applied?.tema !== next.tema) setChosen({})
    setApplied(next)
    setFiltersOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Setas do teclado trocam de questão (fora de campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') goTo(pos + 1)
      else if (e.key === 'ArrowLeft') goTo(pos - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // sem lista de dependências de propósito: usa sempre pos/ordered atuais

  const answer = (q: BankQuestion, key: string) => {
    if (chosen[q.id] !== undefined) return
    const ok = isCorrect(q, key)
    setChosen((c) => ({ ...c, [q.id]: key }))
    setProgress((p) => recordAnswer(p, q.id, ok))
    setSession((s) => ({ total: s.total + 1, correct: s.correct + (ok ? 1 : 0) }))
  }

  const saveSession = async () => {
    if (!session.total) return
    try {
      await insert.mutateAsync({ subject_id: null, topic_id: null, date: todayKey(settings.timezone), total: session.total, correct: session.correct, wrong: session.total - session.correct, board: null, exam: null, source: 'Banco de questões', notes: sessionNote(applied?.tema ?? '', applied?.subtemas ?? [], session.total) })
      toast.success(`${session.total} questão(ões) salvas em Desempenho.`)
      setSession({ total: 0, correct: 0 })
    } catch (e) {
      toast.error(e)
    }
  }

  const activeFilters = draft.subtemas.length + draft.filters.niveis.length + draft.filters.tipos.length + draft.filters.estilos.length + (draft.filters.status !== 'todas' ? 1 : 0) + (draft.filters.busca ? 1 : 0)
  const bringLabel = applied ? 'Trazer novas questões' : 'Trazer questões'

  return (
    <div>
      <PageHeader
        title="Banco de questões"
        description="Escolha o tema e os filtros, clique em Trazer questões e responda uma por vez. O progresso fica salvo neste aparelho."
        actions={
          <Button size="sm" className="lg:hidden" icon={<SlidersHorizontal className="size-4" aria-hidden />} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
            Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
        }
      />
      <QueryState query={index}>
        {!draftTheme ? (
          <EmptyState title="Banco vazio" description="Nenhuma questão foi carregada ainda." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className={cn('space-y-4 lg:sticky lg:top-24 lg:self-start', !filtersOpen && 'max-lg:hidden')}>
              <Card className="space-y-4 p-4">
                <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                  Tema
                  <Select aria-label="Tema" className="mt-1.5 w-full text-sm font-normal normal-case" value={draftTheme.tema} onChange={(e) => setDraft((d) => ({ ...d, tema: e.target.value, subtemas: [] }))}>
                    {temas.map((t) => (
                      <option key={t.tema} value={t.tema}>
                        {t.tema} ({t.total.toLocaleString('pt-BR')})
                      </option>
                    ))}
                  </Select>
                </label>
                <fieldset>
                  <legend className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Subtemas</legend>
                  <div className="flex flex-col gap-1.5">
                    {draftTheme.subtemas.map((s) => (
                      <Checkbox
                        key={s.nome}
                        label={`${s.nome} (${s.total})`}
                        checked={draft.subtemas.includes(s.nome)}
                        onChange={(e) => setDraft((d) => ({ ...d, subtemas: e.target.checked ? [...d.subtemas, s.nome] : d.subtemas.filter((x) => x !== s.nome) }))}
                      />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">{draft.subtemas.length ? 'Só os marcados.' : 'Nenhum marcado = todos.'}</p>
                </fieldset>
                <Chips label="Nível" value={draft.filters.niveis} onChange={(v) => setF('niveis', v)} options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))} />
                <Chips<QuestionType> label="Tipo" value={draft.filters.tipos} onChange={(v) => setF('tipos', v)} options={(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))} />
                <Chips<QuestionStyle> label="Estilo" value={draft.filters.estilos} onChange={(v) => setF('estilos', v)} options={(Object.keys(STYLE_LABELS) as QuestionStyle[]).map((s) => ({ value: s, label: STYLE_LABELS[s] }))} />
                <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                  Situação
                  <Select aria-label="Situação" className="mt-1.5 w-full text-sm font-normal normal-case" value={draft.filters.status} onChange={(e) => setF('status', e.target.value as StatusFilter)}>
                    {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                  Buscar no enunciado
                  <Input aria-label="Buscar" className="mt-1.5 w-full text-sm font-normal normal-case" value={draft.filters.busca} placeholder="ex.: LEFT JOIN, janela, NULL" onChange={(e) => setF('busca', e.target.value)} />
                </label>
                <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                  Quantidade
                  <Select aria-label="Quantidade" className="mt-1.5 w-full text-sm font-normal normal-case" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))}>
                    {AMOUNTS.map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'Todas que passarem nos filtros' : `${n} questões`}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <Button variant="primary" icon={<ListChecks className="size-4" aria-hidden />} onClick={bring}>
                    {bringLabel}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, subtemas: [], filters: EMPTY_FILTERS }))}>
                    Limpar filtros
                  </Button>
                </div>
              </Card>
              {applied && (
                <Card className="p-4 text-sm">
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Seu progresso em {applied.tema}</p>
                  <p className="text-ink">
                    {stats.answered} de {loaded.length} respondidas · {stats.correctLast} certas · {stats.wrongLast} erradas · {stats.favorites} favoritas
                  </p>
                </Card>
              )}
            </aside>

            <section className="min-w-0 space-y-4">
              {!applied ? (
                <EmptyState
                  icon={<ListChecks className="size-8" aria-hidden />}
                  title="Monte a sua lista"
                  description="Escolha o tema, os subtemas, o nível e a quantidade nos filtros e clique em Trazer questões. As questões aparecem uma por vez."
                  action={
                    <Button variant="primary" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
                      Escolher filtros
                    </Button>
                  }
                />
              ) : (
                <>
                  <Card className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink" aria-live="polite">
                        {loading ? 'Carregando questões…' : `${ordered.length.toLocaleString('pt-BR')} questão(ões)`}
                        {!loading && filtered.length > ordered.length && <span className="text-muted"> de {filtered.length.toLocaleString('pt-BR')} que passaram nos filtros</span>}
                        {!loading && current && <span className="text-muted"> · {answeredHere} respondidas</span>}
                      </p>
                      <span className="flex-1" />
                      <span className="text-xs text-muted">
                        Sessão: {session.correct}/{session.total} certas
                      </span>
                      <Button size="sm" icon={<Save className="size-4" />} disabled={!session.total} loading={insert.isPending} onClick={() => void saveSession()}>
                        Salvar em Desempenho
                      </Button>
                      <Button size="sm" icon={<Shuffle className="size-4" />} onClick={() => setSeed((s) => s + 1)}>
                        Embaralhar
                      </Button>
                    </div>
                    {!loading && ordered.length > 0 && <ProgressBar value={((pos + 1) / ordered.length) * 100} className="h-1.5" label="Posição na lista" />}
                  </Card>

                  {failed ? (
                    <EmptyState title="Não consegui carregar" description={String((failed.error as Error)?.message ?? 'Erro desconhecido.')} />
                  ) : loading ? (
                    <Spinner />
                  ) : !current ? (
                    <EmptyState title="Nenhuma questão com esses filtros" description="Tire algum filtro ou escolha outro subtema e clique em Trazer questões de novo." />
                  ) : (
                    <>
                      <QuestionCard key={current.id} q={current} number={pos + 1} chosen={chosen[current.id]} favorite={progress[current.id]?.[3] === 1} onAnswer={(k) => answer(current, k)} onFavorite={() => setProgress((p) => toggleFavorite(p, current.id))} />
                      <nav aria-label="Navegar entre as questões" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <Button icon={<ChevronLeft className="size-4" aria-hidden />} disabled={pos === 0} onClick={() => goTo(pos - 1)} className="justify-self-start">
                          Anterior
                        </Button>
                        <span className="tabular text-center text-sm text-muted">
                          Questão {pos + 1} de {ordered.length.toLocaleString('pt-BR')}
                        </span>
                        <Button variant={chosen[current.id] !== undefined ? 'primary' : 'secondary'} disabled={pos >= ordered.length - 1} onClick={() => goTo(pos + 1)} className="justify-self-end">
                          {chosen[current.id] !== undefined ? 'Próxima' : 'Pular'} <ChevronRight className="size-4" aria-hidden />
                        </Button>
                      </nav>
                      {pos >= ordered.length - 1 && chosen[current.id] !== undefined && (
                        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm text-ink">
                            Fim da lista: {session.correct} de {session.total} certas nesta sessão.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" icon={<Save className="size-4" />} disabled={!session.total} loading={insert.isPending} onClick={() => void saveSession()}>
                              Salvar em Desempenho
                            </Button>
                            <Button size="sm" variant="primary" icon={<ListChecks className="size-4" aria-hidden />} onClick={() => setFiltersOpen(true)}>
                              Montar outra lista
                            </Button>
                          </div>
                        </Card>
                      )}
                      <p className="hidden text-center text-xs text-muted sm:block">Dica: use as setas ← → do teclado para trocar de questão.</p>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </QueryState>
    </div>
  )
}
