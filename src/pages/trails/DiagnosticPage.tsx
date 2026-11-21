// Diagnóstico de conhecimento de um pilar (opcional). Questões progressivas, com foco prático em SQL e Python.
// O resultado distingue o que foi DEMONSTRADO (2+ acertos, nenhum erro), o que tem evidência insuficiente,
// as lacunas e o que nem foi avaliado — e sugere por onde começar. Cada tentativa vira um registro novo.
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, Progress } from '@/components/ui/layout'
import { EmptyState, Spinner, useToast } from '@/components/ui/feedback'
import { questionsFor } from '@/content/dsDiagnostics'
import { topicByKey, trackByKey } from '@/content/dsTrail'
import type { DiagnosticQuestion, TrackDef, TrackKey } from '@/content/dsTypes'
import { invalidateTables, useAll } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { eq } from '@/lib/data/types'
import { dayKey, formatDayKey } from '@/lib/time'
import { scoreDiagnostic } from '@/lib/trail'
import { cn } from '@/lib/cn'
import { applyAssessment, saveAssessment } from '@/services/dsTrail'
import type { Assessment, AssessmentTopicResult } from '@/types/db'

const LEVELS = ['', 'Básico', 'Intermediário', 'Avançado']
const OUTCOME: Record<AssessmentTopicResult['outcome'], string> = { demonstrated: 'Demonstrado', partial: 'Evidência insuficiente', gap: 'Lacuna' }

/** Avaliação rápida: até duas questões por assunto (as de nível mais baixo), o mínimo para demonstrar um tópico. */
function quickSet(all: DiagnosticQuestion[]): DiagnosticQuestion[] {
  const seen = new Map<string, number>()
  return all.filter((q) => {
    const n = seen.get(q.topicKey) ?? 0
    seen.set(q.topicKey, n + 1)
    return n < 2
  })
}

export default function DiagnosticPage() {
  const { track: param } = useParams()
  const track = trackByKey(param as TrackKey)
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const history = useAll('assessments', { filters: [eq('track', param ?? '')], order: [{ column: 'taken_at', ascending: false }] }, { enabled: Boolean(track) })
  const all = useMemo(() => (track ? questionsFor(track.key) : []), [track])
  const [questions, setQuestions] = useState<DiagnosticQuestion[] | null>(null)
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<Record<string, number | null>>({})
  const [result, setResult] = useState<Assessment | null>(null)
  const [busy, setBusy] = useState(false)

  if (!track) return <EmptyState title="Pilar não encontrado" action={<Link to="/trilhas" className="text-sm font-medium text-ink underline">Voltar às trilhas</Link>} />

  const finish = async (answers: Record<string, number | null>) => {
    if (!questions) return
    const score = scoreDiagnostic(track, questions, answers)
    if (score.total === 0) return toast.info('Responda pelo menos uma questão para ver o resultado.')
    setBusy(true)
    try {
      const saved = await saveAssessment(backend, track.key, score)
      const applied = await applyAssessment(backend, score)
      setResult(saved)
      setQuestions(null)
      if (applied) toast.success(`${applied} tópico(s) marcado(s) como demonstrado(s) na trilha.`)
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['assessments', 'topics'])
    }
  }

  // ------------------------------------------------------------ em andamento
  if (questions) {
    const q = questions[index]
    const pick = chosen[q.id]
    const answered = q.id in chosen
    const last = index === questions.length - 1
    const go = (answers: Record<string, number | null>) => (last ? void finish(answers) : setIndex(index + 1))
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-3 text-xs text-muted">
          <span>
            Diagnóstico de {track.name} · questão {index + 1} de {questions.length}
          </span>
          <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => void finish(chosen)} disabled={busy}>
            Encerrar e ver resultado
          </button>
        </div>
        <Progress value={(index / questions.length) * 100} className="mb-5 h-1" label="Andamento do diagnóstico" />
        <Card className="p-5 sm:p-6">
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            {q.skill} · {LEVELS[q.level]} · {q.kind === 'practical' ? 'Prática' : 'Conceito'}
          </p>
          <h1 className="mt-2 text-base leading-relaxed font-medium text-ink">{q.prompt}</h1>
          {q.code && <pre className="scroll-thin mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[13px] leading-relaxed text-ink">{q.code}</pre>}
          <div role="radiogroup" aria-label="Alternativas" className="mt-4 grid gap-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={pick === i}
                onClick={() => setChosen({ ...chosen, [q.id]: i })}
                className={cn('flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors', pick === i ? 'border-ink bg-surface-2' : 'border-line hover:bg-surface-2')}
              >
                <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', pick === i ? 'border-ink bg-ink text-bg' : 'border-line text-muted')}>{String.fromCharCode(65 + i)}</span>
                <span className="min-w-0 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink">{opt}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
              Anterior
            </Button>
            <div className="flex gap-2">
              <Button
                icon={<CircleHelp className="size-4" />}
                disabled={busy}
                onClick={() => {
                  const next = { ...chosen, [q.id]: null }
                  setChosen(next)
                  go(next)
                }}
              >
                Não sei
              </Button>
              <Button variant="primary" disabled={!answered || pick == null} loading={busy} onClick={() => go(chosen)}>
                {last ? 'Ver resultado' : 'Próxima'}
              </Button>
            </div>
          </div>
        </Card>
        <p className="mt-3 text-center text-xs text-muted">As respostas certas aparecem só no final. "Não sei" é uma resposta honesta: mostra onde começar.</p>
      </div>
    )
  }

  // ------------------------------------------------------------ resultado
  if (result) return <ResultView track={track} assessment={result} all={all} onBack={() => setResult(null)} onOpenTopic={(k) => navigate(`/trilhas?pilar=${track.key}&topico=${k}`)} />

  // ------------------------------------------------------------ início
  const quick = quickSet(all)
  const begin = (set: DiagnosticQuestion[]) => {
    setChosen({})
    setIndex(0)
    setQuestions(set)
  }
  return (
    <div className="mx-auto max-w-2xl">
      <Link to={`/trilhas?pilar=${track.key}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Voltar para a trilha
      </Link>
      <PageHeader title={`Avaliar meu conhecimento em ${track.name}`} description="Opcional. Serve para não gastar tempo com o que você já domina e para encontrar lacunas reais." />
      <Card className="p-5 sm:p-6">
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> Questões do básico ao avançado{track.key === 'sql' || track.key === 'python' ? ', a maioria prática: ler código e escolher a consulta ou o trecho que resolve o problema.' : '.'}
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> Um assunto só é considerado demonstrado com pelo menos duas questões certas e nenhuma errada. A nota geral não decide nada sozinha.
          </li>
          <li className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> Você pode encerrar a qualquer momento e refazer depois. Cada tentativa fica no histórico.
          </li>
        </ul>
        {all.length === 0 ? (
          <p className="mt-5 text-sm text-muted">Ainda não há questões para este pilar.</p>
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => begin(quick)}>
              Avaliação rápida ({quick.length} questões)
            </Button>
            {all.length > quick.length && <Button onClick={() => begin(all)}>Avaliação completa ({all.length} questões)</Button>}
          </div>
        )}
      </Card>

      <h2 className="mt-8 mb-2 text-sm font-semibold text-ink">Histórico de avaliações</h2>
      {history.isPending ? (
        <Spinner />
      ) : (history.data ?? []).length === 0 ? (
        <p className="text-sm text-muted">Nenhuma avaliação feita ainda.</p>
      ) : (
        <HistoryList rows={history.data ?? []} onOpen={setResult} />
      )}
    </div>
  )
}

function HistoryList({ rows, onOpen }: { rows: Assessment[]; onOpen: (a: Assessment) => void }) {
  const { timezone } = useSettings()
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {rows.map((a) => (
        <li key={a.id}>
          <button type="button" onClick={() => onOpen(a)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
            <span className="min-w-0 flex-1 text-sm text-ink">{formatDayKey(dayKey(new Date(a.taken_at).getTime(), timezone), 'long')}</span>
            <span className="tabular text-sm font-semibold text-ink">
              {a.correct}/{a.total}
            </span>
            <span className="text-xs text-muted">{a.topics.filter((t) => t.outcome === 'demonstrated').length} demonstrado(s)</span>
            <ArrowRight className="size-4 text-muted" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  )
}

function ResultView({ track, assessment, all, onBack, onOpenTopic }: { track: TrackDef; assessment: Assessment; all: DiagnosticQuestion[]; onBack: () => void; onOpenTopic: (key: string) => void }) {
  const [review, setReview] = useState(false)
  const byId = useMemo(() => new Map(all.map((q) => [q.id, q])), [all])
  const skills = useMemo(() => {
    const m = new Map<string, { asked: number; correct: number }>()
    for (const a of assessment.answers) {
      const skill = byId.get(a.question_id)?.skill
      if (!skill) continue
      const cur = m.get(skill) ?? { asked: 0, correct: 0 }
      cur.asked++
      if (a.correct) cur.correct++
      m.set(skill, cur)
    }
    return [...m]
  }, [assessment.answers, byId])
  const assessed = new Set(assessment.topics.map((t) => t.topic_key))
  const demonstrated = assessment.topics.filter((t) => t.outcome === 'demonstrated')
  const gaps = assessment.topics.filter((t) => t.outcome === 'gap')
  const partial = assessment.topics.filter((t) => t.outcome === 'partial')
  const notAssessed = track.topics.filter((t) => !assessed.has(t.key))
  const start = assessment.start_key ? topicByKey(assessment.start_key) : undefined
  const title = (key: string) => topicByKey(key)?.title ?? key

  return (
    <div className="mx-auto max-w-3xl">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Diagnóstico de {track.name}
      </button>
      <PageHeader title="Resultado do diagnóstico" description={`${assessment.correct} de ${assessment.total} questões corretas. O que importa está abaixo: assunto por assunto.`} />

      <Card className="p-5">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Ponto de partida sugerido</p>
        {start ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-ink">{start.title}</p>
              <p className="mt-0.5 text-sm text-muted">
                {gaps.some((g) => g.topic_key === start.key) ? 'Primeira lacuna encontrada na ordem da trilha.' : partial.some((p) => p.topic_key === start.key) ? 'Primeiro assunto sem evidência suficiente.' : 'Primeiro assunto ainda não avaliado depois do que você demonstrou.'}
              </p>
            </div>
            <Button variant="primary" icon={<ArrowRight className="size-4" />} onClick={() => onOpenTopic(start.key)}>
              Ir para o tópico
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink">Tudo o que foi avaliado ficou demonstrado. Siga para os projetos práticos do pilar.</p>
        )}
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[13px] font-semibold text-ink">Desempenho por assunto</h2>
          <ul className="mt-3 space-y-2.5">
            {assessment.topics.map((t) => (
              <li key={t.topic_key} className="flex items-center gap-3 text-sm">
                <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', t.outcome === 'demonstrated' ? 'bg-ink text-bg' : t.outcome === 'gap' ? 'bg-accent text-accent-ink' : 'border border-dashed border-muted text-muted')} aria-hidden>
                  {t.outcome === 'demonstrated' ? <Check className="size-3" strokeWidth={3} /> : t.outcome === 'gap' ? <X className="size-3" strokeWidth={3} /> : <CircleHelp className="size-3" />}
                </span>
                <button type="button" className="min-w-0 flex-1 truncate text-left text-ink hover:underline" onClick={() => onOpenTopic(t.topic_key)}>
                  {title(t.topic_key)}
                </button>
                <span className="tabular shrink-0 text-xs text-muted">
                  {t.correct}/{t.asked} · {OUTCOME[t.outcome]}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="text-[13px] font-semibold text-ink">Desempenho por competência</h2>
          <ul className="mt-3 space-y-3">
            {skills.map(([skill, r]) => (
              <li key={skill}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-ink">{skill}</span>
                  <span className="tabular shrink-0 text-xs text-muted">
                    {r.correct}/{r.asked}
                  </span>
                </div>
                <Progress value={(r.correct / r.asked) * 100} className="mt-1 h-1" label={`${skill}: acertos`} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Summary title="Competências demonstradas" empty="Nenhum assunto com duas ou mais questões certas e nenhuma errada." items={demonstrated.map((t) => title(t.topic_key))} />
        <Summary title="Lacunas identificadas" empty="Nenhuma questão errada nos assuntos avaliados." items={gaps.map((t) => title(t.topic_key))} attention />
        <Summary title="Ainda não avaliado" empty="Todos os assuntos do pilar tiveram questões." items={[...partial.map((t) => `${title(t.topic_key)} (só 1 questão)`), ...notAssessed.map((t) => t.title)]} />
      </div>

      {gaps.length > 0 && (
        <Card className="mt-5 p-5">
          <h2 className="text-[13px] font-semibold text-ink">Conteúdos recomendados</h2>
          <p className="mt-1 text-xs text-muted">Na ordem da trilha. Cada tópico traz objetivo, material e exercício prático.</p>
          <ol className="mt-3 space-y-1.5">
            {gaps.map((t, i) => (
              <li key={t.topic_key} className="flex items-center gap-2 text-sm">
                <span className="tabular w-5 shrink-0 text-xs text-muted">{i + 1}.</span>
                <button type="button" className="min-w-0 flex-1 truncate text-left font-medium text-ink hover:underline" onClick={() => onOpenTopic(t.topic_key)}>
                  {title(t.topic_key)}
                </button>
                <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden />
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card className="mt-5">
        <button type="button" onClick={() => setReview((r) => !r)} aria-expanded={review} className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[13px] font-semibold text-ink">
          Questões corretas e incorretas
          <ChevronDown className={cn('size-4 text-muted transition-transform', review && 'rotate-180')} aria-hidden />
        </button>
        {review && (
          <ol className="divide-y divide-line border-t border-line">
            {assessment.answers.map((a, i) => {
              const q = byId.get(a.question_id)
              if (!q) return null
              return (
                <li key={a.question_id} className="px-5 py-4 text-sm">
                  <p className="flex items-start gap-2 font-medium text-ink">
                    <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full', a.correct ? 'bg-ink text-bg' : 'bg-accent text-accent-ink')} aria-label={a.correct ? 'Correta' : 'Incorreta'}>
                      {a.correct ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" strokeWidth={3} />}
                    </span>
                    <span>
                      {i + 1}. {q.prompt}
                    </span>
                  </p>
                  {q.code && <pre className="scroll-thin mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs leading-relaxed text-ink">{q.code}</pre>}
                  <p className="mt-2 text-xs text-muted">
                    Sua resposta: <span className="font-mono text-ink">{a.chosen == null ? 'Não sei' : q.options[a.chosen]}</span>
                  </p>
                  {!a.correct && (
                    <p className="mt-1 text-xs text-muted">
                      Correta: <span className="font-mono text-ink">{q.options[q.answer]}</span>
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-ink">{q.explanation}</p>
                </li>
              )
            })}
          </ol>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to={`/trilhas?pilar=${track.key}`} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-bg hover:opacity-85">
          Voltar para a trilha
        </Link>
        <Button onClick={onBack}>Refazer ou ver histórico</Button>
      </div>
    </div>
  )
}

function Summary({ title, items, empty, attention }: { title: string; items: string[]; empty: string; attention?: boolean }) {
  return (
    <Card className="p-5">
      <h2 className="flex items-center justify-between gap-2 text-[13px] font-semibold text-ink">
        {title}
        <span className={cn('tabular text-xs', attention && items.length ? 'text-accent' : 'text-muted')}>{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-ink">
          {items.slice(0, 12).map((it) => (
            <li key={it} className="truncate">
              {it}
            </li>
          ))}
          {items.length > 12 && <li className="text-xs text-muted">+{items.length - 12}</li>}
        </ul>
      )}
    </Card>
  )
}
