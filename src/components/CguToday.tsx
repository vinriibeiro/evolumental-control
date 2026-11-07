import { Link } from 'react-router-dom'
import { CalendarClock, Check, ExternalLink, GraduationCap, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge, Card, CardHeader, Progress } from '@/components/ui/layout'
import { QcLinks } from '@/components/QcLinks'
import { useCguPlan } from '@/hooks/useCguPlan'
import { BLOCK_COLORS, BLOCK_LABELS, TOTAL_DAYS, minutesOf } from '@/lib/cguPlan'

/** Cartão "CGU · Hoje" em Meu espaço: primeira tarefa pendente do dia, minutos previstos, Começar/Continuar e acesso ao plano. */
export function CguToday() {
  const plan = useCguPlan()
  const planned = minutesOf(plan.tasks)
  const done = planned - minutesOf(plan.pending)
  const task = plan.next
  const resolved = task ? plan.resolve(task) : null
  const continuing = Boolean(task && plan.state.current === task.id)

  return (
    <Card data-testid="cgu-today">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <GraduationCap className="size-4" /> CGU · Hoje
          </span>
        }
        description={`Dia ${plan.day} de ${TOTAL_DAYS} · ${done} de ${planned} min`}
        action={
          <Link to="/cgu" className="text-xs text-muted underline">
            Plano
          </Link>
        }
      />
      <div className="px-5 py-3">
        <Progress value={planned ? (done / planned) * 100 : 0} className="mb-3 h-2" label="Progresso do dia" />
        {!task ? (
          <p className="py-2 text-sm text-ink">
            Dia {plan.day} concluído. 🎉{' '}
            <Link to="/cgu" className="underline">
              Ver o próximo dia
            </Link>
          </p>
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={BLOCK_COLORS[task.block]}>{BLOCK_LABELS[task.block]}</Badge>
              <span className="tabular text-xs text-muted">{task.minutes} min</span>
              <span className="text-xs text-muted">{plan.pending.length} tarefa(s) pendente(s)</span>
            </div>
            <p className="mt-2 break-words font-medium text-ink">{task.title}</p>
            <p className="mt-1 break-words text-sm text-muted">
              <span className="font-medium text-ink">Abrir:</span> {task.open}
            </p>
            <p className="mt-1 break-words text-sm text-muted">
              <span className="font-medium text-ink">Até onde:</span> {task.until}
            </p>
            {resolved?.hint && task.link.kind !== 'route' && (
              <p className="mt-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted" role="note">
                {resolved.hint}
              </p>
            )}
            {resolved?.links && <QcLinks links={resolved.links} />}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="dark" icon={resolved?.external ? <ExternalLink className="size-4" /> : <Play className="size-4" />} onClick={() => plan.open(task)}>
                {continuing ? 'Continuar' : 'Começar'}
              </Button>
              <Button variant="primary" icon={<Check className="size-4" />} onClick={() => plan.complete(task)}>
                Concluir
              </Button>
              <Button
                variant="ghost"
                icon={<CalendarClock className="size-4" />}
                disabled={plan.day >= TOTAL_DAYS}
                onClick={() => plan.postponeTo(task, plan.day + 1)}
                aria-label="Adiar para amanhã"
              >
                Adiar
              </Button>
            </div>
          </div>
        )}
        {plan.tasks.some((t) => plan.state.done[t.id]) && (
          <p className="mt-3 flex items-center gap-1 text-xs text-muted">
            <RotateCcw className="size-3" /> Concluídas hoje: {plan.tasks.filter((t) => plan.state.done[t.id]).length}. Desfazer no{' '}
            <Link to="/cgu" className="underline">
              plano
            </Link>
            .
          </p>
        )}
      </div>
    </Card>
  )
}
