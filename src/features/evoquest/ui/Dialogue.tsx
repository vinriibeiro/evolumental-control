import { useEffect, useMemo, useRef, useState } from 'react'
import { WORLD } from '../content'
import { destinationOf } from '../content/cities'
import { check } from '../engine/state'
import type { DialogueDef, DialogueNode, Effect, WorldState } from '../engine/types'
import { Portrait } from './Portrait'
import { play } from './audio'

interface Props {
  dialogue: DialogueDef
  state: WorldState
  reducedMotion: boolean
  sound: boolean
  /** Efeitos de cada fala/escolha são aplicados na hora em que acontecem. */
  onEffects: (e: Effect[] | undefined) => void
  onEnd: (lastNode: string) => void
}

const fill = (text: string, s: WorldState) => text.replace('{name}', s.character?.name ?? 'viajante').replace('{destino}', destinationOf(s.flags)?.name ?? 'Sua cidade')

export function Dialogue({ dialogue, state, reducedMotion, sound, onEffects, onEnd }: Props) {
  const nodes = useMemo(() => new Map(dialogue.nodes.map((n) => [n.id, n])), [dialogue])
  const [node, setNode] = useState<DialogueNode>(() => nodes.get(dialogue.start)!)
  const [shown, setShown] = useState(reducedMotion ? Infinity : 0)
  const applied = useRef(new Set<string>())
  const text = fill(node.text, state)
  const done = shown >= text.length
  const speaker = WORLD.speakers[node.speaker]
  const choices = (node.choices ?? []).filter((c) => check(state, c.when, WORLD.quests))

  useEffect(() => {
    if (applied.current.has(node.id)) return
    applied.current.add(node.id)
    onEffects(node.effects)
    play('blip', sound)
  }, [node, onEffects, sound])

  useEffect(() => {
    if (done) return
    const t = window.setTimeout(() => setShown((n) => n + 2), 16)
    return () => window.clearTimeout(t)
  }, [shown, done])

  const advance = (next?: string) => {
    if (!done) return setShown(Infinity)
    const n = next ? nodes.get(next) : undefined
    if (n) {
      setNode(n)
      setShown(reducedMotion ? Infinity : 0)
    } else onEnd(node.id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (choices.length && done) {
        const i = Number(e.key) - 1
        if (i >= 0 && i < choices.length) {
          e.preventDefault()
          onEffects(choices[i].effects)
          advance(choices[i].next)
        }
        return
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        e.preventDefault()
        advance(node.next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="eq-panel eq-pop w-full max-w-3xl p-4" role="dialog" aria-modal aria-labelledby="eq-speaker">
      <div className="flex gap-4">
        {speaker && <Portrait look={speaker.look} label={`Retrato de ${speaker.name}`} size={84} />}
        <div className="min-w-0 flex-1">
          <p id="eq-speaker" className="font-semibold text-[var(--eq-gold)]">
            {speaker?.name} <span className="text-sm font-normal text-[var(--eq-muted)]">· {speaker?.role}</span>
          </p>
          <p className="mt-1 min-h-[4.5em] leading-relaxed" aria-live="polite">
            {text.slice(0, shown)}
            {/* Leitores de tela recebem a fala inteira de uma vez. */}
            <span className="sr-only">{done ? '' : text.slice(shown)}</span>
          </p>
        </div>
      </div>
      {done && choices.length > 0 ? (
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {choices.map((c, i) => (
            <li key={i}>
              <button
                className="eq-btn w-full justify-start text-left"
                autoFocus={i === 0}
                onClick={() => {
                  onEffects(c.effects)
                  advance(c.next)
                }}
              >
                <span className="eq-kbd">{i + 1}</span> {c.text}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-3 flex justify-end">
          <button className="eq-btn eq-btn-primary" autoFocus onClick={() => advance(node.next)}>
            {!done ? 'Mostrar tudo' : node.next ? 'Continuar' : 'Encerrar'} <span className="eq-kbd">E</span>
          </button>
        </div>
      )}
    </div>
  )
}

/** Fala curta de um objeto ou NPC (sem árvore de diálogo). */
export function SayBox({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['Space', 'Enter', 'KeyE', 'Escape'].includes(e.code)) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="eq-panel eq-pop w-full max-w-2xl p-4" role="dialog" aria-modal aria-label="Mensagem">
      <p className="leading-relaxed" aria-live="polite">
        {text}
      </p>
      <div className="mt-3 flex justify-end">
        <button className="eq-btn eq-btn-primary" autoFocus onClick={onClose}>
          OK <span className="eq-kbd">E</span>
        </button>
      </div>
    </div>
  )
}
