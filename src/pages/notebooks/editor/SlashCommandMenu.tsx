import type { Editor } from '@tiptap/react'
import {
  AlertTriangle,
  BookMarked,
  BookOpen,
  CheckSquare,
  ChevronRightSquare,
  Code2,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Lightbulb,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Sigma,
  Table as TableIcon,
  Workflow,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SlashItem {
  id: string
  label: string
  description: string
  keywords: string[]
  category: 'Texto' | 'Listas' | 'Estudo' | 'Técnico'
  icon: LucideIcon
  run: (editor: Editor, helpers: { onPickImage: () => void }) => void
}

export const SLASH_ITEMS: SlashItem[] = [
  {
    id: 'paragraph',
    label: 'Parágrafo',
    description: 'Texto livre comum',
    keywords: ['texto', 'p', 'paragrafo'],
    category: 'Texto',
    icon: Pilcrow,
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: 'h1',
    label: 'Título 1',
    description: 'Seção principal da página',
    keywords: ['h1', 'titulo', 'heading'],
    category: 'Texto',
    icon: Heading1,
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Título 2',
    description: 'Subtítulo de tópico',
    keywords: ['h2', 'titulo', 'subtitulo'],
    category: 'Texto',
    icon: Heading2,
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Título 3',
    description: 'Subseção detalhada',
    keywords: ['h3', 'titulo'],
    category: 'Texto',
    icon: Heading3,
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet',
    label: 'Lista com marcadores',
    description: 'Itens não ordenados',
    keywords: ['lista', 'ul', 'bullets', 'marcadores'],
    category: 'Listas',
    icon: List,
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ordered',
    label: 'Lista numerada',
    description: 'Passos ou sequência ordenada',
    keywords: ['lista', 'ol', 'numerada', 'passos'],
    category: 'Listas',
    icon: ListOrdered,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'checklist',
    label: 'Checklist',
    description: 'Lista interativa de verificação',
    keywords: ['todo', 'check', 'checklist', 'tarefa'],
    category: 'Listas',
    icon: CheckSquare,
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'quote',
    label: 'Citação',
    description: 'Destaque de trecho ou referência',
    keywords: ['citacao', 'quote', 'blockquote'],
    category: 'Texto',
    icon: Quote,
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'divider',
    label: 'Divisor',
    description: 'Linha horizontal separadora',
    keywords: ['hr', 'linha', 'divisor', 'separador'],
    category: 'Texto',
    icon: Minus,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'code-sql',
    label: 'Bloco de código (SQL / Dados)',
    description: 'SQL, PostgreSQL, Python, DAX, Power Query M…',
    keywords: ['codigo', 'code', 'sql', 'python', 'dax', 'r', 'bash'],
    category: 'Técnico',
    icon: Code2,
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: 'codeBlock',
          attrs: { language: 'sql', title: '', description: '', showLineNumbers: true, wrapLines: false, blockId: crypto.randomUUID() },
        })
        .run(),
  },
  {
    id: 'code-python',
    label: 'Bloco de código Python',
    description: 'Python com execução manual no laboratório',
    keywords: ['python', 'py', 'script', 'pandas'],
    category: 'Técnico',
    icon: FileCode2,
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: 'codeBlock',
          attrs: { language: 'python', title: '', description: '', showLineNumbers: true, wrapLines: false, blockId: crypto.randomUUID() },
        })
        .run(),
  },
  {
    id: 'table',
    label: 'Tabela editável',
    description: 'Tabela 3×3 com linha de cabeçalho',
    keywords: ['tabela', 'table', 'grade', 'comparacao'],
    category: 'Técnico',
    icon: TableIcon,
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'image',
    label: 'Imagem',
    description: 'Enviar arquivo PNG/JPEG/WebP ou colar URL',
    keywords: ['imagem', 'foto', 'print', 'image'],
    category: 'Técnico',
    icon: ImageIcon,
    run: (_e, h) => h.onPickImage(),
  },
  {
    id: 'math',
    label: 'Fórmula matemática (LaTeX)',
    description: 'Equações e estatística renderizadas com KaTeX',
    keywords: ['formula', 'latex', 'katex', 'matematica', 'equacao', 'math'],
    category: 'Técnico',
    icon: Sigma,
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({ type: 'mathBlock', attrs: { formula: '', caption: '', blockId: crypto.randomUUID() } })
        .run(),
  },
  {
    id: 'mermaid',
    label: 'Diagrama Mermaid',
    description: 'Fluxogramas, ER, arquitetura e pipelines de dados',
    keywords: ['diagrama', 'mermaid', 'fluxograma', 'er', 'pipeline', 'arquitetura'],
    category: 'Técnico',
    icon: Workflow,
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({ type: 'mermaidBlock', attrs: { code: '', title: '', blockId: crypto.randomUUID() } })
        .run(),
  },
  {
    id: 'callout-info',
    label: 'Callout — Informação',
    description: 'Destaque informativo',
    keywords: ['callout', 'info', 'nota', 'aviso'],
    category: 'Estudo',
    icon: Info,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'info', title: 'Informação', blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'callout-warning',
    label: 'Callout — Atenção',
    description: 'Ponto de atenção ou exceção',
    keywords: ['atencao', 'warning', 'cuidado', 'excecao'],
    category: 'Estudo',
    icon: AlertTriangle,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'warning', title: 'Atenção', blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'callout-definition',
    label: 'Bloco de definição',
    description: 'Conceito formal e objetivo',
    keywords: ['definicao', 'conceito', 'teoria'],
    category: 'Estudo',
    icon: BookMarked,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'definition', title: 'Definição', blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'callout-example',
    label: 'Bloco de exemplo',
    description: 'Caso prático ilustrativo',
    keywords: ['exemplo', 'pratica', 'caso'],
    category: 'Estudo',
    icon: Lightbulb,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'example', title: 'Exemplo', blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'callout-summary',
    label: 'Bloco de resumo',
    description: 'Síntese rápida para revisão',
    keywords: ['resumo', 'sintese', 'conclusao'],
    category: 'Estudo',
    icon: BookOpen,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'summary', title: 'Resumo', blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'callout-pitfall',
    label: 'Bloco de erro comum',
    description: 'Pegadinhas e erros recorrentes',
    keywords: ['erro', 'pegadinha', 'armadilha', 'pitfall'],
    category: 'Estudo',
    icon: XCircle,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'pitfall', title: 'Erro comum', blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'callout-exercise',
    label: 'Bloco de exercício',
    description: 'Enunciado e resolução prática',
    keywords: ['exercicio', 'questao', 'pratica'],
    category: 'Estudo',
    icon: FileCode2,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'callout', attrs: { variant: 'exercise', title: 'Exercício', blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'qa',
    label: 'Pergunta e resposta (Q&A)',
    description: 'Resposta recolhida para revisão ativa',
    keywords: ['qa', 'pergunta', 'resposta', 'revisao', 'ativa'],
    category: 'Estudo',
    icon: HelpCircle,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'qaBlock', attrs: { question: '', open: true, blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'toggle',
    label: 'Conteúdo expansível',
    description: 'Bloco recolhível para detalhes extras',
    keywords: ['toggle', 'expansivel', 'recolher', 'detalhes', 'spoiler'],
    category: 'Estudo',
    icon: ChevronRightSquare,
    run: (e) =>
      e.chain().focus().insertContent({ type: 'toggleBlock', attrs: { summary: '', open: true, blockId: crypto.randomUUID() }, content: [{ type: 'paragraph' }] }).run(),
  },
  {
    id: 'glossary',
    label: 'Glossário',
    description: 'Lista estruturada de termos e definições',
    keywords: ['glossario', 'termos', 'vocabulario'],
    category: 'Estudo',
    icon: BookMarked,
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({
          type: 'glossaryBlock',
          attrs: {
            title: 'Glossário',
            entries: [{ id: crypto.randomUUID(), term: '', definition: '' }],
            blockId: crypto.randomUUID(),
          },
        })
        .run(),
  },
]

export function filterSlashItems(query: string): SlashItem[] {
  const q = query
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
  if (!q) return SLASH_ITEMS
  return SLASH_ITEMS.filter((item) => {
    const hay = [item.label, item.description, item.category, ...item.keywords]
      .join(' ')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function SlashCommandPopover({
  items,
  activeIndex,
  position,
  onSelect,
  onHover,
}: {
  items: SlashItem[]
  activeIndex: number
  position: { top: number; left: number }
  onSelect: (item: SlashItem) => void
  onHover: (idx: number) => void
}) {
  return (
    <div
      role="listbox"
      aria-label="Inserir bloco"
      style={{ top: position.top, left: position.left }}
      className="animate-fade-in fixed z-50 w-72 overflow-hidden rounded-xl border border-line bg-bg shadow-xl"
    >
      <div className="border-b border-line bg-surface-2/60 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
        Inserir bloco (↑↓ Enter)
      </div>
      <div className="scroll-thin max-h-72 overflow-y-auto p-1">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-muted">Nenhum bloco encontrado.</p>
        ) : (
          items.map((item, idx) => {
            const Icon = item.icon
            const active = idx === activeIndex
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => onHover(idx)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(item)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                  active ? 'bg-surface-2 text-ink' : 'text-ink/85 hover:bg-surface-2/60',
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-bg text-ink">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink">{item.label}</span>
                  <span className="block truncate text-[11px] text-muted">{item.description}</span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
