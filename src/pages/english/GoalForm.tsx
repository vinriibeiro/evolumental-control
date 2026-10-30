import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { MAX_ENGLISH_GOAL_MINUTES } from '@/lib/english'

/**
 * Campo da meta diária. Acompanha a meta persistida quando ela carrega ou muda
 * (ex.: 20 padrão → 45 vindo das configurações), mas preserva o que o usuário
 * está digitando: só sincroniza se o campo ainda mostra a meta anterior.
 */
export function GoalForm({
  goal,
  saving,
  onSave,
  onInvalid,
}: {
  goal: number
  saving?: boolean
  onSave: (minutes: number) => void | Promise<void>
  onInvalid?: (message: string) => void
}) {
  const [value, setValue] = useState(String(goal))
  const [synced, setSynced] = useState(goal)
  if (goal !== synced) {
    setSynced(goal)
    if (value === String(synced)) setValue(String(goal))
  }

  const save = async () => {
    const n = Number(value)
    if (!Number.isInteger(n) || n < 1 || n > MAX_ENGLISH_GOAL_MINUTES) {
      onInvalid?.(`A meta deve ser um inteiro entre 1 e ${MAX_ENGLISH_GOAL_MINUTES} minutos.`)
      return
    }
    await onSave(n)
  }

  return (
    <div className="mt-4 flex items-end gap-2">
      <Field label="Meta diária (min)" className="flex-1">
        {(id) => <Input id={id} inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />}
      </Field>
      <Button onClick={save} loading={saving}>
        Salvar
      </Button>
    </div>
  )
}
