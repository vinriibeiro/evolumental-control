import { useEffect, useState, type ReactNode } from 'react'
import { FileCode2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { errorMessage, Spinner } from '@/components/ui/feedback'
import { cn } from '@/lib/cn'
import { DriveHtmlAuthorizationError, fetchDriveHtml, htmlReadingDocument, type DriveHtmlReference } from '@/lib/driveHtml'
import { currentDriveReadToken, DRIVE_READ_SCOPE, getClientId, isClientId, requestDriveReadToken, saveClientId, startDriveRedirect } from '@/lib/googleAuth'

export function DriveHtmlReader({ node, title, returnTo, className, frameClassName, driveLink }: {
  node: DriveHtmlReference
  title: string
  returnTo?: string
  className?: string
  frameClassName?: string
  driveLink: ReactNode
}) {
  const [token, setToken] = useState(currentDriveReadToken)
  const [storedClientId] = useState(getClientId)
  const [clientId, setClientId] = useState(storedClientId ?? '')
  const [authorizing, setAuthorizing] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [source, setSource] = useState<string>()
  const { drive_id, resource_key } = node

  useEffect(() => {
    if (!token) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    void fetchDriveHtml({ drive_id, resource_key }, token, controller.signal)
      .then((html) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(new Blob([htmlReadingDocument(html)], { type: 'text/html;charset=utf-8' }))
        setSource(objectUrl)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(errorMessage(cause))
        if (cause instanceof DriveHtmlAuthorizationError) setToken(null)
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [drive_id, resource_key, token, attempt])

  const authorize = async (redirect: boolean) => {
    const id = clientId.trim()
    if (!isClientId(id)) return
    setError('')
    try {
      saveClientId(id)
      if (redirect) {
        startDriveRedirect(id, DRIVE_READ_SCOPE, undefined, returnTo)
        return
      }
      setAuthorizing(true)
      setToken(await requestDriveReadToken(id))
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setAuthorizing(false)
    }
  }

  if (source) {
    return <div className={className}><iframe src={source} sandbox="" referrerPolicy="no-referrer" title={`HTML: ${title}`} className={cn('block w-full border-0 bg-white', frameClassName ?? 'h-[76dvh] min-h-[420px]')} /></div>
  }
  if (token && !error) return <Spinner label="Abrindo HTML do Drive…" className="min-h-48" />
  return (
    <div className={cn('grid min-h-48 place-items-center bg-surface-2 px-5 py-7 text-center', className)}>
      <div className="w-full max-w-md space-y-3">
        <FileCode2 className="mx-auto size-7 text-muted" aria-hidden />
        <p className="text-sm font-semibold text-ink">{token ? 'O HTML não abriu' : 'Leitor HTML do Drive'}</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {!token && !error && <p className="text-sm text-muted">Autorize a leitura para abrir este arquivo dentro da aula.</p>}
        {!token && !storedClientId && (
          <Field label="ID público do cliente OAuth do Google">{(id) => <Input id={id} value={clientId} onChange={(event) => setClientId(event.target.value)} autoComplete="off" />}</Field>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {token ? (
            <Button size="sm" onClick={() => { setError(''); setAttempt((n) => n + 1) }}>Tentar novamente</Button>
          ) : (
            <>
              <Button variant="primary" size="sm" icon={<KeyRound className="size-4" aria-hidden />} disabled={!isClientId(clientId) || authorizing} onClick={() => void authorize(Boolean(returnTo))}>Autorizar leitura</Button>
              {returnTo && <Button size="sm" variant="ghost" loading={authorizing} disabled={!isClientId(clientId)} onClick={() => void authorize(false)}>Autorizar em outra janela</Button>}
            </>
          )}
          {driveLink}
        </div>
      </div>
    </div>
  )
}
