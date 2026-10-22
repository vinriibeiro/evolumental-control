import { useState } from 'react'
import { ExternalLink, Link2, Trash2 } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useToast } from '@/components/ui/feedback'
import { useAll, useInsert, useRemove } from '@/hooks/data'
import { eq } from '@/lib/data/types'
import { urlSchema } from '@/lib/validation'

/** Materiais e links do tópico (ex.: lei, videoaula, PDF). */
export function Materials({ subjectId, topicId }: { subjectId: string; topicId: string }) {
  const materials = useAll('study_materials', { filters: [eq('topic_id', topicId)], order: [{ column: 'created_at' }] })
  const insert = useInsert('study_materials')
  const remove = useRemove('study_materials')
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const add = async () => {
    const u = urlSchema.safeParse(url)
    if (!title.trim()) return setError('Informe um título.')
    if (!u.success) return setError(u.error.issues[0].message)
    setError(null)
    try {
      await insert.mutateAsync({ subject_id: subjectId, topic_id: topicId, title: title.trim().slice(0, 300), url: u.data || null })
      setTitle('')
      setUrl('')
    } catch (e) {
      toast.error(e)
    }
  }

  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Link2 className="size-4 text-accent-strong" /> Materiais e links
      </h3>
      <ul className="mb-2 space-y-1">
        {(materials.data ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            {m.url ? (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-1 text-ink hover:underline">
                <span className="truncate">{m.title}</span>
                <ExternalLink className="size-3 shrink-0" />
              </a>
            ) : (
              <span className="min-w-0 flex-1 truncate text-ink">{m.title}</span>
            )}
            <IconButton label={`Remover ${m.title}`} size="sm" onClick={() => remove.mutate(m.id)}>
              <Trash2 className="size-3.5" />
            </IconButton>
          </li>
        ))}
      </ul>
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <Field error={error}>{() => <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex.: Lei 9.784)" aria-label="Título do material" />}</Field>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… (opcional)" aria-label="Link do material" />
        <Button type="submit" size="md" loading={insert.isPending}>
          Adicionar
        </Button>
      </form>
    </div>
  )
}
