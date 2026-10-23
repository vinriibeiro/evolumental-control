import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Backpack, BookOpen, Check, Circle, CircleDot, Lock, Map as MapIcon, Settings2, Sparkles, Star, Ticket, X } from 'lucide-react'
import { useAll } from '@/hooks/data'
import { useSettings } from '@/hooks/useSettings'
import { useToday } from '@/hooks/useToday'
import { gameSettings } from '@/game/useGame'
import { gameTopicTargets, type GameTopicCatalog } from '@/lib/insight/game'
import { LEARNING_PATHS, SQL_SKILLS, WORLD } from '../content'
import { controlOpportunities, sortOpportunities, worldOpportunities } from '../engine/opportunities'
import { CITIES } from '../content/cities'
import { cityQuestId } from '../content/generatedCity'
import { MY_CITY } from '../content/myCity'
import { currentStep, stepKey } from '../engine/state'
import type { WorldState } from '../engine/types'
import { getVolume, setVolume } from './audio'

export type PanelTab = 'inventory' | 'journal' | 'skills' | 'map' | 'settings'

const TABS: Array<{ id: PanelTab; label: string; key: string; icon: typeof Backpack }> = [
  { id: 'inventory', label: 'Inventário', key: 'I', icon: Backpack },
  { id: 'journal', label: 'Diário', key: 'J', icon: BookOpen },
  { id: 'skills', label: 'Habilidades', key: 'K', icon: Sparkles },
  { id: 'map', label: 'Mapa', key: 'M', icon: MapIcon },
  { id: 'settings', label: 'Ajustes', key: 'O', icon: Settings2 },
]

interface Props {
  tab: PanelTab
  state: WorldState
  onTab: (t: PanelTab) => void
  onClose: () => void
  /** Cidades com passagem comprada. */
  owned: Set<string>
  prefs: { textLarge: boolean; reducedMotion: boolean; sound: boolean }
  onPrefs: (p: Partial<{ textLarge: boolean; reducedMotion: boolean; sound: boolean }>) => void
}

export function Panels({ tab, state, onTab, onClose, owned, prefs, onPrefs }: Props) {
  return (
    <div className="eq-panel eq-pop flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden" role="dialog" aria-modal aria-label={TABS.find((t) => t.id === tab)?.label}>
      <div className="flex items-center gap-1 overflow-x-auto border-b-2 border-[var(--eq-edge-dark)] p-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            className={`eq-btn shrink-0 ${tab === t.id ? 'eq-btn-primary' : ''}`}
          >
            <t.icon className="size-4" aria-hidden /> {t.label} <span className="eq-kbd hidden sm:inline">{t.key}</span>
          </button>
        ))}
        <div className="flex-1" />
        <button className="eq-btn shrink-0" onClick={onClose} aria-label="Fechar">
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4" role="tabpanel">
        {tab === 'inventory' && <Inventory state={state} />}
        {tab === 'journal' && <Journal state={state} />}
        {tab === 'skills' && <SkillTree state={state} />}
        {tab === 'map' && <WorldMap state={state} owned={owned} />}
        {tab === 'settings' && <Prefs prefs={prefs} onPrefs={onPrefs} />}
      </div>
    </div>
  )
}

function Inventory({ state }: { state: WorldState }) {
  const [open, setOpen] = useState<string | null>(null)
  const items = state.inventory.map((id) => WORLD.items[id]).filter(Boolean)
  const sel = open ? WORLD.items[open] : null
  if (!items.length) return <p className="text-[var(--eq-muted)]">Sua mochila está vazia. Explore, converse e resolva problemas — o mundo recompensa com coisas úteis.</p>
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((it) => (
          <li key={it.id}>
            <button
              className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md border-2 p-1 text-center ${open === it.id ? 'border-[var(--eq-edge)] bg-[#2a2016]' : 'border-[var(--eq-edge-dark)] bg-[#120e0b]'}`}
              onClick={() => setOpen(it.id)}
              aria-pressed={open === it.id}
            >
              <span className="text-2xl" aria-hidden>
                {it.icon}
              </span>
              <span className="line-clamp-2 text-[11px] leading-tight">{it.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {sel ? (
        <div>
          <p className="font-semibold text-[var(--eq-gold)]">
            {sel.icon} {sel.name}
          </p>
          <p className="mt-1 text-sm leading-relaxed">{sel.description}</p>
          {sel.read && <pre className="mt-3 rounded-md bg-[#f5deb3] p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-[#2a1e15]">{sel.read}</pre>}
        </div>
      ) : (
        <p className="text-sm text-[var(--eq-muted)]">Escolha um item para examinar.</p>
      )}
    </div>
  )
}

const lessonOf = (concept: string) => Object.values(WORLD.lessons).find((l) => l.concept === concept)

/**
 * Quadro de oportunidades: o que vale fazer agora e por quê (regras
 * determinísticas). Junta as evidências do mundo e o motor de próxima ação
 * do Control (tópicos do Control ligados aos conceitos das missões).
 */
function Opportunities({ state }: { state: WorldState }) {
  const evidence = useAll('game_evidence')
  const today = useToday()
  const settings = useSettings()
  const concepts = Object.fromEntries(
    LEARNING_PATHS.filter((p) => state.quests[p.quest]?.done).map((p) => [p.concept, { name: lessonOf(p.concept)?.conceptName ?? p.concept, where: p.practice }]),
  )
  const missions = LEARNING_PATHS.filter((p) => state.steps.includes(p.unlockedBy) && !state.quests[p.quest]?.done).map((p) => ({ id: p.quest, title: WORLD.quests[p.quest].title, where: p.where }))
  const fromWorld = worldOpportunities(evidence.data ?? [], concepts, missions, Date.now())

  // Control → mundo: tópico recomendado que corresponde ao conceito de uma missão liberada.
  const d = today.derived
  const open = LEARNING_PATHS.filter((p) => state.steps.includes(p.unlockedBy))
  const catalog: GameTopicCatalog = {}
  for (const p of open) {
    const l = lessonOf(p.concept)
    if (l) (catalog[l.subject] ??= []).push({ id: p.concept, name: l.conceptName })
  }
  const topicConcept = new Map<string, string>()
  if (d)
    for (const [key, ids] of gameTopicTargets(catalog, [...d.topicsById.values()], [...d.subjectsById.values()], gameSettings(settings).links))
      for (const id of ids) topicConcept.set(id, key.split('|')[1])
  const paths = Object.fromEntries(open.map((p) => [p.concept, { name: lessonOf(p.concept)?.conceptName ?? p.concept, where: state.quests[p.quest]?.done ? p.practice : p.where }]))
  const fromControl = controlOpportunities(d?.recommendations ?? [], topicConcept, paths).filter((o) => !fromWorld.some((w) => w.id === `recovery:${o.id.slice(8)}`))
  const list = sortOpportunities([...fromWorld, ...fromControl])
  if (!list.length) return null
  return (
    <section aria-label="Oportunidades" className="rounded-md border-2 border-[var(--eq-edge-dark)] bg-[#120e0b] p-3">
      <p className="mb-2 text-xs font-semibold tracking-wider text-[var(--eq-gold)] uppercase">Oportunidades agora</p>
      <ul className="space-y-2 text-sm">
        {list.map((o) => (
          <li key={o.id}>
            <p className="font-semibold">
              {o.kind === 'recovery' ? 'Recuperação · ' : o.kind === 'control' ? 'Sugestão do Control · ' : o.kind === 'spaced' ? 'Revisão · ' : 'Missão · '}
              {o.title}
            </p>
            <p className="text-[var(--eq-muted)]">
              {o.reason} <span className="text-[#f5deb3]">Onde: {o.where}.</span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Journal({ state }: { state: WorldState }) {
  const quests = Object.values(WORLD.quests).filter((q) => state.quests[q.id])
  if (!quests.length) return <p className="text-[var(--eq-muted)]">Nenhuma missão ainda. Fale com a Mestra Iara, em frente à Guilda.</p>
  const order = { main: 0, side: 1, contract: 2, event: 3, mastery: 4 }
  return (
    <div className="space-y-5">
      <Opportunities state={state} />
      {quests
        .sort((a, b) => Number(state.quests[a.id].done) - Number(state.quests[b.id].done) || order[a.kind] - order[b.kind])
        .map((q) => {
          const p = state.quests[q.id]
          const cur = currentStep(state, q)
          return (
            <section key={q.id} className={p.done ? 'opacity-70' : ''}>
              <p className="text-xs font-semibold tracking-wider text-[var(--eq-muted)] uppercase">
                {q.kind === 'main' ? 'Missão principal' : q.kind === 'mastery' ? 'Missão de aprendizagem' : 'Missão secundária'} · {WORLD.regions[q.region]?.name}
                {p.done && ' · concluída'}
              </p>
              <h3 className="font-semibold text-[var(--eq-gold)]">{q.title}</h3>
              <p className="mb-2 text-sm text-[var(--eq-muted)]">{q.summary}</p>
              <ol className="space-y-1 text-sm">
                {q.steps.map((s, i) => {
                  const done = state.steps.includes(stepKey(q.id, s.id)) || i < p.step
                  const now = cur?.id === s.id
                  if (!done && !now) return null
                  return (
                    <li key={s.id} className="flex items-start gap-2">
                      {done ? <Check className="mt-0.5 size-4 shrink-0 text-[var(--eq-good)]" aria-label="Concluída" /> : <CircleDot className="mt-0.5 size-4 shrink-0 text-[var(--eq-gold)]" aria-label="Atual" />}
                      <span className={done ? 'text-[var(--eq-muted)]' : 'font-semibold'}>{s.text}</span>
                    </li>
                  )
                })}
                {!p.done && (
                  <li className="flex items-center gap-2 text-[var(--eq-muted)]">
                    <Circle className="size-4" aria-hidden /> {q.steps.length - p.step - 1 > 0 ? `${q.steps.length - p.step - 1} etapa(s) por descobrir` : 'Última etapa'}
                  </li>
                )}
              </ol>
              <p className="mt-2 text-xs text-[var(--eq-muted)]">Recompensa: {q.rewardText}</p>
            </section>
          )
        })}
    </div>
  )
}

type SkillState = 'mastered' | 'learned' | 'available' | 'locked'

export function skillStates(state: WorldState): Record<string, SkillState> {
  const practiced = new Set<string>()
  const pending = new Set<string>()
  for (const q of Object.values(WORLD.quests))
    for (const s of q.steps) for (const sk of s.skills ?? []) (state.steps.includes(stepKey(q.id, s.id)) ? practiced : pending).add(sk)
  const out: Record<string, SkillState> = {}
  for (const n of SQL_SKILLS) {
    const learned = n.covers.some((c) => practiced.has(c))
    const mastered = learned && n.covers.every((c) => !pending.has(c)) && Boolean(state.quests.sql_main?.done)
    const ready = n.requires.every((r) => out[r] === 'learned' || out[r] === 'mastered')
    out[n.id] = mastered ? 'mastered' : learned ? 'learned' : ready || !n.requires.length ? 'available' : 'locked'
  }
  return out
}

function SkillTree({ state }: { state: WorldState }) {
  const st = skillStates(state)
  const rows = [['fundamentos'], ['select'], ['filtros'], ['join', 'agregacao'], ['subqueries'], ['avancado']]
  const LABEL: Record<SkillState, string> = { mastered: 'Dominada', learned: 'Aprendida', available: 'Disponível', locked: 'Bloqueada' }
  const ICON = { mastered: Star, learned: Check, available: CircleDot, locked: Lock }
  return (
    <div>
      <p className="mb-4 text-sm text-[var(--eq-muted)]">SQL · cada habilidade se aprende usando-a no mundo. Dominada = todas as missões que a exigem concluídas.</p>
      <ol className="flex flex-col items-center gap-2" aria-label="Árvore de habilidades de SQL">
        {rows.map((row, i) => (
          <li key={i} className="flex w-full flex-col items-center gap-2">
            {i > 0 && <span className="h-4 w-0.5 bg-[var(--eq-edge-dark)]" aria-hidden />}
            <div className="flex flex-wrap justify-center gap-3">
              {row.map((id) => {
                const n = SQL_SKILLS.find((x) => x.id === id)!
                const s = st[id]
                const Icon = ICON[s]
                return (
                  <div
                    key={id}
                    className={`flex min-w-36 items-center gap-2 rounded-md border-2 px-3 py-2 ${
                      s === 'mastered' ? 'border-[var(--eq-gold)] bg-[#2a2112]' : s === 'learned' ? 'border-[var(--eq-good)] bg-[#0d2a1d]' : s === 'available' ? 'border-[var(--eq-edge)] bg-[#1d1712]' : 'border-dashed border-[var(--eq-edge-dark)] opacity-60'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span>
                      <span className="block font-semibold">{n.name}</span>
                      <span className="block text-[11px] text-[var(--eq-muted)]">{LABEL[s]}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function WorldMap({ state, owned }: { state: WorldState; owned: Set<string> }) {
  const unlocked = Boolean(state.flags.map_unlocked)
  const here = (id: string) => state.region === id
  return (
    <div>
      <p className="mb-3 text-sm text-[var(--eq-muted)]">
        {unlocked ? 'Cada cidade cuida de uma disciplina. Para viajar, pegue o ônibus na Rodoviária da Vila; as passagens ficam no balcão.' : 'O mapa ainda está em branco. A Guilda pode ajudar.'}
      </p>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-xl rounded-md border-2 border-[var(--eq-edge-dark)] bg-[radial-gradient(circle_at_50%_50%,#2d2418,#14100c)]" aria-label="Mapa do Mundo Evolumental" role="group">
        <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-[var(--eq-edge)] bg-[#2a2016] px-2 py-1 text-center text-xs font-semibold" style={{ left: '50%', top: '50%' }}>
          Vila Evolumental
          <span className="block text-[10px] font-normal text-[var(--eq-muted)]">{here('hub') ? 'você está aqui' : 'Rodoviária'}</span>
        </div>
        {state.flags.my_city_unlocked && (
          <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-[var(--eq-gold)] bg-[#2a2112] px-2 py-1 text-center text-xs font-semibold" style={{ left: '50%', top: '66%' }}>
            Minha Cidade
            <span className="block text-[10px] font-normal text-[var(--eq-muted)]">{here(MY_CITY) ? 'você está aqui' : 'linha grátis'}</span>
          </div>
        )}
        {CITIES.map((c) => {
          const has = owned.has(c.id)
          return (
            <div key={c.id} className="absolute w-32 -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${c.x}%`, top: `${c.y}%` }}>
              <div className={`rounded-md border-2 px-2 py-1 text-xs ${has ? 'border-[var(--eq-edge)] bg-[#2a2016]' : 'border-dashed border-[var(--eq-edge-dark)] bg-[#120e0b]/80'}`}>
                {has ? <Ticket className="mx-auto size-3.5 text-[var(--eq-gold)]" aria-label="Passagem comprada" /> : <Lock className="mx-auto size-3.5" aria-label="Sem passagem" />}
                <span className="block font-semibold">{c.name}</span>
                <span className="block text-[10px] text-[var(--eq-muted)]">{here(c.id) ? 'você está aqui' : c.blurb}</span>
                {state.quests[cityQuestId(c.id)]?.done && <span className="block text-[10px] text-[var(--eq-gold)]">🏅 concluída</span>}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-center text-xs text-[var(--eq-muted)]">
        Quer só treinar, sem viajar?{' '}
        <Link to="/evoquest/treino" className="text-[var(--eq-gold)] underline">
          Arena de treino
        </Link>
      </p>
    </div>
  )
}

function Prefs({ prefs, onPrefs }: { prefs: Props['prefs']; onPrefs: Props['onPrefs'] }) {
  const [vol, setVol] = useState(getVolume())
  return (
    <div className="max-w-md space-y-5">
      <label className="block">
        <span className="mb-1 block font-semibold">Volume dos efeitos: {Math.round(vol * 100)}%</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={vol}
          onChange={(e) => {
            setVol(Number(e.target.value))
            setVolume(Number(e.target.value))
          }}
          className="w-full accent-[#deb887]"
        />
      </label>
      <Toggle label="Sons" checked={prefs.sound} onChange={(v) => onPrefs({ sound: v })} />
      <Toggle label="Texto grande" checked={prefs.textLarge} onChange={(v) => onPrefs({ textLarge: v })} />
      <Toggle label="Reduzir movimento (sem animações de texto e de cenário)" checked={prefs.reducedMotion} onChange={(v) => onPrefs({ reducedMotion: v })} />
      <div className="text-sm text-[var(--eq-muted)]">
        <p className="mb-1 font-semibold text-[var(--eq-ink)]">Controles</p>
        <p>
          <span className="eq-kbd">W A S D</span> ou setas: andar · <span className="eq-kbd">E</span>/<span className="eq-kbd">Espaço</span>: interagir · <span className="eq-kbd">I J K M</span>: painéis ·{' '}
          <span className="eq-kbd">Esc</span>: fechar. No celular: joystick e botão de ação.
        </p>
      </div>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span>{label}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[#deb887]" />
    </label>
  )
}
