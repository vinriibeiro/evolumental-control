import { useEffect, useRef, useState } from 'react'
import { Bus, Check, Coins, Home, Ticket, X } from 'lucide-react'
import { CITIES, type CityDef } from '../content/cities'
import { MY_CITY } from '../content/myCity'

interface Common {
  region: string
  owned: Set<string>
  onClose: () => void
}

/**
 * Balcão da Rodoviária: uma passagem por cidade. Comprada uma vez, a linha
 * fica liberada. A primeira sai de graça (vale da Guilda). O preço e o saldo
 * valem no servidor; aqui só mostramos.
 */
export function TicketCounter({ owned, coins, onBuy, onBoard, onClose }: Common & { coins: number; onBuy: (city: CityDef) => Promise<void>; onBoard: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const free = owned.size === 0
  const buy = async (c: CityDef) => {
    setBusy(c.id)
    setError(null)
    try {
      await onBuy(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível comprar a passagem.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden" role="dialog" aria-modal aria-label="Bilheteria da Rodoviária">
      <header className="flex items-center gap-2 border-b-2 border-[var(--eq-edge-dark)] p-3">
        <Ticket className="size-5 text-[var(--eq-gold)]" aria-hidden />
        <div className="flex-1">
          <h2 className="font-semibold">Bilheteria · Rodoviária da Vila</h2>
          <p className="text-xs text-[var(--eq-muted)]">{free ? 'Sua primeira passagem é por conta da Guilda: escolha qualquer cidade.' : 'Compre uma vez e a linha fica liberada para sempre. A volta para a Vila é grátis.'}</p>
        </div>
        <span className="flex items-center gap-1 text-sm tabular-nums" aria-label={`${coins} moedas`}>
          <Coins className="size-4 text-[var(--eq-gold)]" aria-hidden /> {coins.toLocaleString('pt-BR')}
        </span>
        <button className="eq-btn shrink-0" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </button>
      </header>
      <ul className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
        {CITIES.map((c) => {
          const has = owned.has(c.id)
          const price = free ? 0 : c.price
          const short = !has && price > coins
          return (
            <li key={c.id} className={`flex flex-col gap-2 rounded-md border-2 p-3 ${has ? 'border-[var(--eq-good)] bg-[#0d2a1d]' : 'border-[var(--eq-edge-dark)] bg-[#120e0b]'}`}>
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-[var(--eq-muted)]">
                  {c.subtitle} · {c.blurb}
                </p>
              </div>
              {has ? (
                <p className="flex items-center gap-1 text-sm text-[var(--eq-good)]">
                  <Check className="size-4" aria-hidden /> Passagem comprada
                </p>
              ) : (
                <button className="eq-btn eq-btn-primary justify-center" disabled={Boolean(busy) || short} onClick={() => void buy(c)}>
                  {busy === c.id ? 'Emitindo…' : price === 0 ? 'Trocar o vale (grátis)' : `Comprar · ${price} moedas`}
                </button>
              )}
              {short && <p className="text-xs text-[var(--eq-muted)]">Faltam {price - coins} moedas. Ajude as cidades que você já conhece para juntar mais.</p>}
            </li>
          )
        })}
      </ul>
      <footer className="flex flex-wrap items-center gap-2 border-t-2 border-[var(--eq-edge-dark)] p-3">
        {error && (
          <p role="alert" className="flex-1 text-sm text-[var(--eq-bad)]">
            {error}
          </p>
        )}
        <div className="flex-1" />
        <button className="eq-btn" onClick={onBoard} disabled={owned.size === 0}>
          <Bus className="size-4" aria-hidden /> Ir para o embarque
        </button>
      </footer>
    </div>
  )
}

/** Plataforma: escolhe a linha (cidades com passagem e, se houver escritura, Minha Cidade). */
export function BusBoarding({ region, owned, myCity, onBoard, onTickets, onClose }: Common & { myCity: boolean; onBoard: (region: string) => void; onTickets: () => void }) {
  const lines = CITIES.filter((c) => owned.has(c.id))
  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden" role="dialog" aria-modal aria-label="Embarque">
      <header className="flex items-center gap-2 border-b-2 border-[var(--eq-edge-dark)] p-3">
        <Bus className="size-5 text-[var(--eq-gold)]" aria-hidden />
        <h2 className="flex-1 font-semibold">Embarque · para onde?</h2>
        <button className="eq-btn shrink-0" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {lines.length === 0 && !myCity ? (
          <p className="text-sm text-[var(--eq-muted)]">Você ainda não tem passagem. A bilheteria fica no prédio azul da Rodoviária, com a Dora.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((c) => (
              <li key={c.id}>
                <button className="eq-btn w-full justify-between text-left" onClick={() => onBoard(c.id)} disabled={region === c.id}>
                  <span>
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-xs text-[var(--eq-muted)]">
                      {c.subtitle} · {c.blurb}
                    </span>
                  </span>
                  <Ticket className="size-4 shrink-0 text-[var(--eq-gold)]" aria-hidden />
                </button>
              </li>
            ))}
            {myCity && (
              <li>
                <button className="eq-btn w-full justify-between text-left" onClick={() => onBoard(MY_CITY)} disabled={region === MY_CITY}>
                  <span>
                    <span className="block font-semibold">Minha Cidade</span>
                    <span className="block text-xs text-[var(--eq-muted)]">Construída com as suas matérias · linha grátis</span>
                  </span>
                  <Home className="size-4 shrink-0 text-[var(--eq-gold)]" aria-hidden />
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
      <footer className="border-t-2 border-[var(--eq-edge-dark)] p-3">
        <button className="eq-btn" onClick={onTickets}>
          <Ticket className="size-4" aria-hidden /> Comprar outra passagem
        </button>
      </footer>
    </div>
  )
}

/** Viagem: o ônibus atravessa a tela e chega (curta; quase instantânea com movimento reduzido). */
export function BusRide({ to, reducedMotion, onArrive }: { to: string; reducedMotion: boolean; onArrive: () => void }) {
  const ms = reducedMotion ? 400 : 1700
  // A tela re-renderiza durante a viagem (consultas, avisos): o horário de chegada não pode recomeçar.
  const arrive = useRef(onArrive)
  arrive.current = onArrive
  useEffect(() => {
    const t = window.setTimeout(() => arrive.current(), ms)
    return () => window.clearTimeout(t)
  }, [ms])
  return (
    <div className="eq-panel w-full max-w-md overflow-hidden p-4 text-center" role="status" aria-live="polite">
      <p className="text-sm text-[var(--eq-muted)]">Em viagem para</p>
      <p className="font-semibold text-[var(--eq-gold)]">{to}</p>
      <div className="relative mt-4 h-10 overflow-hidden rounded-sm bg-[#3b3f46]">
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,#eda100_0_12px,transparent_12px_24px)]" />
        <Bus className={`absolute top-1/2 size-8 -translate-y-1/2 text-[var(--eq-gold)] ${reducedMotion ? 'left-1/2 -translate-x-1/2' : 'eq-ride'}`} style={reducedMotion ? undefined : { animationDuration: `${ms}ms` }} aria-hidden />
      </div>
    </div>
  )
}

/** Quadro de Missões na apresentação: cada cidade pede ajuda; o jogador escolhe a primeira. */
export function CityChoice({ onChoose, onClose }: { onChoose: (city: CityDef) => void; onClose: (() => void) | null }) {
  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden" role="dialog" aria-modal aria-label="Quadro de Missões">
      <header className="flex items-center gap-2 border-b-2 border-[var(--eq-edge-dark)] p-3">
        <div className="flex-1">
          <h2 className="font-semibold">Quadro de Missões · pedidos de ajuda</h2>
          <p className="text-xs text-[var(--eq-muted)]">Cada cidade cuida de uma disciplina. Escolha a que você quer ajudar primeiro: as outras continuam esperando.</p>
        </div>
        {onClose && (
          <button className="eq-btn shrink-0" onClick={onClose} aria-label="Fechar">
            <X className="size-4" />
          </button>
        )}
      </header>
      <ul className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
        {CITIES.map((c, i) => (
          <li key={c.id}>
            <button className="eq-btn h-full w-full flex-col items-start gap-0.5 py-2 text-left" autoFocus={i === 0} onClick={() => onChoose(c)}>
              <span className="font-semibold">{c.name}</span>
              <span className="text-xs font-normal text-[var(--eq-muted)]">
                {c.subtitle} · {c.blurb}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
