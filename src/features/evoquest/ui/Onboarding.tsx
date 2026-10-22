import { useState } from 'react'
import { PLAYER_LOOKS } from '../content/common'
import type { CharacterProfile } from '../engine/types'
import { Portrait } from './Portrait'

const LINES = [
  'Mundo Evolumental.',
  'Aqui, ninguém te entrega alternativas para marcar.',
  'Te entregam portas trancadas, sistemas quebrados e gente pedindo ajuda.',
  'O que você sabe é a sua ferramenta.',
]

/** Cena curta + criação simples de personagem. Pode pular a cena. */
export function Onboarding({ defaultName, onDone }: { defaultName: string; onDone: (c: CharacterProfile) => void }) {
  const [line, setLine] = useState(0)
  const [name, setName] = useState(defaultName.slice(0, 40))
  const [look, setLook] = useState(PLAYER_LOOKS[0].id)
  const intro = line < LINES.length

  if (intro)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-8 bg-[#07090d] p-6 text-center">
        <p key={line} className="eq-pop max-w-xl text-xl leading-relaxed sm:text-2xl" aria-live="polite">
          {LINES[line]}
        </p>
        <div className="flex gap-3">
          <button className="eq-btn" onClick={() => setLine(LINES.length)}>
            Pular
          </button>
          <button className="eq-btn eq-btn-primary" autoFocus onClick={() => setLine((l) => l + 1)}>
            {line === LINES.length - 1 ? 'Começar' : 'Continuar'}
          </button>
        </div>
      </div>
    )

  const chosen = PLAYER_LOOKS.find((l) => l.id === look)!
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-[#07090d] p-4">
      <form
        className="eq-panel eq-pop w-full max-w-lg p-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onDone({ name: name.trim().slice(0, 40), look: chosen.look })
        }}
      >
        <h1 className="text-lg font-semibold text-[var(--eq-gold)]">Quem chega à Vila?</h1>
        <label htmlFor="eq-name" className="mt-4 block text-sm font-semibold">
          Nome do personagem
        </label>
        <input
          id="eq-name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-11 w-full rounded-md border-2 border-[var(--eq-edge-dark)] bg-[#120e0b] px-3 outline-none focus:border-[var(--eq-edge)]"
          autoFocus
          autoComplete="off"
        />
        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Aparência</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {PLAYER_LOOKS.map((l) => (
              <label key={l.id} className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border-2 p-2 ${look === l.id ? 'border-[var(--eq-edge)] bg-[#2a2016]' : 'border-[var(--eq-edge-dark)]'}`}>
                <input type="radio" name="look" value={l.id} checked={look === l.id} onChange={() => setLook(l.id)} className="sr-only" />
                <Portrait look={l.look} label={l.label} size={56} />
                <span className="text-xs">{l.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 flex justify-end">
          <button type="submit" className="eq-btn eq-btn-primary" disabled={!name.trim()}>
            Entrar na Vila
          </button>
        </div>
      </form>
    </div>
  )
}
