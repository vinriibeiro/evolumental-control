import { useMemo } from 'react'
import { Field, Select } from '@/components/ui/Field'
import { useSubjects, useTopics } from '@/hooks/domain'
import { buildTree, flattenTree } from '@/lib/tree'

interface Props {
  subjectId: string | null
  topicId: string | null
  onChange: (v: { subjectId: string | null; topicId: string | null }) => void
  subjectRequired?: boolean
  subjectLabel?: string
  topicLabel?: string
  className?: string
  error?: string | null
}

/** Seletor de matéria e tópico/subtópico (hierarquia indentada). */
export function SubjectTopicSelect({ subjectId, topicId, onChange, subjectRequired, subjectLabel = 'Matéria', topicLabel = 'Tópico (opcional)', className, error }: Props) {
  const subjects = useSubjects()
  const topics = useTopics(subjectId ?? null)
  const options = useMemo(() => flattenTree(buildTree(topics.data ?? [])), [topics.data])
  return (
    <div className={className ?? 'grid gap-4 sm:grid-cols-2'}>
      <Field label={subjectLabel} required={subjectRequired} error={error}>
        {(id, d) => (
          <Select
            id={id}
            aria-describedby={d}
            value={subjectId ?? ''}
            invalid={Boolean(error)}
            onChange={(e) => onChange({ subjectId: e.target.value || null, topicId: null })}
          >
            <option value="">{subjects.isPending ? 'Carregando…' : subjectRequired ? 'Selecione…' : 'Sem matéria'}</option>
            {(subjects.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={topicLabel}>
        {(id, d) => (
          <Select id={id} aria-describedby={d} value={topicId ?? ''} disabled={!subjectId} onChange={(e) => onChange({ subjectId, topicId: e.target.value || null })}>
            <option value="">{!subjectId ? 'Escolha a matéria primeiro' : 'Matéria inteira'}</option>
            {options.map((t) => (
              <option key={t.id} value={t.id}>
                {'  '.repeat(t.depth)}
                {t.depth > 0 ? '└ ' : ''}
                {t.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  )
}
