import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Flame, Languages } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Card, PageHeader, Progress, StatCard } from '@/components/ui/layout'
import { Spinner, useToast } from '@/components/ui/feedback'
import { useTransaction } from '@/hooks/data'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import {
  ENGLISH_SKILLS,
  ENGLISH_SKILL_LABELS,
  goalMet,
  minutesOnDay,
  practicedDaysInMonth,
  secondsByDay,
  streak,
  totalsBySkill,
  type EnglishSkill,
} from '@/lib/english'
import { addDays, addMonths, eachDay, endOfMonth, formatDayKey, formatDuration, startOfMonth, startOfWeek, todayKey } from '@/lib/time'
import { loadPractices, recordPractice, type PracticeInput } from '@/services/english'
import { GoalForm } from './GoalForm'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function EnglishPage() {
  const backend = useBackend()
  const settings = useSettings()
  const tz = settings.timezone
  const goal = settings.englishGoalMinutes
  const today = todayKey(tz)
  const practices = useQuery({
    queryKey: ['data', ['study_sessions', 'study_session_pauses', 'subjects', 'topics'], 'english', backend.kind],
    queryFn: () => loadPractices(backend),
  })
  const list = useMemo(() => practices.data ?? [], [practices.data])
  const todayMin = minutesOnDay(list, today, tz)
  const days = streak(list, today, tz)
  const totals = totalsBySkill(list)

  return (
    <div>
      <PageHeader
        title="Inglês"
        description="Prática diária, sem material: registre alguns minutos de escuta, fala, leitura, escrita ou vocabulário e mantenha a sequência."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <PracticeForm />
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink">Hoje</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {todayMin} <span className="text-base font-normal text-muted">/ {goal} min</span>
          </p>
          <Progress className="mt-2" value={(todayMin / goal) * 100} label={`${todayMin} de ${goal} minutos de inglês hoje`} />
          <p className="mt-2 text-sm text-muted">{goalMet(todayMin, goal) ? 'Meta do dia cumprida.' : `Faltam ${goal - todayMin} min para a meta.`}</p>
          <GoalSettings goal={goal} />
        </Card>
      </div>

      {practices.isPending ? (
        <Spinner label="Carregando práticas…" />
      ) : practices.isError ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          Não foi possível carregar as práticas.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Sequência" value={`${days} ${days === 1 ? 'dia' : 'dias'}`} icon={<Flame className="size-4" />} hint="Dias seguidos com prática" />
            {ENGLISH_SKILLS.map((s) => (
              <StatCard key={s} label={ENGLISH_SKILL_LABELS[s]} value={formatDuration(totals[s])} hint="Total praticado" />
            ))}
          </div>
          <Card className="mt-4 p-5">
            <MonthCalendar byDay={secondsByDay(list, tz)} today={today} practicedIn={(m) => practicedDaysInMonth(list, m, tz)} goal={goal} />
          </Card>
        </>
      )}
    </div>
  )
}

function PracticeForm() {
  const toast = useToast()
  const [skill, setSkill] = useState<EnglishSkill>('listening')
  const [minutes, setMinutes] = useState('20')
  const [error, setError] = useState<string | null>(null)
  const add = useTransaction(['study_sessions', 'subjects', 'topics'], (b, input: PracticeInput) => recordPractice(b, input))

  const submit = async () => {
    setError(null)
    const mins = Number(minutes)
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) return setError('Informe os minutos como número inteiro entre 1 e 600.')
    try {
      await add.mutateAsync({ skill, minutes: mins })
      toast.success('Prática registrada.')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <p className="font-semibold text-ink">Registrar prática</p>
        <p className="text-sm text-muted">A prática é salva como sessão da matéria Inglês, terminando agora.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <Field label="Habilidade">
          {(id) => (
            <Select id={id} value={skill} onChange={(e) => setSkill(e.target.value as EnglishSkill)}>
              {ENGLISH_SKILLS.map((s) => (
                <option key={s} value={s}>
                  {ENGLISH_SKILL_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Minutos">{(id) => <Input id={id} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />}</Field>
        <Button variant="primary" icon={<Languages className="size-4" />} onClick={submit} loading={add.isPending}>
          Registrar
        </Button>
      </div>
    </div>
  )
}

function GoalSettings({ goal }: { goal: number }) {
  const toast = useToast()
  const update = useUpdateSettings()
  const save = async (n: number) => {
    try {
      await update.mutateAsync({ englishGoalMinutes: n })
      toast.success('Meta diária atualizada.')
    } catch (e) {
      toast.error(e)
    }
  }
  return <GoalForm goal={goal} saving={update.isPending} onSave={save} onInvalid={(m) => toast.error(new Error(m))} />
}

function MonthCalendar({
  byDay,
  today,
  practicedIn,
  goal,
}: {
  byDay: Map<string, number>
  today: string
  practicedIn: (month: string) => string[]
  goal: number
}) {
  const [month, setMonth] = useState(() => startOfMonth(today))
  const practiced = practicedIn(month)
  const set = new Set(practiced)
  const cells = eachDay(startOfWeek(month), addDays(startOfWeek(endOfMonth(month)), 6))
  const minutes = (k: string) => Math.floor((byDay.get(k) ?? 0) / 60)
  const monthLabel = formatDayKey(month, 'month')

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold capitalize text-ink">{monthLabel}</h2>
        <div className="flex gap-1">
          <Button aria-label="Mês anterior" icon={<ChevronLeft className="size-4" />} onClick={() => setMonth(addMonths(month, -1))} />
          <Button aria-label="Próximo mês" icon={<ChevronRight className="size-4" />} onClick={() => setMonth(addMonths(month, 1))} disabled={month >= startOfMonth(today)} />
        </div>
      </div>
      <p className="mb-3 text-sm text-muted">
        {practiced.length} {practiced.length === 1 ? 'dia praticado' : 'dias praticados'} neste mês.
      </p>
      <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 font-medium text-muted">
            {w}
          </span>
        ))}
        {cells.map((k) => {
          const inMonth = k.slice(0, 7) === month.slice(0, 7)
          const done = set.has(k)
          return (
            <span
              key={k}
              title={done ? `${minutes(k)} min` : undefined}
              className={cn(
                'rounded-md py-2',
                !inMonth && 'opacity-30',
                done ? (minutes(k) >= goal ? 'bg-primary text-white' : 'bg-primary/30 text-ink') : 'bg-surface text-muted',
                k === today && 'ring-2 ring-primary',
              )}
            >
              {Number(k.slice(8))}
            </span>
          )
        })}
      </div>
      <div className="sr-only">
        <h3>Dias praticados em {monthLabel}</h3>
        {practiced.length === 0 ? (
          <p>Nenhum dia praticado neste mês.</p>
        ) : (
          <ul>
            {practiced.map((k) => (
              <li key={k}>
                {formatDayKey(k, 'long')}: {minutes(k)} min{minutes(k) >= goal ? ', meta cumprida' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
