import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ListChecks, Save, Shuffle, SlidersHorizontal, Star } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { MultiSelect } from '@/components/ui/MultiSelect'
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
const amountLabel = (n: number) => (n === 0 ? 'Todas' : `${n} questões`)

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
  // Clicar numa alternativa só a marca; a correção vem com o botão "Responder".
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="p-4 sm:p-5">
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
          const isSelected = !answered && selected === o.key
          return (
            <li key={o.key}>
              <button
                type="button"
                disabled={answered}
                aria-label={`Alternativa ${o.key}`}
                aria-pressed={answered ? undefined : isSelected}
                onClick={() => setSelected(o.key)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                  !answered && !isSelected && 'border-line text-ink hover:bg-surface',
                  isSelected && 'border-accent-strong bg-accent/20 text-ink',
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
      {!answered && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{selected ? `Marcada: ${selected}` : 'Marque uma alternativa.'}</p>
          <Button variant="primary" disabled={!selected} onClick={() => selected && onAnswer(selected)} className="max-sm:w-full">
            Responder
          </Button>
        </div>
      )}
      {answered && (
        <div role="status" className="mt-4 rounded-lg bg-surface p-3">
          <p className={cn('mb-1 text-sm font-semibold', chosen === q.gabarito ? 'text-success' : 'text-danger')}>{chosen === q.gabarito ? 'Você acertou!' : `Você errou. A resposta é ${q.gabarito}.`}</p>
          <p className="text-sm whitespace-pre-wrap text-ink">{q.explicacao}</p>
        </div>
      )}
    </div>
  )
}

/**
 * Banco de questões. Barra de filtros em cima (menus suspensos, como em sites de questões): o usuário escolhe tema,
 * subtemas, nível, quantidade… e clica em "Trazer questões". A barra então se recolhe num resumo e a questão ocupa a
 * tela, uma por vez, com "Anterior" / "Próxima" sempre à vista (no computador a questão rola dentro do próprio cartão).
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
    document.getElementById('questao-atual')?.scrollTo?.({ top: 0 })
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
  const answeredCurrent = current ? chosen[current.id] !== undefined : false
  const atEnd = current ? pos >= ordered.length - 1 : false

  // Resumo do que está aplicado, para a barra recolhida.
  const summary = applied
    ? [
        applied.tema,
        applied.subtemas.length ? `${applied.subtemas.length} subtema(s)` : 'todos os subtemas',
        ...applied.filters.niveis.map((n) => LEVEL_LABELS[n]),
        ...applied.filters.tipos.map((t) => TYPE_LABELS[t]),
        ...applied.filters.estilos.map((s) => STYLE_LABELS[s]),
        ...(applied.filters.status !== 'todas' ? [STATUS_LABELS[applied.filters.status]] : []),
        ...(applied.filters.busca ? [`"${applied.filters.busca}"`] : []),
        amountLabel(applied.amount),
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Banco de questões"
        actions={
          <Button size="sm" icon={<SlidersHorizontal className="size-4" aria-hidden />} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
            Filtros{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
        }
      />
      <QueryState query={index}>
        {!draftTheme ? (
          <EmptyState title="Banco vazio" description="Nenhuma questão foi carregada ainda." />
        ) : (
          <>
            {filtersOpen && (
              <Card className="space-y-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                    Tema
                    <Select aria-label="Tema" className="mt-1.5 h-9 w-full text-sm font-normal normal-case" value={draftTheme.tema} onChange={(e) => setDraft((d) => ({ ...d, tema: e.target.value, subtemas: [] }))}>
                      {temas.map((t) => (
                        <option key={t.tema} value={t.tema}>
                          {t.tema} ({t.total.toLocaleString('pt-BR')})
                        </option>
                      ))}
                    </Select>
                  </label>
                  <MultiSelect label="Subtemas" options={draftTheme.subtemas.map((s) => ({ value: s.nome, label: `${s.nome} (${s.total})` }))} value={draft.subtemas} onChange={(v) => setDraft((d) => ({ ...d, subtemas: v }))} />
                  <MultiSelect label="Nível" options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))} value={draft.filters.niveis} onChange={(v) => setF('niveis', v)} />
                  <MultiSelect<QuestionType> label="Tipo" options={(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))} value={draft.filters.tipos} onChange={(v) => setF('tipos', v)} />
                  <MultiSelect<QuestionStyle> label="Estilo" options={(Object.keys(STYLE_LABELS) as QuestionStyle[]).map((s) => ({ value: s, label: STYLE_LABELS[s] }))} value={draft.filters.estilos} onChange={(v) => setF('estilos', v)} />
                  <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                    Situação
                    <Select aria-label="Situação" className="mt-1.5 h-9 w-full text-sm font-normal normal-case" value={draft.filters.status} onChange={(e) => setF('status', e.target.value as StatusFilter)}>
                      {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                    Quantidade
                    <Select aria-label="Quantidade" className="mt-1.5 h-9 w-full text-sm font-normal normal-case" value={draft.amount} onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value) }))}>
                      {AMOUNTS.map((n) => (
                        <option key={n} value={n}>
                          {amountLabel(n)}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                    Palavra-chave
                    <Input aria-label="Buscar" className="mt-1.5 h-9 w-full text-sm font-normal normal-case" value={draft.filters.busca} placeholder="ex.: LEFT JOIN, overfitting" onChange={(e) => setF('busca', e.target.value)} />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <p className="text-xs text-muted">{applied ? `${stats.answered} de ${loaded.length} respondidas em ${applied.tema} · ${stats.correctLast} certas · ${stats.wrongLast} erradas · ${stats.favorites} favoritas` : 'Nenhum filtro marcado = todas as questões do tema.'}</p>
                  <div className="flex gap-2 max-sm:w-full max-sm:[&>button]:flex-1">
                    <Button size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, subtemas: [], filters: EMPTY_FILTERS }))}>
                      Limpar filtros
                    </Button>
                    <Button size="sm" variant="primary" icon={<ListChecks className="size-4" aria-hidden />} onClick={bring}>
                      {applied ? 'Trazer novas questões' : 'Trazer questões'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {!applied ? (
              !filtersOpen && (
                <EmptyState
                  icon={<ListChecks className="size-8" aria-hidden />}
                  title="Monte a sua lista"
                  description="Abra os filtros, escolha o tema, os subtemas, o nível e a quantidade e clique em Trazer questões."
                  action={
                    <Button variant="primary" onClick={() => setFiltersOpen(true)}>
                      Escolher filtros
                    </Button>
                  }
                />
              )
            ) : (
              <section className={cn('flex min-w-0 flex-col gap-3', !filtersOpen && 'lg:h-[calc(100dvh-var(--app-top,4rem)-11.25rem)]')}>
                <Card className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-ink" aria-live="polite">
                      {loading ? 'Carregando questões…' : `${ordered.length.toLocaleString('pt-BR')} questão(ões)`}
                      {!loading && filtered.length > ordered.length && <span className="font-normal text-muted"> de {filtered.length.toLocaleString('pt-BR')} que passaram nos filtros</span>}
                      {!loading && current && <span className="font-normal text-muted"> · {answeredHere} respondidas</span>}
                    </p>
                    {!filtersOpen && (
                      <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted max-sm:hidden">
                        {summary.map((s, i) => (
                          <Badge key={i}>{s}</Badge>
                        ))}
                      </p>
                    )}
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
                  {!loading && ordered.length > 0 && <ProgressBar value={((pos + 1) / ordered.length) * 100} className="h-1" label="Posição na lista" />}
                </Card>

                {failed ? (
                  <EmptyState title="Não consegui carregar" description={String((failed.error as Error)?.message ?? 'Erro desconhecido.')} />
                ) : loading ? (
                  <Spinner />
                ) : !current ? (
                  <EmptyState title="Nenhuma questão com esses filtros" description="Tire algum filtro ou escolha outro subtema e clique em Trazer questões de novo." />
                ) : (
                  <>
                    <Card id="questao-atual" className="scroll-thin min-h-0 flex-1 lg:overflow-y-auto">
                      <QuestionCard key={current.id} q={current} number={pos + 1} chosen={chosen[current.id]} favorite={progress[current.id]?.[3] === 1} onAnswer={(k) => answer(current, k)} onFavorite={() => setProgress((p) => toggleFavorite(p, current.id))} />
                      {atEnd && answeredCurrent && (
                        <div className="flex flex-col gap-3 border-t border-line p-4 sm:flex-row sm:items-center sm:justify-between">
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
                        </div>
                      )}
                    </Card>
                    <nav aria-label="Navegar entre as questões" className="sticky bottom-0 grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-bg py-1 lg:static lg:py-0">
                      <Button icon={<ChevronLeft className="size-4" aria-hidden />} disabled={pos === 0} onClick={() => goTo(pos - 1)} className="justify-self-start">
                        Anterior
                      </Button>
                      <span className="tabular text-center text-sm text-muted">
                        Questão {pos + 1} de {ordered.length.toLocaleString('pt-BR')}
                        <span className="hidden text-xs sm:inline"> · setas ← →</span>
                      </span>
                      <Button variant={answeredCurrent ? 'primary' : 'secondary'} disabled={atEnd} onClick={() => goTo(pos + 1)} className="justify-self-end">
                        {answeredCurrent ? 'Próxima' : 'Pular'} <ChevronRight className="size-4" aria-hidden />
                      </Button>
                    </nav>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </QueryState>
    </div>
  )
}
