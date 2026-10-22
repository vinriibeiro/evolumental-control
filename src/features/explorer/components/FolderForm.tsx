import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ColorInput, Field, Input } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/layout'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { SUBJECT_COLORS } from '@/lib/labels'
import type { StudyFolder } from '@/types/db'
import { createFolder } from '../service'
import { eq } from '@/lib/data/types'
import { useExplorerOp } from '../useExplorer'

interface Props {
  open: boolean
  onClose: () => void
  folder?: StudyFolder | null
  parent?: StudyFolder | null
  nextOrder?: number
  onCreated?: (f: StudyFolder) => void
}

export function FolderForm({ open, onClose, folder, parent = null, nextOrder = 0, onCreated }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<StudyFolder['kind']>('folder')
  const [color, setColor] = useState<string | null>(null)
  const [icon, setIcon] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const op = useExplorerOp()
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setName(folder?.name ?? '')
    setKind(folder?.kind ?? (parent ? 'folder' : 'area'))
    setColor(folder?.color ?? null)
    setIcon(folder?.icon ?? '')
    setError(null)
  }, [open, folder, parent])

  const submit = async () => {
    const clean = name.trim()
    if (!clean) return setError('Informe um nome.')
    if (clean.length > 160) return setError('Use no máximo 160 caracteres.')
    setBusy(true)
    try {
      const data = { name: clean, color, icon: icon.trim().slice(0, 40) || null }
      if (folder) {
        await op((b) => b.update('study_folders', [eq('id', folder.id)], data))
        toast.success('Pasta atualizada.')
      } else {
        const row = await op((b) => createFolder(b, { ...data, kind, parent_id: parent?.id ?? null, sort_order: nextOrder }))
        toast.success(kind === 'area' ? 'Área de estudo criada.' : 'Pasta criada.')
        onCreated?.(row)
      }
      onClose()
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  const isArea = (folder?.kind ?? kind) === 'area'
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={folder ? (isArea ? 'Editar área de estudo' : 'Editar pasta') : parent ? `Nova pasta em "${parent.name}"` : isArea ? 'Nova área de estudo' : 'Nova pasta'}
      description={!folder && !parent ? 'Áreas agrupam um objetivo inteiro (ex.: um concurso, a faculdade). Pastas organizam matérias dentro dela.' : undefined}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            Salvar
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        {!folder && !parent && (
          <Segmented
            label="Tipo"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'area', label: 'Área de estudo' },
              { value: 'folder', label: 'Pasta' },
            ]}
          />
        )}
        <Field label="Nome" required error={error}>
          {(id, d) => <Input id={id} aria-describedby={d} autoFocus value={name} invalid={Boolean(error)} onChange={(e) => setName(e.target.value)} placeholder={isArea ? 'Ex.: Concurso SEFAZ' : 'Ex.: Direito'} />}
        </Field>
        <Field label="Ícone (emoji, opcional)">
          {(id) => <Input id={id} value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="Ex.: ⚖️" maxLength={8} className="w-28" />}
        </Field>
        <Field label="Cor (opcional)">
          {() => (
            <div className="flex flex-wrap items-center gap-3">
              <ColorInput value={color ?? '#000000'} onChange={setColor} colors={SUBJECT_COLORS} />
              {color && (
                <Button size="sm" variant="ghost" onClick={() => setColor(null)}>
                  Sem cor
                </Button>
              )}
            </div>
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
