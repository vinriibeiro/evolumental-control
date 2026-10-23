import { useEffect, useState } from 'react'
import { ClipboardList, X } from 'lucide-react'
import { useBackend } from '@/app/data'
import { fetchAll } from '@/hooks/data'
import { inList } from '@/lib/data/types'
import type { GameEvidence } from '@/types/db'
import type { SqlChallenge } from '../challenges'
import { WORLD } from '../content'
import { fieldChallenge } from '../content/fieldReview'
import { debrief, STAGE_LABELS, STAGE_WEIGHT, type ActivityResult, type Debrief, type HelpLevel } from '../engine/pedagogy'
import { Terminal } from './Terminal'

/** Atividades pedagógicas de uma missão (terminais das etapas e dos combates), na ordem. */
export function questActivities(questId: string): SqlChallenge[] {
  const out: SqlChallenge[] = []
  const add = (id: string | undefined) => {
    const ch = id ? WORLD.challenges[id] : undefined
    if (ch?.kind === 'sql' && ch.stage && !out.includes(ch)) out.push(ch)
  }
  for (const s of WORLD.quests[questId]?.steps ?? []) {
    if (s.objective.type !== 'solve') continue
    const enc = WORLD.encounters[s.objective.challenge]
    if (enc) for (const a of enc.actions) add(a.kind === 'terminal' ? a.challenge : undefined)
    else add(s.objective.challenge)
  }
  return out
}

/** A tentativa mais recente de cada atividade, preferindo a que foi resolvida. */
export function latestResults(activities: SqlChallenge[], rows: GameEvidence[]): ActivityResult[] {
  const out: ActivityResult[] = []
  for (const ch of activities) {
    const mine = rows.filter((r) => r.activity_id === ch.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
    const r = mine.find((x) => x.solved) ?? mine[0]
    if (!r) continue
    out.push({ activity: ch.id, title: ch.title, stage: r.stage, concept: r.concept, help: r.help_level as HelpLevel, attempts: r.attempts, solved: r.solved })
  }
  return out
}

const HELP = ['sem pistas', '1 pista', '2 pistas', '3 pistas', 'explicação completa']

/**
 * Relatório de campo (debrief) de uma missão de aprendizagem: o que aprendeu,
 * o que aplicou sozinho, onde teve dificuldade e o que vale revisar. Nada é
 * agendado sozinho: o jogador escolhe praticar de novo.
 */
export function FieldReport({ quest, onField, onNavigate, onClose }: { quest: string; onField: (() => void) | null; onNavigate: (to: string) => void; onClose: () => void }) {
  const backend = useBackend()
  const activities = questActivities(quest)
  const [results, setResults] = useState<ActivityResult[] | null>(null)
  const [error, setError] = useState(false)
  const ids = activities.map((a) => a.id).join(',')

  useEffect(() => {
    let alive = true
    fetchAll(backend, 'game_evidence', { filters: [inList('activity_id', ids.split(','))] })
      .then((rows) => alive && setResults(latestResults(questActivities(quest), rows)))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [backend, ids, quest])

  const conceptName = (c: string) => Object.values(WORLD.lessons).find((l) => l.concept === c)?.conceptName ?? c
  const d: Debrief | null = results ? debrief(results, conceptName) : null
  const title = WORLD.quests[quest]?.title ?? 'Missão'

  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden" role="dialog" aria-modal aria-label={`Relatório de campo: ${title}`}>
      <header className="flex items-center gap-3 border-b-2 border-[var(--eq-edge-dark)] px-4 py-3">
        <ClipboardList className="size-5 text-[var(--eq-gold)]" aria-hidden />
        <h2 className="min-w-0 flex-1 truncate font-semibold tracking-wide">Relatório de campo · {title}</h2>
        <button className="eq-btn" onClick={onClose} aria-label="Fechar relatório" autoFocus>
          <X className="size-4" />
        </button>
      </header>
      <div className="space-y-4 overflow-y-auto p-4 text-sm leading-relaxed">
        {error && <p className="text-[var(--eq-bad)]">Não foi possível carregar o relatório agora.</p>}
        {!results && !error && <p className="text-[var(--eq-muted)]">Carregando…</p>}
        {d && results && (
          <>
            <Section title="O que você aprendeu">{d.learned.length ? d.learned.join(', ') : 'Nenhuma atividade registrada ainda.'}</Section>
            <Section title="Aplicou com pouca ou nenhuma ajuda">{d.applied.length ? d.applied.join(' · ') : 'Ainda nenhuma atividade sem ajuda — tudo bem, é para isso que a prática existe.'}</Section>
            {d.struggled.length > 0 && (
              <Section title="Onde houve dificuldade">
                <ul className="list-disc pl-5">
                  {d.struggled.map((s) => (
                    <li key={s.title}>
                      {s.title} — {s.why}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            <Section title="Vale revisar">{d.review.length ? d.review.join(', ') : 'Nada urgente. Uma revisão de campo daqui a alguns dias ajuda a fixar.'}</Section>

            <details className="rounded-md border border-[var(--eq-edge-dark)] p-3">
              <summary className="cursor-pointer font-semibold">Como isso conta no domínio do Control</summary>
              <p className="mt-2 text-[var(--eq-muted)]">
                XP e moedas vêm da história. O domínio vem só de como você resolveu: cada estágio tem um peso (guiada 1, independente 2, transferência 3, desafio integrado 4) e as pistas reduzem o crédito. Resolver depois da explicação completa
                conta como contato, não como domínio.
              </p>
              <ul className="mt-2 space-y-1">
                {results.map((r) => (
                  <li key={r.activity} className="flex flex-wrap justify-between gap-2">
                    <span>{r.title}</span>
                    <span className="text-[var(--eq-muted)]">
                      {STAGE_LABELS[r.stage]} (peso {STAGE_WEIGHT[r.stage]}) · {r.solved ? HELP[r.help] : 'não concluída'} · {r.attempts} tentativa(s)
                    </span>
                  </li>
                ))}
              </ul>
            </details>

            <div className="flex flex-wrap gap-2">
              {onField && (
                <button className="eq-btn eq-btn-primary" onClick={onField}>
                  Fazer uma revisão de campo
                </button>
              )}
              <button className="eq-btn" onClick={() => onNavigate('/')}>
                Ver o domínio no Control
              </button>
              <button className="eq-btn" onClick={onClose}>
                Voltar ao mundo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold tracking-wider text-[var(--eq-gold)] uppercase">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  )
}

/**
 * Revisão de campo: um exercício novo (semente aleatória) a cada abertura.
 * Gera evidência de domínio; não dá XP nem avança a história.
 */
export function FieldReview({ template, sound, onClose }: { template: string; sound: boolean; onClose: () => void }) {
  const [ch, setCh] = useState<SqlChallenge | null>(null)
  useEffect(() => {
    if (template !== 'field_groupby') return
    let alive = true
    const seed = 1 + Math.floor(Math.random() * 2_000_000_000)
    void fieldChallenge(seed).then((c) => alive && setCh(c))
    return () => {
      alive = false
    }
  }, [template])
  if (!ch) return <p className="eq-panel px-4 py-3 text-sm">Preparando a planilha…</p>
  return <Terminal challenge={ch} sound={sound} onSolved={() => true} onClose={onClose} />
}
