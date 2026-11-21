// Preferências do planejamento: usadas só como limites e preferências ao "Reorganizar minha semana".
// Nada aqui é alterado automaticamente pelo sistema.
import { useState } from 'react'
import { CalendarCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { BASE_CATEGORIES } from '@/lib/tasks'
import type { UserSettings } from '@/types/db'

export function PlanningSection({ settings, onSave, Section }: { settings: UserSettings; onSave: (p: Partial<UserSettings>) => unknown; Section: (p: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode }) => React.ReactNode }) {
  const [limit, setLimit] = useState(settings.dailyStudyLimitMinutes ? String(settings.dailyStudyLimitMinutes / 60) : '')
  const [start, setStart] = useState(settings.preferredWindow?.start ?? '')
  const [end, setEnd] = useState(settings.preferredWindow?.end ?? '')
  const [error, setError] = useState<string | null>(null)
  const custom = settings.taskCategories ?? []

  const save = () => {
    const hours = limit.trim() === '' ? 0 : Number(limit.replace(',', '.'))
    if (!(hours >= 0 && hours <= 24)) return setError('Limite diário entre 0 e 24 horas (vazio = sem limite).')
    if ((start && !end) || (!start && end)) return setError('Informe o início e o fim da janela preferida, ou deixe os dois vazios.')
    if (start && end && start >= end) return setError('O fim da janela preferida precisa ser depois do início.')
    setError(null)
    onSave({ dailyStudyLimitMinutes: Math.round(hours * 60), preferredWindow: start && end ? { start, end } : undefined })
  }

  return (
    <Section icon={<CalendarCheck className="size-5" />} title="Planejamento" description="Limites e preferências usados ao reorganizar a semana. A disponibilidade por dia fica em Meu Planejamento › Mais ações › Disponibilidade e matérias.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Limite de estudo por dia (horas)" hint="Vazio = sem limite.">
          {(id, d) => <Input id={id} aria-describedby={d} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Sem limite" />}
        </Field>
        <Field label="Prefiro estudar a partir de">{(id) => <Input id={id} type="time" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label="Até">{(id) => <Input id={id} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Button className="mt-4" variant="primary" onClick={save}>
        Salvar planejamento
      </Button>

      <p className="mt-6 mb-2 text-sm font-medium text-ink">Categorias de tarefas</p>
      <div className="flex flex-wrap gap-1.5">
        {BASE_CATEGORIES.map((c) => (
          <span key={c.id} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">
            {c.label}
          </span>
        ))}
        {custom.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-line py-0.5 pr-1 pl-2.5 text-xs text-ink">
            {c.label}
            <button type="button" aria-label={`Remover a categoria ${c.label}`} className="rounded-full p-0.5 text-muted hover:text-ink" onClick={() => onSave({ taskCategories: custom.filter((x) => x.id !== c.id) })}>
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Novas categorias são criadas direto no formulário de tarefa ("Nova categoria…"). Remover uma categoria não apaga tarefas: elas continuam com o nome antigo.</p>
    </Section>
  )
}
