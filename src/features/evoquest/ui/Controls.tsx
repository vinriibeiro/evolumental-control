import { useRef, useState } from 'react'
import { Backpack, BookOpen, Coins, LogOut, Map as MapIcon, Settings2, Sparkles } from 'lucide-react'
import type { EntityDef } from '../engine/types'
import type { PanelTab } from './Panels'

interface HudProps {
  level: number
  progress: number
  coins: number
  regionName: string
  objective: { quest: string; text: string } | null
  focus: EntityDef | null
  touch: boolean
  onPanel: (t: PanelTab) => void
  onExit: () => void
}

/** HUD: só o que importa durante o jogo. */
export function Hud({ level, progress, coins, regionName, objective, focus, touch, onPanel, onExit }: HudProps) {
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3">
        <div className="eq-panel pointer-events-auto flex items-center gap-3 px-3 py-2">
          <span className="text-sm font-bold">NV {level}</span>
          <div className="h-2.5 w-24 overflow-hidden rounded-sm border border-[var(--eq-edge-dark)] bg-[#120e0b] sm:w-32" role="meter" aria-label="Progresso de nível" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[var(--eq-gold)]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="flex items-center gap-1 text-sm tabular-nums" aria-label={`${coins} moedas`}>
            <Coins className="size-4 text-[var(--eq-gold)]" aria-hidden /> {coins.toLocaleString('pt-BR')}
          </span>
        </div>
        {objective && (
          <div className="eq-panel hidden max-w-sm px-3 py-2 md:block" aria-live="polite">
            <p className="text-[10px] font-semibold tracking-wider text-[var(--eq-gold)] uppercase">{objective.quest}</p>
            <p className="text-sm leading-snug">{objective.text}</p>
          </div>
        )}
        <div className="flex-1" />
        <div className="eq-panel pointer-events-auto flex items-center gap-2 px-3 py-2">
          <span className="hidden text-sm font-semibold sm:inline">{regionName}</span>
          <button className="eq-btn h-8 min-h-0 px-2" onClick={onExit} aria-label="Sair do mundo">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>

      {objective && (
        <div className="eq-panel pointer-events-none absolute top-16 left-2 max-w-[70vw] px-3 py-1.5 md:hidden">
          <p className="text-xs leading-snug">{objective.text}</p>
        </div>
      )}

      {focus && !touch && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
          <p className="eq-panel px-3 py-1.5 text-sm">
            <span className="eq-kbd">E</span> {focus.verb ?? 'Interagir'} · <strong>{focus.name}</strong>
          </p>
        </div>
      )}

      <nav aria-label="Painéis" className={`absolute flex gap-2 ${touch ? 'top-16 right-2 flex-col' : 'inset-x-0 bottom-3 justify-center'}`}>
        {(
          [
            ['inventory', 'Inventário', 'I', Backpack],
            ['map', 'Mapa', 'M', MapIcon],
            ['journal', 'Diário', 'J', BookOpen],
            ['skills', 'Habilidades', 'K', Sparkles],
            ['settings', 'Ajustes', 'O', Settings2],
          ] as const
        ).map(([id, label, key, Icon]) => (
          <button key={id} className="eq-btn bg-[#241c16]/90" onClick={() => onPanel(id)} aria-label={label}>
            <Icon className="size-4" aria-hidden />
            {!touch && (
              <>
                <span className="hidden lg:inline">{label}</span> <span className="eq-kbd">{key}</span>
              </>
            )}
          </button>
        ))}
      </nav>
    </>
  )
}

/** Joystick virtual + botão de ação contextual (celular). */
export function TouchControls({ focus, onStick, onAction }: { focus: EntityDef | null; onStick: (dx: number, dy: number) => void; onAction: () => void }) {
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const active = useRef<number | null>(null)
  const R = 44

  const move = (clientX: number, clientY: number) => {
    const r = base.current!.getBoundingClientRect()
    let dx = clientX - (r.left + r.width / 2)
    let dy = clientY - (r.top + r.height / 2)
    const len = Math.hypot(dx, dy)
    if (len > R) {
      dx = (dx / len) * R
      dy = (dy / len) * R
    }
    setKnob({ x: dx, y: dy })
    const k = Math.min(1, len / R)
    onStick(k < 0.2 ? 0 : (dx / R) * 1, k < 0.2 ? 0 : (dy / R) * 1)
  }
  const end = () => {
    active.current = null
    setKnob({ x: 0, y: 0 })
    onStick(0, 0)
  }

  return (
    <>
      <div
        ref={base}
        className="absolute bottom-6 left-6 size-32 touch-none rounded-full border-2 border-[var(--eq-edge-dark)] bg-black/35"
        aria-hidden
        onPointerDown={(e) => {
          active.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          move(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => active.current === e.pointerId && move(e.clientX, e.clientY)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="absolute top-1/2 left-1/2 size-14 rounded-full border-2 border-[var(--eq-edge)] bg-[#2a2016]" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      </div>
      <button
        className="absolute right-6 bottom-8 flex size-24 flex-col items-center justify-center rounded-full border-2 border-[var(--eq-edge)] bg-[#2a2016]/95 text-sm font-bold disabled:opacity-40"
        disabled={!focus}
        onClick={onAction}
        aria-label={focus ? `${focus.verb ?? 'Interagir'}: ${focus.name}` : 'Nada por perto'}
      >
        <span>{focus?.verb ?? 'Ação'}</span>
        {focus && <span className="max-w-20 truncate text-[10px] font-normal">{focus.name}</span>}
      </button>
    </>
  )
}
