import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight, Code2, Copy, Database, Download, GitBranch, Lightbulb, Sparkles, TriangleAlert, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card, PageHeader, Progress, Segmented } from '@/components/ui/layout'
import { useToast } from '@/components/ui/feedback'
import { useLibrary } from '@/hooks/useLibrary'
import { CHALLENGES, LEVELS, TRACKS, type Challenge, type ChallengeLevel, type ChallengeTrack } from './catalog'
import { downloadJson, slugDate } from '@/lib/download'
import { challengeBackup, challengeStorageKey, nextUncompleted } from './progress'
import { useChallengeProgress } from './useChallengeProgress'

const TRACK_ICONS = { python: Code2, sql: Database, git: GitBranch }

async function copyText(text: string) {
  if (!navigator.clipboard?.writeText) throw new Error('Seu navegador não permite copiar automaticamente. Selecione e copie o texto manualmente.')
  await navigator.clipboard.writeText(text)
}

function ChallengePrompt({ text }: { text: string }) {
  return (
    <div className="mt-4 space-y-4">
      {text.split('\n\n').map((block, index) => /(?:^|\n)(?:CREATE TABLE|INSERT INTO|git |mkdir |printf )/.test(block)
        ? <pre key={index} className="overflow-x-auto rounded-xl border border-line bg-surface p-4 font-mono text-xs leading-6 text-ink"><code>{block}</code></pre>
        : <p key={index} className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">{block}</p>)}
    </div>
  )
}

function ChallengeEditor({ challenge, draft, completed, onDraft, onToggle, onNext, hasNext }: {
  challenge: Challenge
  draft: string
  completed: boolean
  onDraft: (value: string) => void
  onToggle: () => void
  onNext: () => void
  hasNext: boolean
}) {
  const toast = useToast()
  const [hintCount, setHintCount] = useState(0)
  const copy = async (text: string) => {
    try {
      await copyText(text)
      toast.success('Copiado para a área de transferência.')
    } catch (error) {
      toast.error(error)
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-line p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge className="bg-accent/10 text-accent-strong">{TRACKS.find((track) => track.value === challenge.track)?.label} · {LEVELS.find((level) => level.value === challenge.level)?.label}</Badge>
          <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => void copy(`${challenge.title}\n\n${challenge.prompt}\n\nCritérios de autoavaliação:\n${challenge.criteria.map((criterion) => `- ${criterion}`).join('\n')}\n\nPonto de partida:\n${challenge.starter}`)}>Copiar enunciado</Button>
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">{challenge.title}</h2>
        <ChallengePrompt text={challenge.prompt} />
      </div>
      <div className="space-y-6 p-5 sm:p-7">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={`draft-${challenge.id}`} className="text-sm font-semibold text-ink">Seu rascunho</label>
            <span className="text-[11px] text-muted">Rascunho por desafio · prática no seu ambiente</span>
          </div>
          <textarea id={`draft-${challenge.id}`} value={draft} onChange={(event) => onDraft(event.target.value)} spellCheck={false} autoCapitalize="off" autoComplete="off" className="min-h-64 w-full resize-y rounded-xl border border-line bg-surface p-4 font-mono text-sm leading-7 text-ink outline-none transition-colors focus:border-accent-strong focus:ring-2 focus:ring-accent/15" aria-describedby="draft-help" />
          <p id="draft-help" className="mt-2 text-xs leading-relaxed text-muted">Escreva sua tentativa aqui e pratique no seu editor, terminal ou banco de treino. Esta área não executa código nem comandos.</p>
        </div>

        <div className="rounded-xl border border-line bg-surface/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink"><Lightbulb className="size-4 text-accent-strong" aria-hidden />Uma ajuda para continuar</div>
            <Button size="sm" disabled={hintCount >= challenge.hints.length} onClick={() => setHintCount((count) => count + 1)}>{hintCount >= challenge.hints.length ? 'Todas as dicas abertas' : hintCount ? 'Próxima dica' : 'Mostrar dica'}</Button>
          </div>
          {hintCount > 0 && <ol className="mt-4 list-inside list-decimal space-y-2 text-sm leading-relaxed text-muted">{challenge.hints.slice(0, hintCount).map((hint, index) => <li key={index}>{hint}</li>)}</ol>}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Confira sua solução</h3>
          <p className="mt-1 text-xs text-muted">Use estes critérios para avaliar sua tentativa no seu ambiente.</p>
          <ul className="mt-3 space-y-2">{challenge.criteria.map((criterion) => <li key={criterion} className="flex items-start gap-2 text-sm text-muted"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden /><span>{criterion}</span></li>)}</ul>
        </div>

        <details className="group rounded-xl border border-line">
          <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent-strong">Ver solução comentada</summary>
          <div className="border-t border-line p-4">
            <p className="mb-3 text-xs leading-relaxed text-muted">Compare o raciocínio com sua tentativa. Outras soluções corretas também são válidas.</p>
            <pre className="overflow-x-auto rounded-lg bg-surface p-4 font-mono text-xs leading-6 text-ink"><code>{challenge.solution}</code></pre>
            <Button className="mt-3" size="sm" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => void copy(challenge.solution)}>Copiar solução</Button>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant={completed ? 'secondary' : 'primary'} aria-pressed={completed} icon={completed ? <Undo2 className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />} onClick={onToggle}>{completed ? 'Desmarcar conclusão' : 'Concluir por autoavaliação'}</Button>
          <Button disabled={!hasNext} icon={<ArrowRight className="size-4" aria-hidden />} onClick={onNext}>Próximo desafio</Button>
        </div>
      </div>
    </Card>
  )
}

function ChallengeWorkspace({ scope }: { scope: string }) {
  const { state, update, error } = useChallengeProgress(scope)
  const toast = useToast()

  const items = useMemo(() => CHALLENGES.filter((challenge) => challenge.track === state.track && challenge.level === state.level), [state.track, state.level])
  const selected = items.find((challenge) => challenge.id === state.selectedId) ?? items[0]
  const done = new Set(state.completed)
  const levelDone = items.filter((challenge) => done.has(challenge.id)).length
  const trackItems = CHALLENGES.filter((challenge) => challenge.track === state.track)
  const trackDone = trackItems.filter((challenge) => done.has(challenge.id)).length
  const next = nextUncompleted(items, state.completed, selected.id)
  const canAdvance = Boolean(next && next.id !== selected.id)
  const track = TRACKS.find((item) => item.value === state.track)!
  const chooseFilters = (track: ChallengeTrack, level: ChallengeLevel) => {
    const candidates = CHALLENGES.filter((challenge) => challenge.track === track && challenge.level === level)
    update({ track, level, selectedId: nextUncompleted(candidates, state.completed)?.id ?? candidates[0].id })
  }
  const selectNext = () => {
    if (next) update({ selectedId: next.id })
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
      <PageHeader title="Laboratório de desafios" description="Um passo de cada vez. Pratique Python, SQL e Git com exercícios do primeiro contato ao nível avançado." actions={<><Button icon={<Download className="size-4" aria-hidden />} onClick={exportProgress}>Exportar progresso e rascunhos</Button><Link to="/banco-de-questoes" className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface"><ArrowLeft className="size-4" aria-hidden />Banco de questões</Link></>} />
      <Card className="flex items-start gap-3 border-accent/20 bg-accent/5 p-4 sm:p-5">
        <BookOpen className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden />
        <p className="text-sm leading-relaxed text-muted">Escolha um nível, tente resolver e confira os critérios. A conclusão é por <span className="font-semibold text-ink">autoavaliação</span>. Rascunhos e progresso ficam neste navegador, separados por conta, sem sincronização com a nuvem. Use a exportação desta tela para fazer backup: estes dados não entram no backup global das Configurações.</p>
      </Card>
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm text-ink"><TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Sua jornada', value: `${done.size} / ${CHALLENGES.length}`, detail: 'desafios concluídos' },
          { label: track.label, value: `${trackDone} / ${trackItems.length}`, detail: 'nesta linguagem' },
          { label: LEVELS.find((level) => level.value === state.level)!.label, value: `${levelDone} / ${items.length}`, detail: 'neste nível' },
        ].map((stat) => <Card key={stat.label} className="p-5"><p className="text-xs font-medium text-muted">{stat.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">{stat.value}</p><p className="mt-1 text-xs text-muted">{stat.detail}</p></Card>)}
      </div>

      <Card className="space-y-5 p-4 sm:p-5">
        <div role="radiogroup" aria-label="Linguagem do desafio" className="grid gap-2 sm:grid-cols-3">
          {TRACKS.map((item) => {
            const Icon = TRACK_ICONS[item.value]
            return <button key={item.value} type="button" role="radio" aria-checked={state.track === item.value} onClick={() => chooseFilters(item.value, state.level)} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${state.track === item.value ? 'border-accent/40 bg-accent/10' : 'border-line bg-bg hover:bg-surface'}`}><Icon className="size-5 shrink-0 text-accent-strong" aria-hidden /><span><span className="block text-sm font-semibold text-ink">{item.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted">{item.description}</span></span></button>
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented value={state.level} onChange={(level) => chooseFilters(state.track, level)} options={LEVELS} label="Nível de dificuldade" />
          <Button icon={<Sparkles className="size-4" aria-hidden />} disabled={!canAdvance} onClick={selectNext}>Gerar próximo desafio</Button>
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-line p-5">
            <h2 className="text-sm font-semibold text-ink">Seu caminho neste nível</h2>
            <p className="mt-1 text-xs text-muted">{levelDone} de {items.length} concluídos</p>
            <Progress value={levelDone / items.length * 100} className="mt-3 h-1.5" label="Progresso no nível selecionado" />
          </div>
          <ol className="space-y-1 p-2">
            {items.map((challenge, index) => <li key={challenge.id}><button type="button" aria-current={selected.id === challenge.id ? 'step' : undefined} onClick={() => update({ selectedId: challenge.id })} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3.5 text-left transition-colors ${selected.id === challenge.id ? 'bg-accent/10 text-ink' : 'text-muted hover:bg-surface'}`}><span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${done.has(challenge.id) ? 'bg-accent text-accent-ink' : 'border border-line bg-bg'}`}>{done.has(challenge.id) ? <CheckCircle2 className="size-3.5" aria-label="Concluído" /> : String(index + 1).padStart(2, '0')}</span><span className="flex-1 text-sm leading-relaxed font-medium">{challenge.title}</span>{selected.id === challenge.id && <ChevronRight className="mt-1 size-3.5 shrink-0 text-accent-strong" aria-hidden />}</button></li>)}
          </ol>
          {levelDone === items.length && <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-accent-strong">Nível concluído. Continue em outro nível ou selecione um desafio para revisar.</p>}
        </Card>
        <ChallengeEditor key={selected.id} challenge={selected} draft={state.drafts[selected.id] ?? selected.starter} completed={done.has(selected.id)} hasNext={canAdvance} onDraft={(draft) => update({ drafts: { [selected.id]: draft } })} onToggle={() => update({ completed: { [selected.id]: !done.has(selected.id) } })} onNext={selectNext} />
      </div>
    </div>
  )
}

export default function ChallengesPage() {
  const { dbName } = useLibrary()
  return <ChallengeWorkspace key={dbName} scope={dbName} />
}
