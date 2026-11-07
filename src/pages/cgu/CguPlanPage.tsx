import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarClock, Check, ExternalLink, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui/layout'
import { QcLinks } from '@/components/QcLinks'
import { CGU_EXAM_DATE, CGU_PLAN, CGU_SCORING, CGU_START_DATE, type CguTask } from '@/content/cguPlan'
import { useCguPlan } from '@/hooks/useCguPlan'
import { BLOCK_COLORS, BLOCK_LABELS, TOTAL_DAYS, type ScoredBlock, discursiveScore, materialCoverage, minutesOf, overLimit, suggestFocus, tasksForDay } from '@/lib/cguPlan'

const inputClass = 'h-10 w-20 rounded-lg border border-line bg-surface px-2 text-sm tabular text-ink'
const FOCUS_LABEL = { sem_dados: 'sem dados', abaixo: 'abaixo do mínimo', no_limite: 'no limite', ok: 'com folga' } as const
const br = (iso: string) => iso.split('-').reverse().join('/')

/** Plano CGU 2026 (28 dias): tarefas por dia, placar por bloco com foco sugerido, espelho da discursiva e materiais do Drive no catálogo. */
export default function CguPlanPage() {
  const plan = useCguPlan()
  const { hash } = useLocation()
  const [shown, setShown] = useState<number>(plan.day)
  useEffect(() => setShown(plan.day), [plan.day])
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])
  const focus = useMemo(() => suggestFocus(plan.state.scores), [plan.state.scores])
  const dayTasks = useMemo(() => tasksForDay(plan.state, shown), [plan.state, shown])
  const over = overLimit(dayTasks)
  const coverage = useMemo(() => materialCoverage(plan.catalog), [plan.catalog])

  return (
    <div>
      <PageHeader
        title="Plano CGU 2026 · 28 dias"
        description={`AFFC · TI · Ciência de Dados (Cargo 2) · Cebraspe · prova em ${br(CGU_EXAM_DATE)} · dia 1 em ${br(CGU_START_DATE)} · até 180 min por dia · questões no QConcursos (banca Cebraspe).`}
        actions={
          <Button variant="primary" onClick={() => setShown(plan.day)}>
            Hoje: dia {plan.day}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="placar">
          <CardHeader title="Placar por bloco" description="Lance certas e erradas do diagnóstico ou do último simulado. A projeção usa a nota líquida (certo − errado) e os mínimos do edital." />
          <div className="px-5 py-3">
            <ul className="divide-y divide-line">
              {focus.map((f) => {
                const s = plan.state.scores[f.block] ?? { certas: 0, erradas: 0 }
                const set = (patch: Partial<typeof s>) => plan.score(f.block, { ...s, ...patch })
                return (
                  <li key={f.block} className="flex flex-wrap items-center gap-2 py-2.5">
                    <Badge color={BLOCK_COLORS[f.block]}>{BLOCK_LABELS[f.block]}</Badge>
                    <label className="flex items-center gap-1 text-xs text-muted">
                      certas
                      <input className={inputClass} type="number" min={0} inputMode="numeric" value={s.certas} onChange={(e) => set({ certas: Math.max(0, Number(e.target.value) || 0) })} aria-label={`Certas ${f.block}`} />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-muted">
                      erradas
                      <input className={inputClass} type="number" min={0} inputMode="numeric" value={s.erradas} onChange={(e) => set({ erradas: Math.max(0, Number(e.target.value) || 0) })} aria-label={`Erradas ${f.block}`} />
                    </label>
                    <span className="tabular text-sm text-ink">
                      {f.status === 'sem_dados' ? '—' : `${f.projetado} pts`} / mín. {f.minimo}
                    </span>
                    <span className={`text-xs ${f.status === 'abaixo' ? 'font-semibold text-red-700' : 'text-muted'}`}>{FOCUS_LABEL[f.status]}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Foco sugerido: <span className="font-medium text-ink">{focus.map((f) => f.block).join(' → ')}</span>. Bloco abaixo do mínimo recebe as questões extras dos dias de revisão; P3 vale 180 dos 260 pontos.
            </p>
          </div>
        </Card>

        <Card id="discursiva">
          <CardHeader title="Espelho da discursiva" description="Edital, item 9: NQ1 = NC − 6×NE÷TL (30 linhas, 30 pts); NQ2 = NC − 14×NE÷TL (60 linhas, 70 pts). Mínimo 50 na soma." />
          <div className="px-5 py-3">
            <Espelho />
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted">
              <li>Conteúdo (NC): respondeu ao comando? Cada aspecto pedido tem parágrafo próprio? Usou os termos do edital?</li>
              <li>Estrutura: introdução que delimita, desenvolvimento por aspecto, conclusão que fecha a situação-problema.</li>
              <li>Erros (NE): grafia, concordância, regência, pontuação e vocabulário impróprio. Conte um a um.</li>
              <li>TL: só linhas efetivamente escritas; nada fora do espaço ou além do limite conta.</li>
            </ol>
          </div>
        </Card>
      </div>

      <Card className="mt-4" id="edital">
        <CardHeader
          title="Edital consolidado (conferido em 06/11/2026)"
          description="Edital nº 1 (8/10/2026) e Edital nº 2 (14/10/2026, retificação só do subitem 6.2.4 e de datas de atendimento especializado). Conteúdo e data da prova inalterados."
          action={
            <a className="flex items-center gap-1 text-xs text-muted underline" href="https://www.cebraspe.org.br/concursos/cgu_26_affc" target="_blank" rel="noopener noreferrer">
              Cebraspe <ExternalLink className="size-3" />
            </a>
          }
        />
        <div className="grid gap-2 px-5 py-3 text-sm text-ink sm:grid-cols-3">
          {(['P1', 'P2', 'P3'] as ScoredBlock[]).map((b) => (
            <p key={b} className="rounded-lg bg-surface px-3 py-2">
              <span className="font-medium">{BLOCK_LABELS[b]}</span>
              <br />
              <span className="text-xs text-muted">
                {CGU_SCORING[b].itens} itens × {CGU_SCORING[b].peso.toFixed(2).replace('.', ',')} · mínimo {CGU_SCORING[b].minimo}
              </span>
            </p>
          ))}
        </div>
        <p className="px-5 pb-3 text-xs text-muted">
          Total mínimo 78 de 260. Discursiva à tarde (3h30): questão de 30 linhas (complementares) + situação-problema de 60 linhas (específicos). Programa completo por subitem em <code>banco-questoes/cgu/programa-cgu-2026.md</code>.
        </p>
      </Card>

      <Card className="mt-4" id="materiais" data-testid="cgu-materiais">
        <CardHeader
          title="Materiais do Drive no catálogo"
          description={
            !plan.catalogReady
              ? 'Carregando o catálogo de Cursos…'
              : coverage.ok === coverage.total
                ? `Todos os ${coverage.total} vídeos e PDFs do plano abrem dentro do app.`
                : `${coverage.ok} de ${coverage.total} vídeos e PDFs do plano abrem dentro do app${coverage.notImported ? ` · ${coverage.notImported} fora do catálogo` : ''}${coverage.missing ? ` · ${coverage.missing} indisponíveis ou ocultos` : ''}.`
          }
          action={
            <Link to="/cursos" className="text-xs text-muted underline">
              Cursos → Pastas do Drive
            </Link>
          }
        />
        {plan.catalogReady && coverage.ok < coverage.total && (
          <ul className="divide-y divide-line px-5">
            {coverage.folders
              .filter((f) => f.ok < f.total)
              .map((f) => (
                <li key={f.folderId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 break-words text-ink">{f.folder}</span>
                  <span className="tabular text-xs text-muted">
                    {f.ok}/{f.total} no app{f.notImported ? ` · ${f.notImported} fora do catálogo` : ''}{f.missing ? ` · ${f.missing} indisponível(is)` : ''}
                  </span>
                  <a className="flex items-center gap-1 text-xs text-muted underline" href={`https://drive.google.com/drive/folders/${f.folderId}`} target="_blank" rel="noopener noreferrer">
                    Drive <ExternalLink className="size-3" />
                  </a>
                </li>
              ))}
          </ul>
        )}
        <p className="px-5 pb-3 text-xs text-muted">
          “Fora do catálogo” = a importação em Cursos não trouxe este arquivo. Em Cursos → Pastas do Drive, use <span className="font-medium text-ink">Atualizar do Drive</span> na pasta “TI Descomplicada – Fiscal e Controle” e veja o relatório (pastas não lidas, leitura parcial, pastas deixadas de fora). Enquanto isso, “Abrir” leva ao arquivo no Drive.
        </p>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title={`Dia ${shown} · ${CGU_PLAN[shown - 1]?.theme ?? ''}`}
          description={`${minutesOf(dayTasks)} min previstos${over ? ` · ${over} min acima do limite de 180: adie a última tarefa` : ''}`}
          action={
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={shown <= 1} onClick={() => setShown((d) => d - 1)} aria-label="Dia anterior">
                ‹
              </Button>
              <Button size="sm" variant="ghost" disabled={shown >= TOTAL_DAYS} onClick={() => setShown((d) => d + 1)} aria-label="Próximo dia">
                ›
              </Button>
            </div>
          }
        />
        <ul className="divide-y divide-line px-5">
          {dayTasks.map((t) => (
            <TaskRow key={t.id} task={t} shownDay={shown} plan={plan} />
          ))}
          {dayTasks.length === 0 && <li className="py-4 text-sm text-muted">Nada neste dia (tudo foi adiado).</li>}
        </ul>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Os 28 dias" description="Toque em um dia para ver as tarefas. P3 primeiro, P1 e P2 protegidos todo dia, discursiva nos dias 7, 10, 17, 21 e 26, simulados nos dias 13, 20 e 27." />
        <ol className="grid gap-1 px-5 py-3 sm:grid-cols-2">
          {CGU_PLAN.map((d) => {
            const ts = tasksForDay(plan.state, d.day)
            const done = ts.filter((t) => plan.state.done[t.id]).length
            return (
              <li key={d.day}>
                <button type="button" onClick={() => setShown(d.day)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface ${d.day === shown ? 'bg-surface font-medium' : ''}`}>
                  <span className="tabular w-8 shrink-0 text-muted">{d.day}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{d.theme}</span>
                  <span className="tabular shrink-0 text-xs text-muted">
                    {done}/{ts.length} · {minutesOf(ts)} min
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </Card>
      <p className="mt-4 text-xs text-muted">
        Progresso desta trilha fica nesta conta e neste navegador; o progresso das aulas em si fica em{' '}
        <Link to="/cursos" className="underline">
          Cursos
        </Link>
        .
      </p>
    </div>
  )
}

function TaskRow({ task, shownDay, plan }: { task: CguTask; shownDay: number; plan: ReturnType<typeof useCguPlan> }) {
  const done = Boolean(plan.state.done[task.id])
  const r = plan.resolve(task)
  const moved = task.day !== shownDay
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={BLOCK_COLORS[task.block]}>{BLOCK_LABELS[task.block]}</Badge>
        <span className="tabular text-xs text-muted">{task.minutes} min</span>
        {moved && <span className="text-xs text-muted">adiada do dia {task.day}</span>}
        {done && <Badge color="#1f7a4d">feita</Badge>}
      </div>
      <p className={`mt-1 break-words font-medium ${done ? 'text-muted line-through' : 'text-ink'}`}>{task.title}</p>
      <p className="break-words text-sm text-muted">
        <span className="font-medium text-ink">Abrir:</span> {task.open}
      </p>
      <p className="break-words text-sm text-muted">
        <span className="font-medium text-ink">Até onde:</span> {task.until}
      </p>
      {r.hint && task.link.kind !== 'route' && <p className="mt-1 text-xs text-muted">{r.hint}</p>}
      {r.links && <QcLinks links={r.links} />}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="dark" icon={r.external ? <ExternalLink className="size-3.5" /> : <Play className="size-3.5" />} onClick={() => plan.open(task)}>
          {plan.state.current === task.id ? 'Continuar' : 'Abrir'}
        </Button>
        {done ? (
          <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => plan.reopen(task)}>
            Desfazer
          </Button>
        ) : (
          <>
            <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} onClick={() => plan.complete(task)}>
              Concluir
            </Button>
            <Button size="sm" variant="ghost" icon={<CalendarClock className="size-3.5" />} disabled={shownDay >= TOTAL_DAYS} onClick={() => plan.postponeTo(task, shownDay + 1)}>
              Adiar
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

function Espelho() {
  const [v, setV] = useState({ nc1: 0, ne1: 0, tl1: 30, nc2: 0, ne2: 0, tl2: 60 })
  const num = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: Math.max(0, Number(e.target.value) || 0) }))
  const nq1 = discursiveScore(1, v.nc1, v.ne1, v.tl1)
  const nq2 = discursiveScore(2, v.nc2, v.ne2, v.tl2)
  const total = Math.round((nq1 + nq2) * 100) / 100
  const row = (label: string, nc: keyof typeof v, ne: keyof typeof v, tl: keyof typeof v, nq: number, max: number) => (
    <div className="flex flex-wrap items-center gap-2 py-1.5 text-xs text-muted">
      <span className="w-full font-medium text-ink sm:w-40">{label}</span>
      <label className="flex items-center gap-1">
        NC <input className={inputClass} type="number" min={0} max={max} inputMode="numeric" value={v[nc]} onChange={num(nc)} aria-label={`${label} conteúdo`} />
      </label>
      <label className="flex items-center gap-1">
        NE <input className={inputClass} type="number" min={0} inputMode="numeric" value={v[ne]} onChange={num(ne)} aria-label={`${label} erros`} />
      </label>
      <label className="flex items-center gap-1">
        TL <input className={inputClass} type="number" min={1} inputMode="numeric" value={v[tl]} onChange={num(tl)} aria-label={`${label} linhas`} />
      </label>
      <span className="tabular text-sm text-ink">= {nq.toFixed(2).replace('.', ',')}</span>
    </div>
  )
  return (
    <div>
      {row('Questão (30 linhas)', 'nc1', 'ne1', 'tl1', nq1, 30)}
      {row('Situação-problema (60 linhas)', 'nc2', 'ne2', 'tl2', nq2, 70)}
      <p className={`mt-1 text-sm ${total >= CGU_SCORING.P4.minimo ? 'text-ink' : 'font-semibold text-red-700'}`}>
        Nota final na discursiva: {total.toFixed(2).replace('.', ',')} (mínimo {CGU_SCORING.P4.minimo})
      </p>
    </div>
  )
}
