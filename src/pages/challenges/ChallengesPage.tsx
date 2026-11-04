import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Code2, Database, Download, GitBranch, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { useToast } from '@/components/ui/feedback'
import { useLibrary } from '@/hooks/useLibrary'
import { CHALLENGES, LEVELS, TRACKS, type ChallengeLevel, type ChallengeTrack } from './catalog'
import { downloadJson, slugDate } from '@/lib/download'
import { challengeBackup, challengeStorageKey } from './progress'
import { useChallengeProgress } from './useChallengeProgress'
import { ExercisePractice } from './ExercisePractice'
import { ReviewPanel } from './ReviewPanel'
import { buildReviewQueue, isOpen, withMiss, withResolution, type ReviewItem } from './review'
import { variationFor } from './variations'

const TRACK_ICONS = { python: Code2, sql: Database, git: GitBranch }
const LEVEL_GOALS: Record<ChallengeTrack, Record<ChallengeLevel, string>> = {
  python: {
    first_steps: 'Saída, entrada, texto e primeiras contas.',
    basic: 'Decisões, laços, listas e funções reutilizáveis.',
    intermediate: 'Estruturas de dados, arquivos, exceções e validação.',
    advanced: 'Modelagem, geradores, concorrência e testes de comportamento.',
  },
  sql: {
    first_steps: 'Ler tabelas, escolher colunas, filtrar e ordenar linhas.',
    basic: 'Resumir dados com agregações, grupos e filtros.',
    intermediate: 'Cruzar tabelas, preservar relações ausentes e usar subconsultas.',
    advanced: 'Analisar séries e rankings, percorrer hierarquias e proteger transações.',
  },
  git: {
    first_steps: 'Inicializar, inspecionar, preparar e registrar o primeiro commit.',
    basic: 'Ler mudanças, controlar o escopo e integrar branches.',
    intermediate: 'Resolver conflitos, guardar trabalho e colaborar com segurança.',
    advanced: 'Escolher commits, reaplicar mudanças, investigar e recuperar trabalho.',
  },
}

function ChallengeWorkspace({ scope }: { scope: string }) {
  const { state, update, error } = useChallengeProgress(scope)
  const toast = useToast()
  const lesson = useRef<HTMLDivElement>(null)

  const items = useMemo(() => CHALLENGES.filter((challenge) => challenge.track === state.track && challenge.level === state.level), [state.track, state.level])
  const selected = items.find((challenge) => challenge.id === state.selectedId) ?? items[0]
  const done = new Set(state.verified)
  const levelDone = items.filter((challenge) => done.has(challenge.id)).length
  const trackItems = CHALLENGES.filter((challenge) => challenge.track === state.track)
  const trackDone = trackItems.filter((challenge) => done.has(challenge.id)).length
  const firstPending = trackItems.find((challenge) => !done.has(challenge.id))
  const next = trackItems.slice(trackItems.indexOf(selected) + 1).find((challenge) => !done.has(challenge.id)) ?? firstPending
  const track = TRACKS.find((item) => item.value === state.track)!
  // Conceito cuja variação de revisão está aberta; a navegação normal fecha a revisão.
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [reviewPassed, setReviewPassed] = useState<string[]>([])
  const variation = reviewing ? variationFor(reviewing) : undefined
  const queue = useMemo(() => buildReviewQueue({ reviews: state.reviews, drafts: state.drafts, verified: state.verified }), [state.reviews, state.drafts, state.verified])
  const go = (patch: Parameters<typeof update>[0]) => {
    setReviewing(null)
    update(patch)
  }
  const focusLesson = () => requestAnimationFrame(() => {
    lesson.current?.scrollIntoView({ block: 'start' })
    lesson.current?.querySelector('h2')?.focus({ preventScroll: true })
  })
  const chooseFilters = (track: ChallengeTrack, level?: ChallengeLevel) => {
    const candidates = CHALLENGES.filter((challenge) => challenge.track === track && (!level || challenge.level === level))
    const target = candidates.find((challenge) => !done.has(challenge.id)) ?? candidates[0]
    go({ track, level: target.level, selectedId: target.id })
  }
  const selectNext = () => {
    if (!next || next.id === selected.id) return
    go({ level: next.level, selectedId: next.id })
    focusLesson()
  }
  const retry = (item: ReviewItem) => {
    if (item.variation) setReviewing(item.id)
    else go({ track: item.challenge.track, level: item.challenge.level, selectedId: item.id })
    focusLesson()
  }
  const dismiss = (item: ReviewItem) => update({ reviews: { [item.id]: withResolution(state.reviews[item.id]) } })
  const missed = (id: string) => update({ reviews: { [id]: withMiss(state.reviews[id]) } })
  const passedOriginal = (id: string) => {
    const record = state.reviews[id]
    // Sem variação, repetir o original é a única forma de encerrar a pendência.
    update({ verified: { [id]: true }, ...(record && isOpen(record) && !variationFor(id) ? { reviews: { [id]: withResolution(record) } } : {}) })
  }
  const exportProgress = () => {
    try {
      let legacy: string | null = null
      try { legacy = localStorage.getItem(challengeStorageKey(scope)) } catch { /* Exporta o estado em memória mesmo se o armazenamento estiver bloqueado. */ }
      downloadJson(challengeBackup(state, legacy), `vlm-desafios-${slugDate()}.json`)
    } catch (cause) {
      toast.error(cause)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Laboratório de desafios" description="Trilhas práticas de Python, SQL e Git, do primeiro comando aos exercícios avançados." actions={<><Button icon={<Download className="size-4" aria-hidden />} onClick={exportProgress}>Exportar progresso e rascunhos</Button><Link to="/banco-de-questoes" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface"><ArrowLeft className="size-4" aria-hidden />Banco de questões</Link></>} />
      <Card className="flex items-start gap-3 border-accent/20 bg-accent/5 p-4 sm:p-5">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden />
        <p className="text-sm leading-relaxed text-muted">Estude o exemplo, resolva a prática e clique em <strong className="text-ink">Testar solução</strong>. Cada aprovação conta para a trilha e indica o próximo exercício. Os rascunhos e o progresso ficam neste navegador e podem ser exportados.</p>
      </Card>
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm text-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Sua jornada', value: `${done.size} / ${CHALLENGES.length}`, detail: 'práticas aprovadas' },
          { label: track.label, value: `${trackDone} / ${trackItems.length}`, detail: 'nesta linguagem' },
          { label: LEVELS.find((level) => level.value === state.level)!.label, value: `${levelDone} / ${items.length}`, detail: 'neste nível' },
        ].map((stat) => <Card key={stat.label} className="p-5"><p className="text-xs font-medium text-muted">{stat.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">{stat.value}</p><p className="mt-1 text-xs text-muted">{stat.detail}</p></Card>)}
      </div>

      <Card className="space-y-5 p-4 sm:p-5">
        <div role="radiogroup" aria-label="Linguagem do desafio" className="grid gap-2 sm:grid-cols-3">
          {TRACKS.map((item) => {
            const Icon = TRACK_ICONS[item.value]
            return <button key={item.value} type="button" role="radio" aria-checked={state.track === item.value} onClick={() => chooseFilters(item.value)} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${state.track === item.value ? 'border-accent/40 bg-accent/10' : 'border-line bg-bg hover:bg-surface'}`}><Icon className="size-5 shrink-0 text-accent-strong" aria-hidden /><span><span className="block text-sm font-semibold text-ink">{item.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{item.description}</span></span></button>
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented value={state.level} onChange={(level) => chooseFilters(state.track, level)} options={LEVELS} label="Nível de dificuldade" />
          {firstPending && firstPending.id !== selected.id && <Button icon={<ArrowRight className="size-4" aria-hidden />} onClick={() => go({ level: firstPending.level, selectedId: firstPending.id })}>Retomar trilha</Button>}
        </div>
        <p className="text-sm text-muted">{LEVEL_GOALS[state.track][state.level]}</p>
      </Card>

      <ReviewPanel items={queue} activeId={reviewing} onRetry={retry} onDismiss={dismiss} />

      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="text-sm font-semibold text-ink">Seu caminho neste nível</h2>
            <p className="mt-1 text-xs text-muted">{levelDone} de {items.length} concluídos</p>
            <Progress value={levelDone / items.length * 100} className="mt-3 h-1.5" label="Progresso no nível selecionado" />
          </div>
          <ol className="space-y-1 p-2">
            {items.map((challenge, index) => <li key={challenge.id}><button type="button" aria-current={selected.id === challenge.id ? 'step' : undefined} onClick={() => go({ selectedId: challenge.id })} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3.5 text-left transition-colors ${selected.id === challenge.id ? 'bg-accent/10 text-ink' : 'text-muted hover:bg-surface'}`}><span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done.has(challenge.id) ? 'bg-accent text-accent-ink' : 'border border-line bg-bg'}`}>{done.has(challenge.id) ? <CheckCircle2 className="size-3.5" aria-label="Concluído" /> : String(index + 1).padStart(2, '0')}</span><span className="flex-1 text-sm leading-relaxed font-medium">{challenge.title}</span>{selected.id === challenge.id && <ChevronRight className="mt-1 size-3.5 shrink-0 text-accent-strong" aria-hidden />}</button></li>)}
          </ol>
          {levelDone === items.length && <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-accent-strong">Nível concluído. Continue pela próxima etapa ou revise uma prática.</p>}
        </Card>
        <div ref={lesson} className="min-w-0 scroll-mt-24">
          {variation ? <ExercisePractice
            key={variation.id}
            challenge={variation}
            draft={state.reviewDrafts[variation.id] ?? variation.starter}
            verified={reviewPassed.includes(variation.id)}
            legacyDone={false}
            nextLabel="Voltar à trilha"
            notice={<p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-ink"><strong>Revisão do conceito: {variation.concept}.</strong> Este exercício usa outros dados e outro contexto que o original “{CHALLENGES.find((item) => item.id === variation.baseId)?.title}”. Seu progresso e seu rascunho originais não são alterados.</p>}
            onDraft={(draft) => update({ reviewDrafts: { [variation.id]: draft } })}
            onFailed={() => missed(variation.baseId)}
            onPassed={() => {
              setReviewPassed((ids) => [...new Set([...ids, variation.id])])
              update({ reviews: { [variation.baseId]: withResolution(state.reviews[variation.baseId]) } })
              toast.success(`Conceito revisado: ${variation.concept}.`)
            }}
            onNext={() => setReviewing(null)}
          /> : <ExercisePractice
            key={selected.id}
            challenge={selected}
            draft={state.drafts[selected.id] ?? selected.starter}
            verified={done.has(selected.id)}
            legacyDone={state.completed.includes(selected.id)}
            nextTitle={next?.id !== selected.id ? next?.title : undefined}
            onDraft={(draft) => update({ drafts: { [selected.id]: draft } })}
            onFailed={() => missed(selected.id)}
            onPassed={() => passedOriginal(selected.id)}
            onNext={selectNext}
          />}
        </div>
      </div>
    </div>
  )
}

export default function ChallengesPage() {
  const { dbName } = useLibrary()
  return <ChallengeWorkspace key={dbName} scope={dbName} />
}
