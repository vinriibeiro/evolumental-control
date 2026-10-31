import { useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Save, Shuffle, Star } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { Button } from '@/components/ui/Button'
import { Checkbox, Input, Select } from '@/components/ui/Field'
import { Badge, Card, PageHeader } from '@/components/ui/layout'
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

const PAGE_SIZE = 10
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}/questoes/${path}`)
  if (!res.ok) throw new Error(`Não consegui carregar as questões (${res.status}).`)
  return (await res.json()) as T
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
    <Card className="p-4">
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
      <ul className="mt-3 space-y-1.5">
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
                  'flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
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
        <div role="status" className="mt-3 rounded-lg bg-surface p-3">
          <p className={cn('mb-1 text-sm font-semibold', chosen === q.gabarito ? 'text-success' : 'text-danger')}>{chosen === q.gabarito ? 'Você acertou!' : `Você errou. A resposta é ${q.gabarito}.`}</p>
          <p className="text-sm whitespace-pre-wrap text-ink">{q.explicacao}</p>
        </div>
      )}
    </Card>
  )
}

export default function QuestionBankPage() {
  const auth = useAuth()
  const settings = useSettings()
  const toast = useToast()
  const insert = useInsert('question_records')
  const scope = auth.mode === 'supabase' ? (auth.user?.id ?? 'anon') : 'local'

  const index = useQuery({ queryKey: ['qbank', 'index'], queryFn: () => getJson<BankIndex>('index.json'), staleTime: Infinity })
  const [tema, setTema] = useState<string>('')
  const [subtemas, setSubtemas] = useState<string[]>([])
  const [filters, setFilters] = useState<BankFilters>(EMPTY_FILTERS)
  const [progress, setProgress] = useState<Progress>(() => loadProgress(scope))
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const [session, setSession] = useState({ total: 0, correct: 0 })
  const [page, setPage] = useState(0)
  const [seed, setSeed] = useState(0)

  useEffect(() => setProgress(loadProgress(scope)), [scope])
  useEffect(() => saveProgress(scope, progress), [scope, progress])

  const theme = index.data?.temas.find((t) => t.tema === tema) ?? index.data?.temas[0]
  const activeSubs = useMemo(() => (theme ? (subtemas.length ? theme.subtemas.filter((s) => subtemas.includes(s.nome)) : theme.subtemas) : []), [theme, subtemas])
  const shards = useQueries({
    queries: activeSubs.map((s) => ({ queryKey: ['qbank', theme?.prefixo, s.arquivo], queryFn: () => getJson<BankQuestion[]>(`${theme?.prefixo}/${s.arquivo}`), staleTime: Infinity })),
  })
  const loading = shards.some((s) => s.isPending)
  const failed = shards.find((s) => s.isError)
  const loaded = useMemo(() => shards.flatMap((s) => s.data ?? []), [shards])

  // A lista só muda quando os filtros mudam (responder uma questão não a tira da tela).
  const [frozen, setFrozen] = useState<{ ids: string[] } | null>(null)
  const filtered = useMemo(() => filterQuestions(loaded, filters, progress), [loaded, filters]) // eslint-disable-line react-hooks/exhaustive-deps
  const filteredKey = filtered.map((q) => q.id).join(',')
  useEffect(() => {
    setFrozen({ ids: (seed ? shuffled(filtered) : filtered).map((q) => q.id) })
    setPage(0)
  }, [filteredKey, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(loaded.map((q) => [q.id, q])), [loaded])
  const ordered = useMemo(() => (frozen?.ids ?? []).map((id) => byId.get(id)).filter((q): q is BankQuestion => Boolean(q)), [frozen, byId])
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE))
  const visible = ordered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const stats = summarizeProgress(progress, loaded.map((q) => q.id))

  const setF = <K extends keyof BankFilters>(k: K, v: BankFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))

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
      await insert.mutateAsync({ subject_id: null, topic_id: null, date: todayKey(settings.timezone), total: session.total, correct: session.correct, wrong: session.total - session.correct, board: null, exam: null, source: 'Banco de questões', notes: sessionNote(theme?.tema ?? '', subtemas, session.total) })
      toast.success(`${session.total} questão(ões) salvas em Desempenho.`)
      setSession({ total: 0, correct: 0 })
    } catch (e) {
      toast.error(e)
    }
  }

  const changeTheme = (t: string) => {
    setTema(t)
    setSubtemas([])
    setChosen({})
  }

  return (
    <div>
      <PageHeader title="Banco de questões" description="Escolha o tema, o nível e o estilo; responda e veja o gabarito comentado na hora. O progresso fica salvo neste aparelho." />
      <QueryState query={index}>
        {!theme ? (
          <EmptyState title="Banco vazio" description="Nenhuma questão foi carregada ainda." />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <Card className="space-y-4 p-4">
                <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                  Tema
                  <Select aria-label="Tema" className="mt-1.5 w-full text-sm font-normal normal-case" value={theme.tema} onChange={(e) => changeTheme(e.target.value)}>
                    {index.data!.temas.map((t) => (
                      <option key={t.tema} value={t.tema}>
                        {t.tema} ({t.total.toLocaleString('pt-BR')})
                      </option>
                    ))}
                  </Select>
                </label>
                <fieldset>
                  <legend className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">Subtemas</legend>
                  <div className="flex flex-col gap-1.5">
                    {theme.subtemas.map((s) => (
                      <Checkbox key={s.nome} label={`${s.nome} (${s.total})`} checked={subtemas.includes(s.nome)} onChange={(e) => setSubtemas(e.target.checked ? [...subtemas, s.nome] : subtemas.filter((x) => x !== s.nome))} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted">{subtemas.length ? 'Só os marcados.' : 'Nenhum marcado = todos.'}</p>
                </fieldset>
                <Chips label="Nível" value={filters.niveis} onChange={(v) => setF('niveis', v)} options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))} />
                <Chips<QuestionType> label="Tipo" value={filters.tipos} onChange={(v) => setF('tipos', v)} options={(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))} />
                <Chips<QuestionStyle> label="Estilo" value={filters.estilos} onChange={(v) => setF('estilos', v)} options={(Object.keys(STYLE_LABELS) as QuestionStyle[]).map((s) => ({ value: s, label: STYLE_LABELS[s] }))} />
                <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                  Situação
                  <Select aria-label="Situação" className="mt-1.5 w-full text-sm font-normal normal-case" value={filters.status} onChange={(e) => setF('status', e.target.value as StatusFilter)}>
                    {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
                  Buscar no enunciado
                  <Input aria-label="Buscar" className="mt-1.5 w-full text-sm font-normal normal-case" value={filters.busca} placeholder="ex.: LEFT JOIN, janela, NULL" onChange={(e) => setF('busca', e.target.value)} />
                </label>
                <Button size="sm" variant="ghost" onClick={() => (setFilters(EMPTY_FILTERS), setSubtemas([]))}>
                  Limpar filtros
                </Button>
              </Card>
              <Card className="p-4 text-sm">
                <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Seu progresso neste tema</p>
                <p className="text-ink">
                  {stats.answered} de {loaded.length} respondidas · {stats.correctLast} certas · {stats.wrongLast} erradas · {stats.favorites} favoritas
                </p>
              </Card>
            </aside>

            <section className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-ink" aria-live="polite">
                  {loading ? 'Carregando questões…' : `${ordered.length.toLocaleString('pt-BR')} questão(ões)`}
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

              {failed ? (
                <EmptyState title="Não consegui carregar" description={String((failed.error as Error)?.message ?? 'Erro desconhecido.')} />
              ) : loading ? (
                <Spinner />
              ) : ordered.length === 0 ? (
                <EmptyState title="Nenhuma questão com esses filtros" description="Tire algum filtro ou escolha outro subtema." />
              ) : (
                <>
                  {visible.map((q, i) => (
                    <QuestionCard key={q.id} q={q} number={page * PAGE_SIZE + i + 1} chosen={chosen[q.id]} favorite={progress[q.id]?.[3] === 1} onAnswer={(k) => answer(q, k)} onFavorite={() => setProgress((p) => toggleFavorite(p, q.id))} />
                  ))}
                  <div className="flex items-center justify-between gap-2">
                    <Button size="sm" icon={<ChevronLeft className="size-4" />} disabled={page === 0} onClick={() => setPage(page - 1)}>
                      Anterior
                    </Button>
                    <span className="text-sm text-muted">
                      Página {page + 1} de {pages}
                    </span>
                    <Button size="sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                      Próxima <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </QueryState>
    </div>
  )
}
