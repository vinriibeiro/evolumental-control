// Bloco de notas pessoal (o mesmo do antigo "Meu espaço de estudos": o texto já salvo continua aqui).
// Salva sozinho, um pouco depois de parar de digitar.
import { useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/Field'
import { useDebounced } from '@/hooks/useDebounced'
import { useUpdateSettings } from '@/hooks/useSettings'

export function Scratchpad({ initial }: { initial: string }) {
  const [text, setText] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const debounced = useDebounced(text, 800)
  const update = useUpdateSettings()
  useEffect(() => {
    if (!dirty) setText(initial)
  }, [initial, dirty])
  useEffect(() => {
    if (!dirty || debounced !== text) return
    update.mutate({ scratchpad: debounced.slice(0, 20000) }, { onSuccess: () => setDirty(false) })
  }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <Textarea
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setDirty(true)
        }}
        placeholder="Dúvidas para pesquisar, lembretes, ideias…"
        aria-label="Bloco de notas"
        maxLength={20000}
      />
      <p className="mt-1 text-right text-[11px] text-muted" aria-live="polite">
        {update.isPending ? 'Salvando…' : dirty ? 'Alterações não salvas' : 'Salvo'}
      </p>
    </div>
  )
}
