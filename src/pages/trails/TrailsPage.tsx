import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Info, Lightbulb, Plus, Route } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input } from '@/components/ui/Field'
import { Badge, Card, PageHeader, Progress, Segmented, Tabs } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useTransaction } from '@/hooks/data'
import { CAREER_TRAILS, SUBJECT_LIBRARY, countTopics, subjectByKey, topicName, type CareerTrail, type CyclePlan, type SubjectDef, type TopicTree } from '@/content/trails'
import { installTrail, type InstallItem, type InstallResult } from '@/services/trails'
import { cn } from '@/lib/cn'
import { searchLinks } from '@/lib/search'

type Area = 'all' | 'Concursos' | 'Tecnologia'

export default function TrailsPage() {
  const [tab, setTab] = useState<'minha' | 'careers' | 'subjects'>('minha')
  const [area, setArea] = useState<Area>('all')
  const [selected, setSelected] = useState<CareerTrail | null>(null)
  const [installing, setInstalling] = useState<{ title: string; items: InstallItem[]; cycleName?: string; allowCycle: boolean; cyclePlan?: CyclePlan } | null>(null)

  if (selected)
    return (
      <>
        <CareerDetail
          trail={selected}
          onBack={() => setSelected(null)}
          onInstall={() =>
            setInstalling({
              title: selected.name,
              items: selected.subjects.map((s) => ({ subject: subjectByKey(s.key), weight: s.weight })),
              cycleName: `Ciclo — ${selected.name}`,
              allowCycle: !selected.cyclePlan,
              cyclePlan: selected.cyclePlan,
            })
          }
        />
        <InstallModal state={installing} onClose={() => setInstalling(null)} />
      </>
    )

  const minha = CAREER_TRAILS.find((c) => c.sequential)
  const careers = CAREER_TRAILS.filter((c) => !c.sequential && (area === 'all' || c.area === area))
  const subjects = SUBJECT_LIBRARY.filter((s) => area === 'all' || s.area === area)

  return (
    <div>
      <PageHeader
        title="Trilhas de estudo"
        description="Trilhas prontas por carreira e por matéria, com tópicos na ordem recomendada. Adicione ao seu estudo com um clique e ajuste como quiser."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          ...(minha ? [{ value: 'minha' as const, label: 'Minha trilha' }] : []),
          { value: 'careers', label: 'Outras carreiras' },
          { value: 'subjects', label: 'Por matéria' },
        ]}
      />
      <div className={cn('mb-5', tab === 'minha' && 'hidden')}>
        <Segmented
          label="Área"
          value={area}
          onChange={setArea}
          options={[
            { value: 'all', label: 'Todas' },
            { value: 'Concursos', label: 'Concursos' },
            { value: 'Tecnologia', label: 'Tecnologia' },
          ]}
        />
      </div>

      {tab === 'minha' && minha ? (
        <CareerDetail
          embedded
          trail={minha}
          onBack={() => setTab('careers')}
          onInstall={() =>
            setInstalling({
              title: minha.name,
              items: minha.subjects.map((s) => ({ subject: subjectByKey(s.key), weight: s.weight })),
              cycleName: minha.cyclePlan?.name,
              allowCycle: !minha.cyclePlan,
              cyclePlan: minha.cyclePlan,
            })
          }
        />
      ) : tab === 'careers' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {careers.map((c) => {
            const topics = c.subjects.reduce((n, s) => n + countTopics(subjectByKey(s.key).topics), 0)
            return (
              <Card key={c.key} className="flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none" aria-hidden>
                    {c.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{c.name}</p>
                    <Badge className="mt-1">{c.area}</Badge>
                  </div>
                </div>
                <p className="line-clamp-3 text-sm text-muted">{c.summary}</p>
                <p className="text-xs text-muted">
                  {c.subjects.length} matérias · {topics} tópicos
                </p>
                <div className="mt-auto flex gap-2">
                  <Button className="flex-1" onClick={() => setSelected(c)}>
                    Ver trilha
                  </Button>
                  <Button
                    variant="primary"
                    icon={<Plus className="size-4" />}
                    onClick={() =>
                      setInstalling({
                        title: c.name,
                        items: c.subjects.map((s) => ({ subject: subjectByKey(s.key), weight: s.weight })),
                        cycleName: `Ciclo — ${c.name}`,
                        allowCycle: !c.cyclePlan,
                        cyclePlan: c.cyclePlan,
                      })
                    }
                  >
                    Adicionar
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <SubjectTrailCard key={s.key} subject={s} onAdd={() => setInstalling({ title: s.name, items: [{ subject: s, weight: 1 }], allowCycle: false })} />
          ))}
        </div>
      )}
      <InstallModal state={installing} onClose={() => setInstalling(null)} />
    </div>
  )
}

function SubjectTrailCard({ subject: s, onAdd }: { subject: SubjectDef; onAdd: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden>
          {s.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">{s.name}</p>
          <p className="text-xs text-muted">
            {s.area} · {countTopics(s.topics)} tópicos
          </p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted">{s.description}</p>
      {open && (
        <div className="scroll-thin mt-3 max-h-64 overflow-y-auto rounded-lg bg-surface p-3">
          <TopicList tree={s.topics} />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="ghost" icon={open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Ocultar tópicos' : 'Ver tópicos'}
        </Button>
        <span className="flex-1" />
        <Button size="sm" variant="primary" icon={<Plus className="size-3.5" />} onClick={onAdd}>
          Adicionar
        </Button>
      </div>
    </Card>
  )
}

function topicMinutes(tree: TopicTree): number {
  return tree.reduce<number>((n, t) => n + (Array.isArray(t) ? topicMinutes(t[1]) : typeof t === 'string' ? 0 : (t.minutes ?? 0)), 0)
}

function TopicList({ tree, depth = 0 }: { tree: TopicTree; depth?: number }) {
  return (
    <ol className={cn('space-y-1 text-sm', depth === 0 ? 'list-decimal pl-5 marker:text-muted' : 'mt-1 list-disc pl-5 marker:text-line')}>
      {tree.map((node) => {
        const name = topicName(node)
        const sub = Array.isArray(node) ? node[1] : null
        const leaf = typeof node === 'string' || Array.isArray(node) ? null : node
        return (
          <li key={name} className={depth === 0 ? 'text-ink' : 'text-muted'}>
            {leaf?.url ? (
              <a href={leaf.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                {name} <ExternalLink className="size-3 shrink-0" aria-label="abre o vídeo em outra aba" />
              </a>
            ) : (
              name
            )}
            {leaf?.minutes ? <span className="ml-2 text-xs text-muted">{leaf.minutes} min</span> : null}
            {sub && <TopicList tree={sub} depth={depth + 1} />}
          </li>
        )
      })}
    </ol>
  )
}

function CareerDetail({ trail, onBack, onInstall, embedded }: { trail: CareerTrail; onBack: () => void; onInstall: () => void; embedded?: boolean }) {
  const [open, setOpen] = useState<string | null>(trail.subjects[0]?.key ?? null)
  const total = trail.subjects.reduce((a, s) => a + s.weight, 0)
  const max = Math.max(...trail.subjects.map((s) => s.weight))
  const ordered = useMemo(() => (trail.sequential ? trail.subjects : [...trail.subjects].sort((a, b) => b.weight - a.weight)), [trail])
  return (
    <div>
      {!embedded && (
        <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Trilhas
        </button>
      )}
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden>{trail.icon}</span> {trail.name}
          </span>
        }
        description={trail.summary}
        actions={
          <Button variant="primary" size="lg" icon={<Plus className="size-4" />} onClick={onInstall}>
            Adicionar ao meu estudo
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-2">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-muted">
            <Info className="size-3.5" /> {trail.basis} {trail.sequential ? 'Cursos na ordem recomendada: faça um por vez. Clique numa aula para abrir o vídeo.' : 'Matérias ordenadas pelo peso; tópicos na ordem de estudo.'}
          </p>
          {ordered.map(({ key, weight, note }, position) => {
            const s = subjectByKey(key)
            const isOpen = open === key
            return (
              <Card key={key} className="overflow-hidden">
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen}>
                  <span className="text-xl leading-none" aria-hidden>
                    {s.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{s.name}</span>
                    <span className="block text-xs text-muted">
                      {trail.sequential
                        ? `Curso ${position + 1} de ${ordered.length} · ${countTopics(s.topics)} aulas · ${(topicMinutes(s.topics) / 60).toFixed(1).replace('.', ',')} h de vídeo`
                        : `${trail.area === 'Concursos' ? `${weight} questão(ões)/itens` : `relevância ${weight}/10`} · ${Math.round((weight / total) * 100)}% do tempo · ${countTopics(s.topics)} tópicos`}
                      {note ? ` · ${note}` : ''}
                    </span>
                    {!trail.sequential && <Progress value={(weight / max) * 100} color={s.color} className="mt-1.5 h-1.5" label={`Peso de ${s.name}`} />}
                  </span>
                  {isOpen ? <ChevronDown className="size-4 shrink-0 text-muted" /> : <ChevronRight className="size-4 shrink-0 text-muted" />}
                </button>
                {isOpen && (
                  <div className="border-t border-line bg-surface px-4 py-3">
                    <TopicList tree={s.topics} />
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted">Pesquisar na internet:</span>
                      {searchLinks(s.name, trail.exam ?? '').map((l) => (
                        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line bg-bg px-2.5 py-1 text-ink hover:bg-surface-2">
                          {l.label} <ExternalLink className="size-3" />
                        </a>
                      ))}
                      {s.references?.map((r) => (
                        <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line bg-bg px-2.5 py-1 text-ink hover:bg-surface-2">
                          {r.title} <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
        <aside className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <Lightbulb className="size-4 text-accent-strong" /> Dicas
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
              {trail.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <Route className="size-4 text-accent-strong" /> Fontes consultadas
            </h2>
            <ul className="space-y-1.5 text-sm">
              {trail.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 text-ink underline-offset-2 hover:underline">
                    {s.title} <ExternalLink className="mt-0.5 size-3 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Editais e roteiros mudam. Confira o edital vigente quando for publicado.</p>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function InstallModal({ state, onClose }: { state: { title: string; items: InstallItem[]; cycleName?: string; allowCycle: boolean; cyclePlan?: CyclePlan } | null; onClose: () => void }) {
  const [withCycle, setWithCycle] = useState(true)
  const [withPlan, setWithPlan] = useState(true)
  const [hours, setHours] = useState('10')
  const [done, setDone] = useState<InstallResult | null>(null)
  const [step, setStep] = useState('')
  const toast = useToast()
  const navigate = useNavigate()
  const install = useTransaction(['subjects', 'topics', 'study_materials', 'study_cycles', 'study_cycle_items'], (b, args: { items: InstallItem[]; minutes: number | null; name?: string; plan?: CyclePlan }) =>
    installTrail(b, args.items, { cycleMinutes: args.minutes, cycleName: args.name, cyclePlan: args.plan, onProgress: setStep }),
  )
  if (!state) return null
  const h = Number(hours.replace(',', '.'))
  const validHours = Number.isFinite(h) && h >= 1 && h <= 200
  const close = () => {
    setDone(null)
    onClose()
  }
  const run = async () => {
    if (state.allowCycle && withCycle && !validHours) return toast.error('Informe entre 1 e 200 horas por volta do ciclo.')
    try {
      const r = await install.mutateAsync({ items: state.items, minutes: state.allowCycle && withCycle ? Math.round(h * 60) : null, name: state.cycleName, plan: state.cyclePlan && withPlan ? state.cyclePlan : undefined })
      setDone(r)
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <Modal
      open
      onClose={close}
      title={done ? 'Trilha adicionada' : `Adicionar "${state.title}"`}
      footer={
        done ? (
          <>
            {done.cycleId && (
              <Button onClick={() => (close(), navigate('/ciclos'))}>Ver ciclo</Button>
            )}
            <Button variant="primary" onClick={() => (close(), navigate('/materias'))}>
              Ir para matérias
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close}>Cancelar</Button>
            <Button variant="primary" onClick={run} loading={install.isPending}>
              {install.isPending ? step || 'Adicionando…' : 'Adicionar'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <ul className="space-y-1.5 text-sm text-ink">
          <li>✓ {done.subjectsCreated} matéria(s) criada(s){done.subjectsReused ? `, ${done.subjectsReused} já existente(s) complementada(s)` : ''}.</li>
          <li>✓ {done.topicsCreated} tópico(s) adicionado(s).</li>
          {done.materialsCreated > 0 && <li>✓ {done.materialsCreated} referência(s) oficial(is) adicionada(s).</li>}
          {done.cycleId && <li>✓ {state.cyclePlan ? 'Ciclo recomendado criado (Inglês + Aula + Prática).' : 'Ciclo de estudos criado com as durações proporcionais aos pesos.'}</li>}
        </ul>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-muted">
            {state.items.length} matéria(s), {state.items.reduce((n, i) => n + countTopics(i.subject.topics), 0)} tópicos. Matérias e tópicos que você já tem (mesmo nome) são reaproveitados e só recebem o que falta — nada é duplicado.
          </p>
          {state.cyclePlan && (
            <div className="space-y-2 rounded-xl border border-line p-3">
              <Checkbox label={`Criar o ciclo recomendado "${state.cyclePlan.name}"`} checked={withPlan} onChange={(e) => setWithPlan(e.target.checked)} />
              <p className="text-xs text-muted">
                {state.cyclePlan.blocks.length} blocos: Inglês, aula do curso da vez e prática, de {state.cyclePlan.blocks[0].minutes} minutos cada. Ao terminar um curso, troque a matéria dos blocos de aula e prática em Ciclo de estudos.
              </p>
            </div>
          )}
          {state.allowCycle && (
            <div className="space-y-3 rounded-xl border border-line p-3">
              <Checkbox label="Criar um ciclo de estudos com as matérias da trilha" checked={withCycle} onChange={(e) => setWithCycle(e.target.checked)} />
              {withCycle && (
                <Field label="Horas por volta do ciclo" hint="O tempo é dividido entre as matérias conforme o peso de cada uma.">
                  {(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} className="w-32" />}
                </Field>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
