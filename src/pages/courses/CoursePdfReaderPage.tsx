import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, KeyRound, ShieldCheck } from 'lucide-react'
import { DriveOpenLink } from '@/components/DriveViewer'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Card, PageHeader } from '@/components/ui/layout'
import { EmptyState, ErrorState, Spinner, errorMessage } from '@/components/ui/feedback'
import { useCourses } from '@/hooks/useCourses'
import { useLibrary } from '@/hooks/useLibrary'
import { displayTitle } from '@/lib/courseCatalog'
import { isDriveId, isResourceKey } from '@/lib/drive'
import { currentDriveReadToken, getClientId, isClientId, requestDriveReadToken, saveClientId } from '@/lib/googleAuth'
import { PdfReader } from '@/pages/library/PdfReaderPage'
import { DrivePdfStore } from '@/services/drivePdf'
import type { CourseNode } from '@/types/db'

function Ready({ node, token, backTo, onReconnect }: { node: CourseNode; token: string; backTo: string; onReconnect: () => void }) {
  const { dbName: scope } = useLibrary()
  const store = useMemo(() => new DrivePdfStore(scope, node, token), [scope, node, token])
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Leitura do Google Drive autorizada nesta aba.</span>
        <Button size="sm" variant="ghost" onClick={onReconnect}>Autorizar novamente</Button>
      </div>
      <PdfReader store={store} documentId={node.drive_id} backTo={backTo} sourceLabel="Cursos / Leitor PDF" storageNotice="Original no Drive. Marcações salvas neste navegador." backLabel="Voltar ao curso" />
    </div>
  )
}

function AuthorizePdf({ node, courseTitle, backTo }: { node: CourseNode; courseTitle: string; backTo: string }) {
  const [token, setToken] = useState<string | null>(() => currentDriveReadToken())
  const [savedClientId] = useState(() => getClientId())
  const [clientId, setClientId] = useState(savedClientId ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

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

  if (token) return <Ready node={node} token={token} backTo={backTo} onReconnect={() => setToken(null)} />

  return (
    <div className="space-y-6">
      <PageHeader title={displayTitle(node)} description={courseTitle} actions={<Link to={backTo} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface"><ArrowLeft className="size-4" aria-hidden />Voltar ao curso</Link>} />
      <Card className="mx-auto max-w-2xl overflow-hidden">
        <div className="border-b border-line bg-accent/5 p-6 sm:p-8">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-accent/20 bg-bg text-accent-strong"><FileText className="size-6" aria-hidden /></span>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">Seu material, com suas marcações</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">Para destacar o PDF, autorize a leitura dos arquivos no Google Drive. O original permanece no Drive; o conteúdo é carregado só na memória e as marcas ficam neste navegador.</p>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          <p className="flex items-start gap-3 text-sm leading-relaxed text-muted"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden /><span>O Google solicita acesso de leitura aos arquivos da sua conta, sem editar ou excluir. A plataforma usa esse acesso para abrir o PDF selecionado. A autorização é temporária e fica apenas na memória desta aba.</span></p>
          {!savedClientId && <Field label="ID público do cliente OAuth do Google" hint="Use o mesmo ID de cliente utilizado para conectar seus cursos ao Drive.">{(id, description) => <Input id={id} aria-describedby={description} value={clientId} placeholder="123456789012-…apps.googleusercontent.com" onChange={(event) => setClientId(event.target.value)} autoComplete="off" />}</Field>}
          {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</p>}
          <Button variant="primary" loading={pending} disabled={!isClientId(clientId.trim())} icon={<KeyRound className="size-4" aria-hidden />} onClick={() => void authorize()}>Autorizar leitura do PDF</Button>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-xs">
            <Link to={backTo} className="text-ink underline underline-offset-4">Usar visualizador padrão</Link>
            <DriveOpenLink node={node} />
          </div>
        </div>
      </Card>
    </div>
  )
}

/** Leitor de um PDF já presente no catálogo; os bytes nunca entram na estante local. */
export default function CoursePdfReaderPage() {
  const { id = '', itemId = '' } = useParams()
  const data = useCourses()
  const { dbName: scope } = useLibrary()
  const backTo = `/cursos/${encodeURIComponent(id)}?item=${encodeURIComponent(itemId)}`
  if (data.isPending) return <Spinner />
  if (data.isError) return <ErrorState error={data.error} onRetry={() => void data.refetch()} />
  const view = data.views.find((course) => course.course.id === id)
  const node = view?.items.find((item) => item.id === itemId)
  if (!view || !node || node.kind !== 'item' || node.mime_type !== 'application/pdf' || !isDriveId(node.drive_id) || (node.resource_key != null && !isResourceKey(node.resource_key))) {
    return <EmptyState title="PDF não encontrado neste curso" description="Escolha um material em PDF no conteúdo do curso para abrir o leitor de marcações." action={<Link to={view ? `/cursos/${encodeURIComponent(id)}` : '/cursos'} className="text-sm font-semibold text-accent-strong underline">Voltar aos cursos</Link>} />
  }
  if (node.status !== 'available') {
    return <EmptyState title="PDF indisponível no Drive" description="O arquivo não foi encontrado na última atualização ou foi excluído do catálogo. Confira o acesso no Drive e atualize a pasta do curso." action={<Link to={backTo} className="text-sm font-semibold text-accent-strong underline">Voltar ao curso</Link>} />
  }
  return <AuthorizePdf key={`${scope}:${node.id}`} node={node} courseTitle={view.title} backTo={backTo} />
}
