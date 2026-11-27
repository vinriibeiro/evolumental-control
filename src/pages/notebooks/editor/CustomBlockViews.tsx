import { useEffect, useRef, useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FileCode2,
  HelpCircle,
  Info,
  Lightbulb,
  Maximize2,
  Play,
  Plus,
  Square,
  Trash2,
  WrapText,
  XCircle,
} from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'
import type { PracticeResult } from '@/pages/challenges/runners'
import { CODE_LANGUAGES, getLanguageDef } from './languages'

export type CalloutVariant = 'info' | 'warning' | 'definition' | 'example' | 'summary' | 'pitfall' | 'exercise'

export const CALLOUT_META: Record<CalloutVariant, { label: string; accentBorder: string; badge: string; Icon: typeof Info }> = {
  info: { label: 'Informação', accentBorder: 'border-l-ink', badge: 'bg-surface-2 text-ink', Icon: Info },
  warning: { label: 'Atenção', accentBorder: 'border-l-accent', badge: 'bg-accent/10 text-accent', Icon: AlertTriangle },
  definition: { label: 'Definição', accentBorder: 'border-l-ink', badge: 'bg-surface-2 text-ink', Icon: BookMarked },
  example: { label: 'Exemplo', accentBorder: 'border-l-muted', badge: 'bg-surface-2 text-ink', Icon: Lightbulb },
  summary: { label: 'Resumo', accentBorder: 'border-l-ink', badge: 'bg-surface-2 text-ink', Icon: BookOpen },
  pitfall: { label: 'Erro comum', accentBorder: 'border-l-danger', badge: 'bg-danger/10 text-danger', Icon: XCircle },
  exercise: { label: 'Exercício', accentBorder: 'border-l-accent', badge: 'bg-surface-2 text-ink', Icon: FileCode2 },
}

export function CalloutNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const variant = ((node.attrs.variant as CalloutVariant) in CALLOUT_META ? node.attrs.variant : 'info') as CalloutVariant
  const meta = CALLOUT_META[variant]
  const Icon = meta.Icon
  const title = typeof node.attrs.title === 'string' ? node.attrs.title : meta.label

  return (
    <NodeViewWrapper
      data-block-id={node.attrs.blockId || undefined}
      className={cn('my-3 rounded-xl border border-line border-l-4 bg-surface-2/50 p-3.5', meta.accentBorder)}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2" contentEditable={false}>
        <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold', meta.badge)}>
          <Icon className="size-3.5" aria-hidden />
          {meta.label}
        </span>
        {editable ? (
          <>
            <input
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Título do bloco…"
              aria-label="Título do bloco especial"
              className="min-w-[140px] flex-1 bg-transparent text-xs font-semibold text-ink outline-none placeholder:text-muted"
            />
            <select
              aria-label="Tipo de bloco"
              value={variant}
              onChange={(e) => {
                const next = e.target.value as CalloutVariant
                const prevDefault = CALLOUT_META[variant].label
                updateAttributes({
                  variant: next,
                  ...(title === prevDefault ? { title: CALLOUT_META[next].label } : {}),
                })
              }}
              className="rounded border border-line bg-bg px-1.5 py-0.5 text-[11px] text-muted outline-none focus:border-ink"
            >
              {(Object.keys(CALLOUT_META) as CalloutVariant[]).map((k) => (
                <option key={k} value={k}>
                  {CALLOUT_META[k].label}
                </option>
              ))}
            </select>
          </>
        ) : (
          title && title !== meta.label && <span className="text-xs font-semibold text-ink">{title}</span>
        )}
      </div>
      <NodeViewContent className="kb-nested-content text-sm leading-relaxed text-ink" />
    </NodeViewWrapper>
  )
}

export function QaNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const question = typeof node.attrs.question === 'string' ? node.attrs.question : ''
  const [revealed, setRevealed] = useState(Boolean(node.attrs.open))

  useEffect(() => {
    const onToggleAll = (ev: Event) => {
      const detail = (ev as CustomEvent<{ open: boolean }>).detail
      if (detail && typeof detail.open === 'boolean') setRevealed(detail.open)
    }
    window.addEventListener('vlm:qa-toggle-all', onToggleAll)
    return () => window.removeEventListener('vlm:qa-toggle-all', onToggleAll)
  }, [])

  const toggle = () => {
    const next = !revealed
    setRevealed(next)
    if (editable) updateAttributes({ open: next })
  }

  return (
    <NodeViewWrapper data-block-id={node.attrs.blockId || undefined} className="my-3 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-start gap-2.5 bg-surface-2/60 px-3.5 py-2.5" contentEditable={false}>
        <HelpCircle className="mt-1 size-4 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">Pergunta e resposta (revisão ativa)</p>
          {editable ? (
            <input
              value={question}
              onChange={(e) => updateAttributes({ question: e.target.value })}
              placeholder="Escreva a pergunta aqui…"
              aria-label="Pergunta"
              className="mt-0.5 w-full bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-muted/70"
            />
          ) : (
            <p className="mt-0.5 text-sm font-semibold text-ink">{question || 'Pergunta sem título'}</p>
          )}
        </div>
        <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={toggle} aria-expanded={revealed}>
          {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {revealed ? 'Ocultar resposta' : 'Revelar resposta'}
        </Button>
      </div>
      <div className={cn('border-t border-line px-4 py-3', !revealed && 'hidden')}>
        <NodeViewContent className="kb-nested-content text-sm leading-relaxed text-ink" />
      </div>
      {!revealed && (
        <div contentEditable={false} className="border-t border-line px-4 py-2.5 text-xs text-muted italic">
          Resposta oculta — clique em "Revelar resposta" quando quiser conferir.
        </div>
      )}
    </NodeViewWrapper>
  )
}

export function ToggleNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const summary = typeof node.attrs.summary === 'string' ? node.attrs.summary : ''
  const [open, setOpen] = useState(node.attrs.open !== false)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (editable) updateAttributes({ open: next })
  }

  return (
    <NodeViewWrapper data-block-id={node.attrs.blockId || undefined} className="my-3 rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 px-3 py-2" contentEditable={false}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? 'Recolher conteúdo' : 'Expandir conteúdo'}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-ink"
        >
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {editable ? (
          <input
            value={summary}
            onChange={(e) => updateAttributes({ summary: e.target.value })}
            placeholder="Título do conteúdo expansível…"
            aria-label="Título do bloco expansível"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted/70"
          />
        ) : (
          <button type="button" onClick={toggle} className="flex-1 text-left text-sm font-medium text-ink">
            {summary || 'Detalhes'}
          </button>
        )}
      </div>
      <div className={cn('border-t border-line px-4 py-3', !open && 'hidden')}>
        <NodeViewContent className="kb-nested-content text-sm leading-relaxed text-ink" />
      </div>
    </NodeViewWrapper>
  )
}

interface GlossaryEntry {
  id: string
  term: string
  definition: string
}

export function GlossaryNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const entries = (Array.isArray(node.attrs.entries) ? node.attrs.entries : []) as GlossaryEntry[]
  const heading = typeof node.attrs.title === 'string' ? node.attrs.title : 'Glossário'

  const updateEntry = (id: string, patch: Partial<GlossaryEntry>) => {
    updateAttributes({ entries: entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  }
  const addEntry = () => {
    updateAttributes({ entries: [...entries, { id: crypto.randomUUID(), term: '', definition: '' }] })
  }
  const removeEntry = (id: string) => {
    updateAttributes({ entries: entries.filter((e) => e.id !== id) })
  }

  return (
    <NodeViewWrapper data-block-id={node.attrs.blockId || undefined} className="my-3 rounded-xl border border-line bg-surface p-4" contentEditable={false}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookMarked className="size-4 text-accent" aria-hidden />
          {editable ? (
            <input
              value={heading}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              aria-label="Título do glossário"
              className="bg-transparent text-sm font-semibold text-ink outline-none"
            />
          ) : (
            <span className="text-sm font-semibold text-ink">{heading}</span>
          )}
        </div>
        {editable && (
          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" icon={<Plus className="size-3.5" />} onClick={addEntry}>
            Termo
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted">Nenhum termo cadastrado neste glossário.</p>
      ) : (
        <dl className="divide-y divide-line">
          {entries.map((entry) => (
            <div key={entry.id} className="grid gap-2 py-2 sm:grid-cols-[180px_1fr_auto] sm:items-start">
              {editable ? (
                <>
                  <input
                    value={entry.term}
                    onChange={(e) => updateEntry(entry.id, { term: e.target.value })}
                    placeholder="Termo / conceito"
                    aria-label="Termo"
                    className="rounded border border-line bg-surface-2 px-2 py-1 text-xs font-semibold text-ink outline-none focus:border-ink"
                  />
                  <input
                    value={entry.definition}
                    onChange={(e) => updateEntry(entry.id, { definition: e.target.value })}
                    placeholder="Definição manual…"
                    aria-label="Definição"
                    className="rounded border border-line bg-surface-2 px-2 py-1 text-xs text-ink outline-none focus:border-ink"
                  />
                  <IconButton label="Remover termo" size="sm" onClick={() => removeEntry(entry.id)}>
                    <Trash2 className="size-3.5 text-muted hover:text-danger" />
                  </IconButton>
                </>
              ) : (
                <>
                  <dt className="text-xs font-semibold text-ink">{entry.term || '—'}</dt>
                  <dd className="text-xs leading-relaxed text-muted">{entry.definition || '—'}</dd>
                </>
              )}
            </div>
          ))}
        </dl>
      )}
    </NodeViewWrapper>
  )
}

export function CodeBlockNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const language = typeof node.attrs.language === 'string' && node.attrs.language ? node.attrs.language : 'plaintext'
  const langDef = getLanguageDef(language)
  const title = typeof node.attrs.title === 'string' ? node.attrs.title : ''
  const description = typeof node.attrs.description === 'string' ? node.attrs.description : ''
  const showLineNumbers = node.attrs.showLineNumbers !== false
  const wrapLines = Boolean(node.attrs.wrapLines)

  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<PracticeResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const rawCode = node.textContent
  const lineCount = Math.max(1, rawCode.split('\n').length)

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(rawCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* fallback silencioso */
    }
  }

  const runInLab = async () => {
    if (!langDef.runnable || running) return
    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setRunResult(null)
    setRunError(null)
    try {
      const { runNotebookSnippet } = await import('@/pages/challenges/runners')
      const res = await runNotebookSnippet(langDef.runnable, rawCode, controller.signal)
      if (!controller.signal.aborted) setRunResult(res)
    } catch (e) {
      if (!controller.signal.aborted) setRunError(e instanceof Error ? e.message : 'Falha na execução isolada.')
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setRunning(false)
      }
    }
  }

  const cancelRun = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setRunning(false)
  }

  return (
    <NodeViewWrapper data-block-id={node.attrs.blockId || undefined} className="my-4 overflow-hidden rounded-xl border border-line bg-surface-2/70">
      {/* Cabeçalho técnico do bloco de código */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2" contentEditable={false}>
        {editable ? (
          <select
            aria-label="Linguagem do código"
            value={langDef.id}
            onChange={(e) => updateAttributes({ language: e.target.value })}
            className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium text-ink outline-none focus:border-ink"
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink">{langDef.label}</span>
        )}

        {editable ? (
          <input
            value={title}
            onChange={(e) => updateAttributes({ title: e.target.value })}
            placeholder="Título opcional (ex.: Consulta de ranking)…"
            aria-label="Título do bloco de código"
            className="min-w-[140px] flex-1 bg-transparent text-xs font-medium text-ink outline-none placeholder:text-muted/70"
          />
        ) : (
          title && <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">{title}</span>
        )}

        <div className="ml-auto flex items-center gap-1">
          {editable && (
            <>
              <button
                type="button"
                onClick={() => updateAttributes({ showLineNumbers: !showLineNumbers })}
                title={showLineNumbers ? 'Ocultar números de linha' : 'Mostrar números de linha'}
                className={cn(
                  'rounded px-1.5 py-1 font-mono text-[11px] transition-colors',
                  showLineNumbers ? 'bg-surface-2 font-semibold text-ink' : 'text-muted hover:text-ink',
                )}
              >
                #
              </button>
              <IconButton
                label={wrapLines ? 'Desativar quebra de linha' : 'Ativar quebra de linha'}
                size="sm"
                className={cn('size-7', wrapLines && 'bg-surface-2 text-ink')}
                onClick={() => updateAttributes({ wrapLines: !wrapLines })}
              >
                <WrapText className="size-3.5" />
              </IconButton>
            </>
          )}

          {langDef.runnable && (
            running ? (
              <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px]" icon={<Square className="size-3" />} onClick={cancelRun}>
                Cancelar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-[11px]"
                icon={<Play className="size-3" />}
                disabled={!rawCode.trim()}
                onClick={() => void runInLab()}
                title={langDef.sqliteNotice ? 'Executar manualmente no sandbox SQLite isolado' : 'Executar manualmente no sandbox Python isolado'}
              >
                Executar
              </Button>
            )
          )}

          <IconButton label={copied ? 'Copiado' : 'Copiar código'} size="sm" className="size-7" onClick={() => void copyCode()}>
            {copied ? <Check className="size-3.5 text-ink" /> : <Copy className="size-3.5" />}
          </IconButton>
          <IconButton label="Expandir visualização do código" size="sm" className="size-7" onClick={() => setExpanded(true)}>
            <Maximize2 className="size-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Descrição opcional */}
      {(editable || description) && (
        <div className="border-b border-line bg-surface/60 px-3 py-1.5" contentEditable={false}>
          {editable ? (
            <input
              value={description}
              onChange={(e) => updateAttributes({ description: e.target.value })}
              placeholder="Descrição ou entrada/saída esperada (opcional)…"
              aria-label="Descrição do bloco de código"
              className="w-full bg-transparent text-[11px] text-muted outline-none placeholder:text-muted/60"
            />
          ) : (
            <p className="text-[11px] text-muted">{description}</p>
          )}
        </div>
      )}

      {/* Área de código com numeração opcional e preservação integral de indentação */}
      <div className="flex overflow-x-auto font-mono text-[13px] leading-6">
        {showLineNumbers && (
          <div
            aria-hidden
            contentEditable={false}
            className="shrink-0 select-none border-r border-line bg-surface-2/80 px-2.5 py-3 text-right text-[11px] leading-6 text-muted tabular"
          >
            {Array.from({ length: lineCount }, (_, idx) => (
              <div key={idx}>{idx + 1}</div>
            ))}
          </div>
        )}
        <pre className={cn('min-w-0 flex-1 p-3 text-ink', wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}>
          <code className={`block language-${langDef.id}`}>
            <NodeViewContent />
          </code>
        </pre>
      </div>

      {/* Saída da execução manual no sandbox isolado */}
      {(running || runResult || runError) && (
        <div className="border-t border-line bg-surface p-3 text-xs" contentEditable={false} aria-live="polite">
          {langDef.sqliteNotice && (
            <p className="mb-2 text-[11px] text-muted">
              Nota: a execução SQL no navegador usa <strong className="text-ink">SQLite em memória</strong> (não PostgreSQL nem SQL Server), em ambiente isolado sem acesso a credenciais.
            </p>
          )}
          {running && <p className="text-muted">Executando no ambiente isolado do navegador…</p>}
          {runError && <p className="text-danger">{runError}</p>}
          {runResult && (
            <div className="space-y-1.5">
              <p className={cn('font-semibold', runResult.passed ? 'text-ink' : 'text-danger')}>{runResult.summary}</p>
              {!runResult.passed && runResult.cases[0]?.feedback && (
                <pre className="whitespace-pre-wrap rounded-lg border border-danger/30 bg-danger/5 p-2.5 font-mono text-[11px] text-danger">
                  {runResult.cases[0].feedback}
                </pre>
              )}
              {runResult.output && (
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-2.5 font-mono text-[11px] text-ink">
                  {runResult.output}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal de visualização expandida */}
      <Modal open={expanded} onClose={() => setExpanded(false)} size="xl" title={title || `Código — ${langDef.label}`} description={description || undefined}>
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} onClick={() => void copyCode()}>
              {copied ? 'Copiado' : 'Copiar código'}
            </Button>
          </div>
          <pre className="max-h-[70vh] overflow-auto rounded-xl border border-line bg-surface-2 p-4 font-mono text-xs leading-6 text-ink whitespace-pre">
            <code>{rawCode}</code>
          </pre>
        </div>
      </Modal>
    </NodeViewWrapper>
  )
}
