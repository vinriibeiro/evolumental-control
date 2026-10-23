import { useState } from 'react'
import { BookOpen, Building2, Hammer, Layers, Timer, X } from 'lucide-react'
import { functionFor, LEVELS, LOT_COUNT, levelFor } from '../content/myCity'
import type { MasteryLevel } from '@/lib/insight/mastery'

export interface CitySubject {
  id: string
  name: string
  color: string
}

interface Props {
  lots: Array<string | null>
  subjects: CitySubject[]
  /** Segundos líquidos estudados por matéria. */
  seconds: Map<string, number>
  /** Domínio da matéria no Control (funcionamento do prédio). */
  mastery?: Map<string, { value: number; level: MasteryLevel }>
  /** Lote aberto pela placa; null = prefeitura (todos os lotes). */
  focus: number | null
  onAssign: (lot: number, subjectId: string | null) => void
  onNavigate: (to: string) => void
  onClose: () => void
}

const hours = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`
}

/** Prefeitura da Minha Cidade: cada lote recebe uma matéria; o prédio cresce com as horas estudadas. */
export function MyCityPanel({ lots, subjects, seconds, mastery, focus, onAssign, onNavigate, onClose }: Props) {
  const [open, setOpen] = useState<number | null>(focus)
  const byId = new Map(subjects.map((s) => [s.id, s]))
  const all = Array.from({ length: LOT_COUNT }, (_, i) => lots[i] ?? null)
  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden" role="dialog" aria-modal aria-label="Prefeitura da Minha Cidade">
      <header className="flex items-center gap-2 border-b-2 border-[var(--eq-edge-dark)] p-3">
        <Building2 className="size-5 text-[var(--eq-gold)]" aria-hidden />
        <div className="flex-1">
          <h2 className="font-semibold">{open == null ? 'Prefeitura · planta da cidade' : `Lote ${open + 1}`}</h2>
          <p className="text-xs text-[var(--eq-muted)]">
            Obra: cresce com o tempo líquido estudado ({LEVELS.slice(1)
              .map((l) => `${l.name} ${l.hours} h`)
              .join(' · ')}). Funcionamento: vem do domínio da matéria no Control.
          </p>
        </div>
        <button className="eq-btn shrink-0" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {open == null ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {all.map((id, i) => {
              const s = id ? byId.get(id) : undefined
              const lv = levelFor(s ? (seconds.get(s.id) ?? 0) : 0)
              return (
                <li key={i}>
                  <button className="eq-btn w-full justify-between text-left" onClick={() => setOpen(i)}>
                    <span>
                      <span className="block text-xs text-[var(--eq-muted)]">Lote {i + 1}</span>
                      <span className="block font-semibold">{s ? s.name : 'Terreno livre'}</span>
                      {s && (
                        <span className="block text-xs text-[var(--eq-muted)]">
                          {lv.name} · {functionFor(mastery?.get(s.id)).name}
                        </span>
                      )}
                    </span>
                    {s ? <span className="size-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden /> : <Hammer className="size-4 shrink-0" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <Lot
            key={open}
            index={open}
            subject={all[open] ? (byId.get(all[open]!) ?? null) : null}
            seconds={all[open] ? (seconds.get(all[open]!) ?? 0) : 0}
            mastery={all[open] ? mastery?.get(all[open]!) : undefined}
            free={subjects.filter((s) => !all.includes(s.id))}
            onAssign={(id) => onAssign(open, id)}
            onNavigate={onNavigate}
            onBack={focus == null ? () => setOpen(null) : null}
          />
        )}
      </div>
    </div>
  )
}

function Lot({
  index,
  subject,
  seconds,
  mastery,
  free,
  onAssign,
  onNavigate,
  onBack,
}: {
  index: number
  subject: CitySubject | null
  seconds: number
  mastery: { value: number; level: MasteryLevel } | undefined
  free: CitySubject[]
  onAssign: (id: string | null) => void
  onNavigate: (to: string) => void
  onBack: (() => void) | null
}) {
  const [pick, setPick] = useState(free[0]?.id ?? '')
  const [changing, setChanging] = useState(!subject)
  const lv = levelFor(seconds)
  const fn = functionFor(mastery)
  return (
    <div className="space-y-4">
      {subject && (
        <section>
          <p className="flex items-center gap-2 font-semibold text-[var(--eq-gold)]">
            <span className="size-3 rounded-sm" style={{ background: subject.color }} aria-hidden /> {subject.name}
          </p>
          <p className="mt-1 text-sm">
            <span className="text-[var(--eq-muted)]">Obra:</span> {lv.name} · {hours(seconds)} estudados
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-sm border border-[var(--eq-edge-dark)] bg-[#120e0b]" role="meter" aria-label="Obra até o próximo nível" aria-valuenow={Math.round(lv.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[var(--eq-gold)]" style={{ width: `${Math.round(lv.progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-[var(--eq-muted)]">{lv.next ? `Faltam ${hours(Math.max(0, lv.next.hours * 3600 - seconds))} para virar ${lv.next.name}.` : 'Obra completa: a torre mais alta da cidade.'}</p>
          <p className="mt-3 text-sm">
            <span className="text-[var(--eq-muted)]">Funcionamento:</span> {fn.name}
            {fn.level !== 'none' && ` · domínio ${fn.value}%`}
          </p>
          <p className="mt-1 text-xs text-[var(--eq-muted)]">{fn.text} Sobe com questões, flashcards, revisões e missões de aprendizagem — não com o tempo.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="eq-btn eq-btn-primary" onClick={() => onNavigate(`/cronometro?materia=${subject.id}`)}>
              <Timer className="size-4" aria-hidden /> Estudar agora
            </button>
            <button className="eq-btn" onClick={() => onNavigate(`/flashcards/revisar?materia=${subject.id}`)}>
              <Layers className="size-4" aria-hidden /> Revisar flashcards
            </button>
            <button className="eq-btn" onClick={() => onNavigate(`/materias/${subject.id}`)}>
              <BookOpen className="size-4" aria-hidden /> Abrir a matéria
            </button>
          </div>
        </section>
      )}

      {changing ? (
        <section className="space-y-2">
          <p className="font-semibold">{subject ? 'Trocar a matéria deste lote' : `Construir no lote ${index + 1}`}</p>
          {free.length === 0 ? (
            <p className="text-sm text-[var(--eq-muted)]">Todas as suas matérias já têm um prédio. Crie matérias novas no Explorador do Control.</p>
          ) : (
            <>
              <label className="block text-sm">
                <span className="mb-1 block text-[var(--eq-muted)]">Matéria</span>
                <select className="w-full rounded-md border-2 border-[var(--eq-edge-dark)] bg-[#120e0b] px-2 py-2" value={pick} onChange={(e) => setPick(e.target.value)}>
                  {free.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-[var(--eq-muted)]">O tamanho do prédio vem das horas que você já estudou nela. Trocar não apaga nenhum estudo.</p>
              <div className="flex gap-2">
                <button className="eq-btn eq-btn-primary" disabled={!pick} onClick={() => onAssign(pick)}>
                  <Hammer className="size-4" aria-hidden /> Construir
                </button>
                {subject && (
                  <button className="eq-btn" onClick={() => setChanging(false)}>
                    Cancelar
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      ) : (
        <div className="flex flex-wrap gap-2 border-t-2 border-[var(--eq-edge-dark)] pt-3">
          <button className="eq-btn" onClick={() => setChanging(true)}>
            Trocar matéria
          </button>
          <button className="eq-btn" onClick={() => onAssign(null)}>
            Liberar o terreno
          </button>
        </div>
      )}
      {onBack && (
        <button className="eq-btn" onClick={onBack}>
          Ver todos os lotes
        </button>
      )}
    </div>
  )
}
