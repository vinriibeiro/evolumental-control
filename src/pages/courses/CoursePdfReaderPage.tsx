import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileText, KeyRound, ShieldCheck, Trash2 } from 'lucide-react'
import { DriveOpenLink } from '@/components/DriveViewer'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Card, PageHeader } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner, errorMessage, useToast } from '@/components/ui/feedback'
import { useCourses } from '@/hooks/useCourses'
import { useLibrary } from '@/hooks/useLibrary'
import { displayTitle } from '@/lib/courseCatalog'
import { isDriveId, isResourceKey } from '@/lib/drive'
import { DRIVE_READ_SCOPE, currentDriveReadToken, getClientId, isClientId, requestDriveReadToken, saveClientId, startDriveRedirect } from '@/lib/googleAuth'
import { PdfReader } from '@/pages/library/PdfReaderPage'
import { DrivePdfStore, readOfflineCoursePdf, type OfflineCoursePdf } from '@/services/drivePdf'
import type { CourseNode } from '@/types/db'

function Ready({ node, token, copy, route, backTo, onReconnect }: { node: CourseNode; token: string | null; copy?: OfflineCoursePdf; route: string; backTo: string; onReconnect: () => void }) {
  const { dbName: scope } = useLibrary()
  const store = useMemo(() => copy ? new DrivePdfStore(scope, node, token, undefined, copy) : new DrivePdfStore(scope, node, token), [scope, node, token, copy])
  const toast = useToast()
  const [saved, setSaved] = useState(Boolean(copy))
  const [pending, setPending] = useState(false)
  const toggleOffline = async () => {
    setPending(true)
    try {
      if (saved) await store.removeOffline(route)
      else await store.saveOffline(route)
      setSaved(!saved)
      toast.success(saved ? 'Cópia offline removida.' : 'PDF salvo neste aparelho para ler sem internet.')
    } catch (error) {
      toast.error(error)
    } finally {
      setPending(false)
    }
  }
  return (
    <PdfReader
      store={store}
      documentId={node.drive_id}
      backTo={backTo}
      backLabel="Voltar ao curso"
      sourceLabel={saved ? 'Cursos · Salvo offline' : 'Cursos · Google Drive'}
      storageNotice="Sua posição e suas marcações ficam neste navegador."
      startInFocus
      documentActions={<Button size="sm" loading={pending} icon={saved ? <Trash2 className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />} onClick={() => void toggleOffline()}>{saved ? 'Remover cópia offline' : 'Salvar para ler offline'}</Button>}
      recovery={<div className="flex flex-wrap items-center gap-3">
        {copy
          ? <Button size="sm" onClick={() => void store.removeOffline(route).then(onReconnect).catch(toast.error)}>Remover cópia e conectar ao Drive</Button>
          : <Button size="sm" onClick={onReconnect}>Autorizar novamente</Button>}
        <DriveOpenLink node={node} />
      </div>}
    />
  )
}

function AuthorizePdf({ node, courseTitle, backTo, route, savedCopy }: { node: CourseNode; courseTitle: string; backTo: string; route: string; savedCopy?: OfflineCoursePdf }) {
  const [token, setToken] = useState<string | null>(() => currentDriveReadToken())
  const [ignoreCopy, setIgnoreCopy] = useState(false)
  const [savedClientId] = useState(() => getClientId())
  const [clientId, setClientId] = useState(savedClientId ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()

  /** Sem janela: esta aba vai ao Google e volta para este leitor (via /cursos). */
  const authorizeHere = () => {
    const id = clientId.trim()
    if (!isClientId(id)) {
      setError('Informe um ID público de cliente OAuth válido.')
      return
    }
    setError('')
    try {
      saveClientId(id)
      startDriveRedirect(id, DRIVE_READ_SCOPE, undefined, location.pathname + location.search)
    } catch (failure) {
      setError(errorMessage(failure))
    }
  }

  const authorize = async () => {
    const id = clientId.trim()
    if (!isClientId(id)) {
      setError('Informe um ID público de cliente OAuth válido.')
      return
    }
    setPending(true)
    setError('')
    try {
      saveClientId(id)
      setToken(await requestDriveReadToken(id))
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setPending(false)
    }
  }

  const copy = ignoreCopy ? undefined : savedCopy
  if (copy || token) return <Ready node={node} token={token} copy={copy} route={route} backTo={backTo} onReconnect={() => { setIgnoreCopy(true); setToken(null) }} />

  return (
    <div className="space-y-6">
      <PageHeader title={displayTitle(node)} description={courseTitle} actions={<Link to={backTo} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-2"><ArrowLeft className="size-4" aria-hidden />Voltar ao curso</Link>} />
      <Card className="mx-auto max-w-2xl overflow-hidden">
        <div className="border-b border-line bg-accent/5 p-6 sm:p-8">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-accent/20 bg-bg text-accent-strong"><FileText className="size-6" aria-hidden /></span>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">Modo leitura do curso</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">Autorize a leitura no Drive para abrir o PDF com tela cheia, texto ajustável e marcações. Você poderá salvar uma cópia neste aparelho para ler sem internet.</p>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          <p className="flex items-start gap-3 text-sm leading-relaxed text-muted"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden /><span>O Google solicita acesso de leitura aos arquivos da sua conta, sem editar ou excluir. A plataforma usa esse acesso para abrir o PDF selecionado. A autorização é temporária e fica apenas na memória desta aba.</span></p>
          {!savedClientId && <Field label="ID público do cliente OAuth do Google" hint="Use o mesmo ID de cliente utilizado para conectar seus cursos ao Drive.">{(id, description) => <Input id={id} aria-describedby={description} value={clientId} placeholder="123456789012-…apps.googleusercontent.com" onChange={(event) => setClientId(event.target.value)} autoComplete="off" />}</Field>}
          {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" disabled={pending || !isClientId(clientId.trim())} icon={<KeyRound className="size-4" aria-hidden />} onClick={authorizeHere}>Autorizar leitura do PDF</Button>
            <Button variant="ghost" size="sm" loading={pending} disabled={!isClientId(clientId.trim())} onClick={() => void authorize()}>Autorizar em janela separada</Button>
          </div>
          <p className="text-xs text-muted">O Google abre nesta aba e volta para este PDF.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs">
            <Link to={backTo} className="text-ink underline underline-offset-4">Usar visualizador padrão</Link>
            <DriveOpenLink node={node} />
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function CoursePdfReaderPage() {
  const { id = '', itemId = '' } = useParams()
  const data = useCourses()
  const { dbName: scope } = useLibrary()
  const backTo = `/cursos/${encodeURIComponent(id)}?item=${encodeURIComponent(itemId)}`
  const route = `/cursos/${encodeURIComponent(id)}/pdf/${encodeURIComponent(itemId)}`
  const lookup = `${scope}:${route}`
  const [local, setLocal] = useState<{ lookup: string; copy?: OfflineCoursePdf } | null>(null)
  useEffect(() => {
    let active = true
    void readOfflineCoursePdf(scope, route).then(
      (copy) => { if (active) setLocal({ lookup, copy }) },
      () => { if (active) setLocal({ lookup }) },
    )
    return () => { active = false }
  }, [lookup, route, scope])
  if (local?.lookup !== lookup) return <Spinner label="Procurando o PDF neste aparelho…" />
  if (local.copy && navigator.onLine === false) {
    return <AuthorizePdf key={lookup} node={local.copy.node} savedCopy={local.copy} route={route} courseTitle="Material do curso" backTo={backTo} />
  }
  if (data.isPending) return <Spinner />
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />
  const view = data.views.find((course) => course.course.id === id)
  const node = view?.items.find((item) => item.id === itemId)
  if (!view || !node || node.kind !== 'item' || node.mime_type !== 'application/pdf' || !isDriveId(node.drive_id) || (node.resource_key != null && !isResourceKey(node.resource_key))) {
    return <EmptyState title="PDF não encontrado neste curso" description="Escolha um PDF no conteúdo do curso para abrir o modo leitura." action={<Link to={view ? `/cursos/${encodeURIComponent(id)}` : '/cursos'} className="text-sm font-semibold text-accent-strong underline">Voltar aos cursos</Link>} />
  }
  if (node.status !== 'available') {
    return <EmptyState title="PDF indisponível no Drive" description="O arquivo não foi encontrado na última atualização ou foi excluído do catálogo. Confira o acesso no Drive e atualize a pasta do curso." action={<Link to={backTo} className="text-sm font-semibold text-accent-strong underline">Voltar ao curso</Link>} />
  }
  const copy = local.copy?.node.drive_id === node.drive_id ? local.copy : undefined
  return <AuthorizePdf key={lookup} node={node} courseTitle={view.title} backTo={backTo} route={route} savedCopy={copy} />
}
