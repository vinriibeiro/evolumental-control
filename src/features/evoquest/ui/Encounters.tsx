import { useEffect, useState } from 'react'
import { Cpu, Power, ScanLine, ShieldAlert, Terminal as TermIcon, X, Zap } from 'lucide-react'
import { canonInput, canonSwitches, sha256, type InputChallenge, type SqlChallenge, type SwitchPuzzle } from '../challenges'
import { WORLD } from '../content'
import type { BossDef } from '../content/registry'
import { act, available, startCombat, type CombatAction, type EncounterDef } from '../engine/combat'
import { Portrait } from './Portrait'
import { Terminal } from './Terminal'
import { play } from './audio'

function Bar({ label, value, max, color, segments }: { label: string; value: number; max: number; color: string; segments?: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-semibold tracking-wide uppercase">{label}</span>
        <span className="tabular-nums">
          {value}/{max}
        </span>
      </div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-sm border border-[var(--eq-edge-dark)] bg-[#120e0b]" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
        {segments ? (
          Array.from({ length: segments }, (_, i) => <div key={i} className="flex-1" style={{ background: i < value ? color : 'transparent' }} />)
        ) : (
          <div style={{ width: `${(value / max) * 100}%`, background: color }} />
        )}
      </div>
    </div>
  )
}

const ICONS: Record<CombatAction['kind'], typeof ScanLine> = { scan: ScanLine, terminal: TermIcon, input: Cpu, attack: Zap }

/** Combate por ações: investigar, descobrir a vulnerabilidade e só então agir. */
export function CombatView({ encounter: def, sound, onWin, onClose }: { encounter: EncounterDef; sound: boolean; onWin: (answer: string) => Promise<boolean>; onClose: () => void }) {
  const [s, setS] = useState(() => startCombat(def))
  const [terminal, setTerminal] = useState<CombatAction | null>(null)
  const [typing, setTyping] = useState<CombatAction | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [claimed, setClaimed] = useState(false)
  const speaker = WORLD.speakers.sentinel

  useEffect(() => {
    if (s.outcome !== 'won' || claimed) return
    setClaimed(true)
    play('success', sound)
    // A vitória vale pelas descobertas (pid e IP), conferidas no servidor.
    const answer = def.actions.filter((a) => a.kind === 'input' && a.challenge).map((a) => answers[a.challenge!]).join('|')
    void onWin(answer)
  }, [s.outcome, claimed, answers, def, onWin, sound])

  const choose = (a: CombatAction) => {
    if (a.kind === 'terminal') return setTerminal(a)
    if (a.kind === 'input') return setTyping(a)
    setS((cur) => act(def, cur, a.id, true))
    play(a.kind === 'attack' ? 'step' : 'blip', sound)
  }

  if (terminal) {
    const ch = WORLD.challenges[terminal.challenge!] as SqlChallenge
    return (
      <Terminal
        challenge={ch}
        sound={sound}
        onSolved={() => {
          setS((cur) => act(def, cur, terminal.id, true))
          return true
        }}
        onClose={() => setTerminal(null)}
      />
    )
  }

  const actions = available(def, s)
  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden" role="dialog" aria-modal aria-label={`Confronto: ${def.name}`}>
      <header className="flex items-center gap-3 border-b-2 border-[var(--eq-edge-dark)] px-4 py-3">
        <ShieldAlert className="size-5 text-[var(--eq-bad)]" aria-hidden />
        <h2 className="flex-1 font-semibold tracking-wide">{def.name}</h2>
        <button className="eq-btn" onClick={onClose} aria-label="Recuar">
          <X className="size-4" /> Recuar
        </button>
      </header>
      <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[1fr_1.1fr]">
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <Portrait object="sentinel" label={def.name} size={72} />
            <div className="flex-1 space-y-2">
              <Bar label="Integridade" value={s.integrity} max={def.integrity} color="var(--eq-bad)" />
              <Bar label="Firewall" value={s.firewall} max={def.maxFirewall} color="var(--eq-cyan)" segments={def.maxFirewall} />
            </div>
          </div>
          <Bar label="Seu sinal" value={s.signal} max={def.signal} color="var(--eq-good)" segments={def.signal} />
          {def.panels.map((p) =>
            s.revealed.includes(p.id) ? (
              <div key={p.id} className="rounded-md border border-[var(--eq-edge-dark)] bg-[#0f141c] p-3">
                <p className="mb-1 text-xs font-semibold tracking-wider text-[var(--eq-cyan)] uppercase">{p.label}</p>
                <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">{p.content}</pre>
              </div>
            ) : (
              <div key={p.id} className="rounded-md border border-dashed border-[var(--eq-edge-dark)] p-3 text-xs text-[var(--eq-muted)]">
                {p.label}: ainda não investigado
              </div>
            ),
          )}
        </section>
        <section className="flex min-h-0 flex-col gap-3">
          <ol className="max-h-56 space-y-1.5 overflow-y-auto rounded-md bg-[#0d0b09] p-3 text-sm" aria-live="polite" aria-label="Registro do confronto">
            {s.log.map((l, i) => (
              <li key={i} className={l.who === 'enemy' ? 'text-[#ffb3b3]' : l.who === 'player' ? 'text-[#c9ffe2]' : 'text-[var(--eq-muted)]'}>
                <span className="sr-only">{l.who === 'enemy' ? 'Inimigo: ' : l.who === 'player' ? 'Você: ' : ''}</span>
                {l.who === 'enemy' ? '◆ ' : l.who === 'player' ? '▸ ' : ''}
                {l.text}
              </li>
            ))}
          </ol>
          {s.outcome === 'ongoing' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {actions.map((a) => {
                const Icon = ICONS[a.kind]
                return (
                  <button key={a.id} className="eq-btn h-auto min-h-14 flex-col items-start py-2 text-left" onClick={() => choose(a)}>
                    <span className="flex items-center gap-1.5">
                      <Icon className="size-4 text-[var(--eq-gold)]" aria-hidden /> {a.label}
                      {a.free && <span className="text-[10px] font-normal text-[var(--eq-muted)]">(não gasta turno)</span>}
                    </span>
                    <span className="text-xs font-normal text-[var(--eq-muted)]">{a.description}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="font-semibold">{s.outcome === 'won' ? 'Vitória.' : 'Você recuou.'}</p>
              <div className="flex gap-2">
                {s.outcome === 'lost' && (
                  <button className="eq-btn eq-btn-primary" onClick={() => (setS(startCombat(def)), setAnswers({}))}>
                    Tentar de novo
                  </button>
                )}
                <button className="eq-btn" onClick={onClose}>
                  {s.outcome === 'won' ? 'Continuar' : 'Sair'}
                </button>
              </div>
            </div>
          )}
          {speaker && <p className="text-xs text-[var(--eq-muted)]">Dica: leituras não dão a vez ao inimigo. Ataques às cegas mal arranham o firewall.</p>}
        </section>
      </div>

      {typing && (
        <InputPrompt
          challenge={WORLD.challenges[typing.challenge!] as InputChallenge}
          prompt={typing.input?.prompt ?? typing.label}
          placeholder={typing.input?.placeholder}
          onCancel={() => setTyping(null)}
          onSubmit={(ok, canon) => {
            if (ok) setAnswers((a) => ({ ...a, [typing.challenge!]: canon }))
            setS((cur) => act(def, cur, typing.id, ok))
            play(ok ? 'success' : 'error', sound)
            setTyping(null)
          }}
        />
      )}
    </div>
  )
}

function InputPrompt({ challenge, prompt, placeholder, onSubmit, onCancel }: { challenge: InputChallenge; prompt: string; placeholder?: string; onSubmit: (ok: boolean, canon: string) => void; onCancel: () => void }) {
  const [v, setV] = useState('')
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-4">
      <form
        className="eq-panel eq-pop w-full max-w-md p-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const canon = canonInput(v, challenge.normalize)
          onSubmit((await sha256(canon)) === challenge.expect.hash, canon)
        }}
      >
        <label htmlFor="eq-input" className="mb-2 block font-semibold">
          {challenge.title}
        </label>
        <div className="flex items-center gap-2 rounded-md border-2 border-[#1f3d30] bg-[#07130e] px-3 font-mono text-[#b8ffd9]">
          <span aria-hidden>{prompt}</span>
          <input id="eq-input" autoFocus value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.stopPropagation()} className="h-11 min-w-0 flex-1 bg-transparent outline-none" autoComplete="off" />
        </div>
        <p className="mt-2 text-xs text-[var(--eq-muted)]">Use o valor que você descobriu. Um valor errado tem consequência.</p>
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="eq-btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="eq-btn eq-btn-primary" disabled={!v.trim()}>
            Executar
          </button>
        </div>
      </form>
    </div>
  )
}

/** Painel de disjuntores: lógica aplicada, com consequência para cada regra violada. */
export function PuzzleView({ puzzle: p, sound, hasManual, onSolved, onClose }: { puzzle: SwitchPuzzle; sound: boolean; hasManual: boolean; onSolved: (answer: string) => Promise<boolean>; onClose: () => void }) {
  const [on, setOn] = useState<Record<string, boolean>>({})
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [solved, setSolved] = useState(false)

  const energize = async () => {
    const broken = p.rules.find((r) => !r.ok(on))
    if (broken) {
      setMsg({ ok: false, text: broken.fail })
      play('error', sound)
      return
    }
    const canon = canonSwitches(p, on)
    if ((await sha256(canon)) !== p.expect.hash) return setMsg({ ok: false, text: 'O painel não reage.' })
    if (await onSolved(canon)) {
      setSolved(true)
      setMsg({ ok: true, text: p.success })
      play('success', sound)
    }
  }

  return (
    <div className="eq-panel eq-pop w-full max-w-xl p-5" role="dialog" aria-modal aria-label={p.title}>
      <div className="mb-3 flex items-center gap-2">
        <Power className="size-5 text-[var(--eq-gold)]" aria-hidden />
        <h2 className="flex-1 font-semibold">{p.title}</h2>
        <button className="eq-btn" onClick={onClose} aria-label="Fechar painel">
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-[var(--eq-muted)]">{hasManual ? p.brief : 'Sem o manual do Zé você estaria chutando. Ele está no subsolo.'}</p>
      <div className="mb-4 grid grid-cols-4 gap-3">
        {p.switches.map((sw) => {
          const active = Boolean(on[sw.id])
          return (
            <button
              key={sw.id}
              role="switch"
              aria-checked={active}
              aria-label={sw.label}
              disabled={solved}
              onClick={() => {
                setOn((o) => ({ ...o, [sw.id]: !o[sw.id] }))
                setMsg(null)
                play('step', sound)
              }}
              className="flex flex-col items-center gap-2 rounded-md border-2 border-[var(--eq-edge-dark)] bg-[#120e0b] p-3"
            >
              <span className="text-lg font-bold">{sw.id}</span>
              <span className={`flex h-14 w-7 flex-col ${active ? 'justify-start' : 'justify-end'} rounded-sm border border-[var(--eq-edge-dark)] bg-[#0b0908] p-0.5`}>
                <span className={`h-6 w-full rounded-sm ${active ? 'bg-[var(--eq-good)]' : 'bg-[#4a3a2c]'}`} />
              </span>
              <span className="text-[11px] font-semibold">{active ? 'LIGADO' : 'desligado'}</span>
            </button>
          )
        })}
      </div>
      {msg && (
        <p role="status" className={`mb-3 rounded-md border-l-4 px-3 py-2 text-sm ${msg.ok ? 'border-[var(--eq-good)] bg-[#0d2a1d]' : 'border-[var(--eq-bad)] bg-[#2a1414]'}`}>
          {msg.text}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {solved ? (
          <button className="eq-btn eq-btn-primary" onClick={onClose}>
            Continuar
          </button>
        ) : (
          <button className="eq-btn eq-btn-primary" onClick={() => void energize()} disabled={!hasManual}>
            <Zap className="size-4" /> Energizar
          </button>
        )}
      </div>
    </div>
  )
}

/** Chefe em fases: cada fase é uma operação real no núcleo, não uma pergunta. */
export function BossView({ boss, phase, sound, onSolvePhase, onClose }: { boss: BossDef; phase: number; sound: boolean; onSolvePhase: (challenge: string, answer: string) => Promise<boolean>; onClose: () => void }) {
  const [inTerminal, setInTerminal] = useState(false)
  const done = phase >= boss.phases.length
  const cur = boss.phases[Math.min(phase, boss.phases.length - 1)]
  const speaker = WORLD.speakers[boss.speaker]

  if (inTerminal && !done) {
    return (
      <Terminal
        key={cur.challenge}
        challenge={WORLD.challenges[cur.challenge] as SqlChallenge}
        sound={sound}
        onSolved={(answer) => onSolvePhase(cur.challenge, answer)}
        onClose={() => setInTerminal(false)}
      />
    )
  }
  return (
    <div className="eq-panel eq-pop w-full max-w-2xl p-5" role="dialog" aria-modal aria-label={boss.name}>
      <div className="flex gap-4">
        <Portrait object="root" label={boss.name} size={88} />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-[#ff8fab]">{boss.name}</h2>
          <div className="mt-2">
            <Bar label="Controle de ROOT sobre o núcleo" value={boss.phases.length - Math.min(phase, boss.phases.length)} max={boss.phases.length} color="#ff3d6e" segments={boss.phases.length} />
          </div>
        </div>
      </div>
      <p className="mt-4 leading-relaxed">{done ? boss.defeat : phase === 0 ? boss.intro : cur.taunt}</p>
      {!done && (
        <p className="mt-2 text-sm text-[var(--eq-muted)]">
          <strong className="text-[var(--eq-gold)]">{cur.title}.</strong> {phase === 0 ? cur.taunt : ''}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="eq-btn" onClick={onClose}>
          {done ? 'Continuar' : 'Recuar'}
        </button>
        {!done && (
          <button className="eq-btn eq-btn-primary" autoFocus onClick={() => setInTerminal(true)}>
            <TermIcon className="size-4" /> Abrir terminal do núcleo
          </button>
        )}
      </div>
      {speaker && <span className="sr-only">Fala de {speaker.name}</span>}
    </div>
  )
}
