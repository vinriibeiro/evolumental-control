import { BookOpen, Check, Crown, Hand, PenLine, X } from 'lucide-react'
import { useAll } from '@/hooks/data'
import { eq } from '@/lib/data/types'
import { nextUnitStep, unitReport, type StageStats, type UnitStep } from '@/game/engine/stages'
import type { Unit } from '@/game/types'
import { STAGE_LABELS } from '../engine/pedagogy'

interface Props {
  subject: string
  subjectName: string
  unit: Unit
  index: number
  onNavigate: (to: string) => void
  onClose: () => void
}

const pct = (s: StageStats) => (s.answered ? `${Math.round((100 * s.correct) / s.answered)}%` : '—')

/**
 * Prédio de uma cidade gerada: a unidade como sequência pedagógica (lição →
 * prática guiada → prática sozinho → desafio integrado), com o próximo passo
 * recomendado e o motivo, e o relatório da unidade. As respostas são as do
 * modo clássico, corrigidas no servidor; vencer o chefe cumpre a etapa da cidade.
 */
export function UnitHub({ subject, subjectName, unit, index, onNavigate, onClose }: Props) {
  const answers = useAll('game_answers', { filters: [eq('subject_id', subject)] })
  const ids = new Set(unit.challenges.map((c) => c.id))
  const report = answers.data ? unitReport(unit, answers.data.filter((a) => ids.has(a.challenge_id))) : null
  const next = report ? nextUnitStep(report) : null
  const back = `${unit.id}&volta=mundo`
  const steps: Array<{ id: UnitStep; label: string; detail: string; icon: typeof BookOpen; to: string; stats?: StageStats }> = [
    { id: 'lesson', label: 'Lição', detail: 'Entender: explicação curta e exemplos.', icon: BookOpen, to: `/evoquest/${subject}/licao/${unit.id}?volta=mundo` },
    { id: 'guided', label: STAGE_LABELS.guided, detail: 'Reconhecer: escolher, associar, ordenar — com dica disponível.', icon: Hand, to: `/evoquest/jogar?s=${subject}&m=trail&u=${back}&min=6&etapa=guiada`, stats: report?.stages.guided },
    { id: 'independent', label: STAGE_LABELS.independent, detail: 'Produzir a resposta: escrever, calcular, completar.', icon: PenLine, to: `/evoquest/jogar?s=${subject}&m=trail&u=${back}&min=8&etapa=sozinho`, stats: report?.stages.independent },
    { id: 'boss', label: `${STAGE_LABELS.boss} (chefe)`, detail: 'Tudo junto, sem dica. Vencer cumpre a etapa da cidade.', icon: Crown, to: `/evoquest/jogar?s=${subject}&m=boss&u=${back}`, stats: report?.stages.boss },
  ]
  const target = next?.step === 'review' ? 'independent' : next?.step

  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden" role="dialog" aria-modal aria-label={`Prédio: ${unit.title}`}>
      <header className="flex items-center gap-3 border-b-2 border-[var(--eq-edge-dark)] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider text-[var(--eq-muted)] uppercase">
            {subjectName} · unidade {index + 1}
          </p>
          <h2 className="truncate font-semibold tracking-wide">{unit.title}</h2>
        </div>
        <button className="eq-btn" onClick={onClose} aria-label="Fechar" autoFocus>
          <X className="size-4" />
        </button>
      </header>
      <div className="space-y-4 overflow-y-auto p-4 text-sm leading-relaxed">
        <p className="text-[var(--eq-muted)]">{unit.summary}</p>
        {next && (
          <p role="status" className="rounded-md border-l-4 border-[var(--eq-gold)] bg-[#2a2112] px-3 py-2">
            <span className="font-semibold">Próximo passo: </span>
            {next.reason}
          </p>
        )}
        <ol className="space-y-2">
          {steps.map((s, i) => {
            const recommended = s.id === target
            const done = s.id === 'boss' ? report?.bossWon : s.stats ? s.stats.answered >= 4 && s.stats.correct / s.stats.answered >= 0.7 : false
            return (
              <li key={s.id}>
                <button
                  className={`eq-btn h-auto w-full items-start justify-start gap-3 py-2 text-left ${recommended ? 'eq-btn-primary' : ''}`}
                  onClick={() => onNavigate(s.to)}
                  aria-describedby={`unit-step-${s.id}`}
                >
                  <s.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {i + 1}. {s.label}
                      {recommended && <span className="ml-2 text-xs font-normal">(recomendado)</span>}
                    </span>
                    <span id={`unit-step-${s.id}`} className="block text-xs font-normal opacity-80">
                      {s.detail}
                      {s.stats && s.stats.answered > 0 && ` · ${s.stats.answered} resposta(s), acerto ${pct(s.stats)}, ${s.stats.clean} sem ajuda`}
                    </span>
                  </span>
                  {done && <Check className="mt-0.5 size-4 shrink-0 text-[var(--eq-good)]" aria-label="Concluída" />}
                </button>
              </li>
            )
          })}
        </ol>
        {report && (report.weak.length > 0 || report.bossWon) && (
          <section>
            <h3 className="text-xs font-semibold tracking-wider text-[var(--eq-gold)] uppercase">Relatório da unidade</h3>
            {report.bossWon && <p className="mt-1">Chefe vencido: a unidade conta para a cidade.</p>}
            {report.weak.length > 0 && (
              <p className="mt-1">
                Vale revisar: {report.weak.map((w) => `${w.name} (${w.accuracy}% em ${w.answered})`).join(' · ')}.
              </p>
            )}
          </section>
        )}
        <p className="text-xs text-[var(--eq-muted)]">
          XP e moedas vêm do jogo. Para o domínio no Control, produzir a resposta pesa o dobro de reconhecer, o chefe pesa 4× e dica ou nova tentativa reduzem o crédito.
        </p>
      </div>
    </div>
  )
}
