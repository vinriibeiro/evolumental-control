import { useState } from 'react'
import { GraduationCap, Image as ImageIcon } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { useTransaction } from '@/hooks/data'
import { useProfile } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'

function imageUrl(input: string) {
  if (!input.trim()) return undefined
  try {
    const url = new URL(input.trim())
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href
  } catch {
    // Mostra a validação no campo.
  }
  return undefined
}

export function CourseCover({ title, automatic, custom, className }: { title: string; automatic?: string; custom?: string; className?: string }) {
  const [failed, setFailed] = useState<string[]>([])
  const src = [custom ? imageUrl(custom) : undefined, automatic].find((url) => url && !failed.includes(url))
  return (
    <div className={cn('course-cover relative isolate overflow-hidden bg-surface-2', className)} aria-hidden>
      <span className="absolute inset-0 flex items-center px-5 text-5xl font-semibold tracking-tighter text-accent-strong/35">{title.trim().slice(0, 2).toLocaleUpperCase('pt-BR')}</span>
      <GraduationCap className="absolute -right-3 -bottom-5 size-32 -rotate-12 text-accent-strong/15" />
      {src && <img key={src} src={src} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed((urls) => [...urls, src])} />}
    </div>
  )
}

export function CourseCoverAction({ coverKey, title, iconOnly }: { coverKey: string; title: string; iconOnly?: boolean }) {
  const profile = useProfile()
  const toast = useToast()
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string>()
  const save = useTransaction(['profiles'], async (backend, url: string | undefined) => {
    const current = await backend.getProfile()
    const courseCovers = { ...current.settings.courseCovers }
    if (url) courseCovers[coverKey] = url
    else delete courseCovers[coverKey]
    await backend.updateProfile({ settings: { ...current.settings, courseCovers } })
  })
  const submit = async () => {
    const url = imageUrl(draft ?? '')
    if (draft?.trim() && !url) return setError('Cole o endereço HTTPS de uma imagem.')
    try {
      await save.mutateAsync(url)
      toast.success('Capa atualizada.')
      setDraft(null)
    } catch (cause) {
      toast.error(cause)
    }
  }
  const open = () => {
    setDraft(profile.data?.settings?.courseCovers?.[coverKey] ?? '')
    setError(undefined)
  }
  return (
    <>
      {iconOnly ? (
        <IconButton label="Editar capa" size="sm" disabled={!profile.isSuccess} onClick={open}><ImageIcon className="size-4" aria-hidden /></IconButton>
      ) : (
        <Button size="sm" disabled={!profile.isSuccess} icon={<ImageIcon className="size-4" aria-hidden />} onClick={open}>Editar capa</Button>
      )}
      <Modal open={draft !== null} onClose={() => setDraft(null)} title="Editar capa" description={title} footer={<><Button onClick={() => setDraft(null)}>Cancelar</Button><Button variant="primary" loading={save.isPending} onClick={() => void submit()}>Salvar capa</Button></>}>
        <form onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <Field label="Endereço da imagem" hint="Apague o endereço para usar a capa automática." error={error}>
            {(id, describedBy) => <Input id={id} aria-describedby={describedBy} value={draft ?? ''} type="url" placeholder="https://…" maxLength={2000} onChange={(event) => { setDraft(event.target.value); setError(undefined) }} />}
          </Field>
        </form>
      </Modal>
    </>
  )
}
