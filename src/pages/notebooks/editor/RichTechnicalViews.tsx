import { useEffect, useId, useRef, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { Check, Code2, Copy, Eye, Maximize2, Sigma, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

// ---------------------------------------------------------------------
// Bloco de Fórmula Matemática (LaTeX / KaTeX — lazy-loaded, trust: false)
// ---------------------------------------------------------------------

const MATH_STARTERS = [
  { label: 'Média amostral', latex: '\\bar{x} = \\frac{1}{n} \\sum_{i=1}^{n} x_i' },
  { label: 'Variância amostral', latex: 's^2 = \\frac{1}{n-1} \\sum_{i=1}^{n} (x_i - \\bar{x})^2' },
  { label: 'Teorema de Bayes', latex: 'P(A \\mid B) = \\frac{P(B \\mid A)\\,P(A)}{P(B)}' },
  { label: 'Regressão linear', latex: '\\hat{y} = \\beta_0 + \\beta_1 x_1 + \\dots + \\beta_p x_p' },
]

export function MathBlockNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const formula = typeof node.attrs.formula === 'string' ? node.attrs.formula : ''
  const caption = typeof node.attrs.caption === 'string' ? node.attrs.caption : ''

  const [editing, setEditing] = useState(!formula.trim())
  const [renderedHtml, setRenderedHtml] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    const src = formula.trim()
    if (!src) {
      setRenderedHtml('')
      setRenderError(null)
      return
    }
    void Promise.all([import('katex'), import('katex/dist/katex.min.css')])
      .then(([katexMod]) => {
        if (!active) return
        const katex = katexMod.default
        const html = katex.renderToString(src, {
          displayMode: true,
          throwOnError: false,
          strict: 'warn',
          trust: false, // Impede comandos HTML/JS inseguros
          maxSize: 500,
          maxExpand: 1000,
        })
        setRenderedHtml(html)
        setRenderError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setRenderError(err instanceof Error ? err.message : 'Erro ao renderizar fórmula LaTeX.')
      })
    return () => {
      active = false
    }
  }, [formula])

  const copyLatex = async () => {
    try {
      await navigator.clipboard.writeText(formula)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <NodeViewWrapper data-block-id={node.attrs.blockId || undefined} className="my-3 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-3 py-2" contentEditable={false}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sigma className="size-4 shrink-0 text-accent" aria-hidden />
          {editable ? (
            <input
              value={caption}
              onChange={(e) => updateAttributes({ caption: e.target.value })}
              placeholder="Fórmula matemática (LaTeX / KaTeX)…"
              aria-label="Legenda da fórmula"
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-ink outline-none placeholder:text-muted/70"
            />
          ) : (
            <span className="truncate text-xs font-semibold text-ink">{caption || 'Fórmula matemática'}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {formula.trim() && (
            <button
              type="button"
              onClick={() => void copyLatex()}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-ink hover:bg-surface-2"
            >
              {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              {copied ? 'Copiado' : 'LaTeX'}
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-ink hover:bg-surface-2"
            >
              {editing ? <Eye className="size-3" /> : <Code2 className="size-3" />}
              {editing ? 'Visualizar' : 'Editar LaTeX'}
            </button>
          )}
        </div>
      </div>

      <div className="p-4" contentEditable={false}>
        {editable && editing && (
          <div className="mb-3 space-y-2">
            <textarea
              value={formula}
              onChange={(e) => updateAttributes({ formula: e.target.value })}
              rows={3}
              spellCheck={false}
              placeholder="Ex.: \sum_{i=1}^{n} x_i / n"
              aria-label="Expressão LaTeX"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-ink outline-none focus:border-ink"
            />
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              <span>Inserir modelo:</span>
              {MATH_STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => updateAttributes({ formula: s.latex, caption: caption || s.label })}
                  className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-ink hover:border-ink/40"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {renderError ? (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">{renderError}</p>
        ) : renderedHtml ? (
          <div
            className="overflow-x-auto py-2 text-center text-ink"
            // KaTeX renderToString com trust:false produz apenas marcação matemática segura
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <p className="py-3 text-center text-xs text-muted italic">
            {editable ? 'Digite uma expressão LaTeX acima para visualizar a fórmula.' : 'Fórmula vazia.'}
          </p>
        )}
      </div>
    </NodeViewWrapper>
  )
}

// ---------------------------------------------------------------------
// Bloco de Diagrama Mermaid (lazy-loaded, securityLevel: 'strict')
// ---------------------------------------------------------------------

const MERMAID_STARTERS: Array<{ label: string; code: string }> = [
  {
    label: 'Fluxograma',
    code: 'flowchart LR\n  A[Entrada] --> B{Validação}\n  B -->|OK| C[Processar]\n  B -->|Erro| D[Registrar erro]',
  },
  {
    label: 'Diagrama ER',
    code: 'erDiagram\n  CLIENTE ||--o{ PEDIDO : realiza\n  PEDIDO ||--|{ ITEM : contem',
  },
  {
    label: 'Pipeline de Dados',
    code: 'flowchart LR\n  Bronze[Camada Bronze] --> Silver[Camada Silver]\n  Silver --> Gold[Camada Gold]\n  Gold --> BI[Dashboards / ML]',
  },
  {
    label: 'Sequência',
    code: 'sequenceDiagram\n  participant App\n  participant Banco\n  App->>Banco: Consulta SQL\n  Banco-->>App: Resultado paginado',
  },
]

let mermaidInitialized = false

export function MermaidBlockNodeView({ node, updateAttributes, editor }: NodeViewProps) {
  const editable = editor.isEditable
  const code = typeof node.attrs.code === 'string' ? node.attrs.code : ''
  const title = typeof node.attrs.title === 'string' ? node.attrs.title : ''
  const rawId = useId()
  const safeDomId = `mmd-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`

  const [editing, setEditing] = useState(!code.trim())
  const [svg, setSvg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const renderSeq = useRef(0)

  useEffect(() => {
    let active = true
    const src = code.trim()
    if (!src) {
      setSvg('')
      setError(null)
      return
    }
    const seq = ++renderSeq.current
    const timer = setTimeout(() => {
      void import('mermaid')
        .then(async (mod) => {
          if (!active || seq !== renderSeq.current) return
          const mermaid = mod.default
          if (!mermaidInitialized) {
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: 'strict', // Bloqueia scripts, onclick e HTML arbitrário no SVG
              theme: 'neutral',
              fontFamily: 'inherit',
            })
            mermaidInitialized = true
          }
          const result = await mermaid.render(`${safeDomId}-${seq}`, src)
          if (!active || seq !== renderSeq.current) return
          setSvg(result.svg)
          setError(null)
        })
        .catch((err: unknown) => {
          if (!active || seq !== renderSeq.current) return
          setSvg('')
          setError(err instanceof Error ? err.message : 'Sintaxe Mermaid inválida.')
        })
    }, 220)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [code, safeDomId])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard indisponível */
    }
  }

  return (
    <NodeViewWrapper data-block-id={node.attrs.blockId || undefined} className="my-3 overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/70 px-3 py-2" contentEditable={false}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Workflow className="size-4 shrink-0 text-accent" aria-hidden />
          {editable ? (
            <input
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Diagrama Mermaid (fluxograma, ER, arquitetura, pipeline)…"
              aria-label="Título do diagrama"
              className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-ink outline-none placeholder:text-muted/70"
            />
          ) : (
            <span className="truncate text-xs font-semibold text-ink">{title || 'Diagrama Mermaid'}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {code.trim() && (
            <button
              type="button"
              onClick={() => void copyCode()}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-ink hover:bg-surface-2"
            >
              {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
              {copied ? 'Copiado' : 'Código'}
            </button>
          )}
          {svg && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Expandir diagrama"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-ink hover:bg-surface-2"
            >
              <Maximize2 className="size-3" />
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-bg px-2 text-[11px] font-medium text-ink hover:bg-surface-2"
            >
              {editing ? <Eye className="size-3" /> : <Code2 className="size-3" />}
              {editing ? 'Visualizar' : 'Editar Mermaid'}
            </button>
          )}
        </div>
      </div>

      <div className="p-4" contentEditable={false}>
        {editable && editing && (
          <div className="mb-3 space-y-2">
            <textarea
              value={code}
              onChange={(e) => updateAttributes({ code: e.target.value })}
              rows={5}
              spellCheck={false}
              placeholder={'flowchart LR\n  A[Fonte] --> B[Transformação] --> C[Destino]'}
              aria-label="Código Mermaid"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs text-ink outline-none focus:border-ink"
            />
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
              <span>Modelo inicial:</span>
              {MERMAID_STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => updateAttributes({ code: s.code, title: title || s.label })}
                  className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-ink hover:border-ink/40"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 font-mono text-xs text-danger">{error}</p>
        ) : svg ? (
          <div
            className="flex justify-center overflow-x-auto rounded-lg bg-bg p-3 [&_svg]:max-w-full"
            // SVG gerado por Mermaid com securityLevel: 'strict' (sem scripts/handlers)
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p className="py-3 text-center text-xs text-muted italic">
            {editable ? 'Escreva um diagrama Mermaid ou escolha um modelo inicial acima.' : 'Diagrama vazio.'}
          </p>
        )}
      </div>

      <Modal
        open={expanded}
        onClose={() => setExpanded(false)}
        size="xl"
        title={title || 'Diagrama Mermaid'}
        footer={<Button onClick={() => setExpanded(false)}>Fechar</Button>}
      >
        <div
          className="flex justify-center overflow-auto rounded-xl border border-line bg-bg p-4 [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </Modal>
    </NodeViewWrapper>
  )
}
