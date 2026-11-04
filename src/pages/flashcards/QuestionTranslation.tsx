import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Languages } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface BrowserTranslator {
  translate(text: string, options: { signal: AbortSignal }): Promise<string>
  destroy?(): void
}

interface BrowserTranslatorFactory {
  create(options: {
    sourceLanguage: string
    targetLanguage: string
    signal: AbortSignal
    monitor?: (target: EventTarget) => void
  }): Promise<BrowserTranslator>
}

type TranslationState =
  | { kind: 'idle' }
  | { kind: 'loading'; message: string }
  | { kind: 'translated'; text: string }
  | { kind: 'fallback'; reason: 'unavailable' | 'failed' }

function googleTranslateLink(question: string) {
  const url = new URL('https://translate.google.com/')
  url.search = new URLSearchParams({ sl: 'en', tl: 'pt', op: 'translate', text: question }).toString()
  const includesQuestion = url.href.length <= 6000
  if (!includesQuestion) url.searchParams.delete('text')
  return { href: url.href, includesQuestion }
}

/** Montado por cartão para nunca manter a tradução de outra pergunta. */
export function QuestionTranslation({ question }: { question: string }) {
  const [state, setState] = useState<TranslationState>({ kind: 'idle' })
  const request = useRef<AbortController | null>(null)

  useEffect(() => () => request.current?.abort(), [])

  const cancel = () => {
    request.current?.abort()
    request.current = null
    setState({ kind: 'idle' })
  }

  const translate = async () => {
    if (request.current) return
    const factory = (window as Window & { Translator?: BrowserTranslatorFactory }).Translator
    if (typeof factory?.create !== 'function') {
      setState({ kind: 'fallback', reason: 'unavailable' })
      return
    }

    const controller = new AbortController()
    const { signal } = controller
    request.current = controller
    setState({ kind: 'loading', message: 'Preparando a tradução no navegador…' })
    let translator: BrowserTranslator | undefined
    try {
      // A criação começa no clique para manter o gesto exigido no primeiro download do modelo.
      translator = await factory.create({
        sourceLanguage: 'en',
        targetLanguage: 'pt',
        signal,
        monitor(target) {
          target.addEventListener('downloadprogress', (event) => {
            const loaded = (event as ProgressEvent).loaded
            if (signal.aborted || !Number.isFinite(loaded)) return
            const progress = Math.round(Math.min(1, Math.max(0, loaded)) * 100)
            setState({ kind: 'loading', message: `Baixando o pacote de idiomas (${progress}%)…` })
          }, { signal })
        },
      })
      if (signal.aborted) return
      setState({ kind: 'loading', message: 'Traduzindo a pergunta…' })
      const translated = (await translator.translate(question, { signal })).trim()
      if (signal.aborted) return
      if (translated) setState({ kind: 'translated', text: translated })
      else setState({ kind: 'fallback', reason: 'failed' })
    } catch (error) {
      if (signal.aborted) return
      const reason = error instanceof DOMException && error.name === 'NotSupportedError' ? 'unavailable' : 'failed'
      setState({ kind: 'fallback', reason })
    } finally {
      if (request.current === controller) request.current = null
      translator?.destroy?.()
    }
  }

  const fallback = state.kind === 'fallback' ? googleTranslateLink(question) : null

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {state.kind === 'translated' ? (
          <Button variant="ghost" size="sm" icon={<Languages className="size-4" aria-hidden />} onClick={cancel}>Ocultar tradução</Button>
        ) : state.kind === 'loading' ? (
          <Button variant="ghost" size="sm" onClick={cancel}>Cancelar tradução</Button>
        ) : state.kind === 'idle' || state.reason === 'failed' ? (
          <>
            <Button variant="ghost" size="sm" icon={<Languages className="size-4" aria-hidden />} onClick={() => void translate()}>
              {state.kind === 'idle' ? 'Traduzir pergunta' : 'Tentar tradução novamente'}
            </Button>
            <span className="text-xs text-muted">Inglês para português</span>
          </>
        ) : null}
      </div>
      <div role="status" aria-atomic="true">
        {state.kind === 'loading' && <p className="text-xs text-muted">{state.message}</p>}
        {state.kind === 'translated' && (
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
            <p className="text-xs font-semibold text-accent-strong">Tradução para português</p>
            <p lang="pt" className="mt-1 break-words whitespace-pre-wrap text-sm leading-relaxed text-ink">{state.text}</p>
          </div>
        )}
        {state.kind === 'fallback' && (
          <p className="text-sm text-muted">
            {state.reason === 'unavailable' ? 'A tradução integrada não está disponível neste navegador.' : 'Não foi possível traduzir no navegador.'}
          </p>
        )}
      </div>
      {fallback && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-xs leading-relaxed text-muted">
            {fallback.includesQuestion ? 'Ao abrir o Google Tradutor, você envia apenas o texto da pergunta.' : 'Copie a pergunta acima e cole no Google Tradutor.'}
          </p>
          <a href={fallback.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-semibold text-accent-strong underline underline-offset-4">
            Abrir no Google Tradutor <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only"> (nova aba)</span>
          </a>
        </div>
      )}
    </div>
  )
}
