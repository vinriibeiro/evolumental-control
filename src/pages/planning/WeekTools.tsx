// Ferramentas da semana: copiar a semana anterior e usar modelos de semana.
// Tudo mostra o que será criado ANTES de criar; o que já existe na semana de destino é ignorado.
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Spinner, useToast } from '@/components/ui/feedback'
import { invalidateTables } from '@/hooks/data'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { addDays, formatDayKey, type DayKey } from '@/lib/time'
import { planTemplate, planWeekCopy, templateFromWeek, weekTasks } from '@/services/tasks'
import type { Insert, WeekTemplate } from '@/types/db'

export function WeekTools({ open, onClose, weekStart }: { open: boolean; onClose: () => void; weekStart: DayKey }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const prevStart = addDays(weekStart, -7)
  const data = useQuery({
    queryKey: ['data', ['calendar_tasks'], 'week-tools', backend.kind, weekStart],
    enabled: open,
    queryFn: async () => ({ previous: await weekTasks(backend, prevStart), current: await weekTasks(backend, weekStart) }),
  })
  const templates = settings.weekTemplates ?? []
  const copy = data.data ? planWeekCopy(data.data.previous, data.data.current, prevStart, weekStart) : null
  const weekLabel = `${formatDayKey(weekStart)} a ${formatDayKey(addDays(weekStart, 6))}`

  const create = async (rows: Insert<'calendar_tasks'>[], message: string) => {
    if (!rows.length) return
    setBusy(true)
    try {
      await backend.insert('calendar_tasks', rows)
      toast.success(message)
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
      await invalidateTables(qc, ['calendar_tasks'])
    }
  }

  const saveTemplate = async () => {
    const tasks = data.data?.current ?? []
    const tpl = templateFromWeek(name || `Semana de ${formatDayKey(weekStart)}`, tasks)
    if (!tpl.items.length) return toast.info('Esta semana ainda não tem tarefas para virar modelo.')
    try {
      await updateSettings.mutateAsync({ weekTemplates: [...templates, tpl].slice(-8) })
      setName('')
      toast.success('Modelo salvo.')
    } catch (e) {
      toast.error(e)
    }
  }

  const removeTemplate = (tpl: WeekTemplate) => updateSettings.mutate({ weekTemplates: templates.filter((t) => t.id !== tpl.id) }, { onError: (e) => toast.error(e) })

  return (
    <Modal open={open} onClose={onClose} title="Copiar semana e modelos" description={`Semana de ${weekLabel}`} footer={<Button onClick={onClose}>Fechar</Button>}>
      {data.isPending ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-ink">Copiar a semana anterior</h3>
            <p className="mt-1 text-sm text-muted">
              {copy && copy.create.length > 0
                ? `${copy.create.length} tarefa(s) de ${formatDayKey(prevStart)} a ${formatDayKey(addDays(prevStart, 6))} serão criadas nos mesmos dias e horários desta semana, como pendentes.`
                : 'Não há nada novo para copiar da semana anterior.'}
              {copy && copy.skipped > 0 && ` ${copy.skipped} já existe(m) nesta semana e não será(ão) repetida(s).`} Tarefas recorrentes não são copiadas (elas já se repetem).
            </p>
            <Button className="mt-3" variant="primary" loading={busy} disabled={!copy?.create.length} onClick={() => create(copy!.create, `${copy!.create.length} tarefa(s) copiada(s).`)}>
              Copiar para esta semana
            </Button>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="text-sm font-semibold text-ink">Modelos de semana</h3>
            {templates.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Nenhum modelo salvo. Monte uma semana do seu jeito e salve-a como modelo para reaplicar quando quiser.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                {templates.map((tpl) => {
                  const plan = planTemplate(tpl, weekStart, data.data?.current ?? [])
                  return (
                    <li key={tpl.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{tpl.name}</p>
                        <p className="text-xs text-muted">
                          {tpl.items.length} atividade(s){plan.skipped > 0 ? ` · ${plan.skipped} já nesta semana` : ''}
                        </p>
                      </div>
                      <Button size="sm" loading={busy} disabled={!plan.create.length} onClick={() => create(plan.create, `Modelo aplicado: ${plan.create.length} tarefa(s) criada(s).`)}>
                        Aplicar
                      </Button>
                      <IconButton label={`Excluir modelo ${tpl.name}`} size="sm" onClick={() => removeTemplate(tpl)}>
                        <Trash2 className="size-4 text-muted" />
                      </IconButton>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="mt-3 flex items-end gap-2">
              <Field label="Salvar esta semana como modelo" className="flex-1">
                {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Semana padrão" />}
              </Field>
              <Button onClick={saveTemplate} loading={updateSettings.isPending}>
                Salvar
              </Button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  )
}
