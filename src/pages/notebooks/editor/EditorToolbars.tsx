import type { Editor } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  CheckSquare,
  Code,
  Code2,
  CopyPlus,
  FileUp,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Layers,
  Link2,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table as TableIcon,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react'
import { cn } from '@/lib/cn'

const TEXT_COLORS = [
  { label: 'Padrão', value: '' },
  { label: 'Vermelho destaque', value: '#B91C1C' },
  { label: 'Cinza secundário', value: '#6B6B6B' },
]

const HIGHLIGHT_COLORS = [
  { label: 'Sem destaque', value: '' },
  { label: 'Neutro suave', value: '#E5E7EB' },
  { label: 'Vermelho suave', value: '#FEE2E2' },
]

function ToolBtn({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-md text-xs transition-colors disabled:opacity-40',
        active ? 'bg-ink text-bg' : 'text-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

export function EditorToolbar({
  editor,
  onOpenLink,
  onOpenImage,
  onOpenSlash,
  onOpenMarkdownImport,
  onMoveBlock,
  onDuplicateBlock,
}: {
  editor: Editor
  onOpenLink: () => void
  onOpenImage: () => void
  onOpenSlash: () => void
  onOpenMarkdownImport: () => void
  onMoveBlock: (dir: -1 | 1) => void
  onDuplicateBlock: () => void
}) {
  const inTable = editor.isActive('table')
  const headingLevel = [1, 2, 3, 4, 5, 6].find((l) => editor.isActive('heading', { level: l })) ?? 0

  return (
    <div
      role="toolbar"
      aria-label="Formatação do editor"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-bg/95 p-1.5 backdrop-blur"
    >
      <ToolBtn label="Desfazer (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Refazer (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="size-3.5" />
      </ToolBtn>

      <span className="mx-1 h-4 w-px bg-line" aria-hidden />

      <select
        aria-label="Estilo de bloco"
        value={headingLevel}
        onChange={(e) => {
          const lvl = Number(e.target.value)
          if (lvl === 0) editor.chain().focus().setParagraph().run()
          else editor.chain().focus().toggleHeading({ level: lvl as 1 | 2 | 3 | 4 | 5 | 6 }).run()
        }}
        className="h-7 rounded-md border border-line bg-surface-2 px-1.5 text-xs font-medium text-ink outline-none focus:border-ink"
      >
        <option value={0}>Texto</option>
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
        <option value={4}>H4</option>
        <option value={5}>H5</option>
        <option value={6}>H6</option>
      </select>

      <span className="mx-1 h-4 w-px bg-line" aria-hidden />

      <ToolBtn label="Negrito (Ctrl+B)" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Itálico (Ctrl+I)" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Sublinhado (Ctrl+U)" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Código inline" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Sobrescrito" active={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
        <Superscript className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Subscrito" active={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>
        <Subscript className="size-3.5" />
      </ToolBtn>

      <select
        aria-label="Cor do texto"
        value={(editor.getAttributes('textStyle').color as string) ?? ''}
        onChange={(e) => {
          if (e.target.value) editor.chain().focus().setColor(e.target.value).run()
          else editor.chain().focus().unsetColor().run()
        }}
        className="h-7 rounded-md border border-line bg-bg px-1 text-[11px] text-muted outline-none focus:border-ink"
      >
        {TEXT_COLORS.map((c) => (
          <option key={c.label} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Cor de destaque"
        value={(editor.getAttributes('highlight').color as string) ?? ''}
        onChange={(e) => {
          if (e.target.value) editor.chain().focus().setHighlight({ color: e.target.value }).run()
          else editor.chain().focus().unsetHighlight().run()
        }}
        className="h-7 rounded-md border border-line bg-bg px-1 text-[11px] text-muted outline-none focus:border-ink"
      >
        {HIGHLIGHT_COLORS.map((c) => (
          <option key={c.label} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <span className="mx-1 h-4 w-px bg-line" aria-hidden />

      <ToolBtn label="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Justificar" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <AlignJustify className="size-3.5" />
      </ToolBtn>

      <span className="mx-1 h-4 w-px bg-line" aria-hidden />

      <ToolBtn label="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Checklist" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <CheckSquare className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Divisor" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Link" active={editor.isActive('link')} onClick={onOpenLink}>
        <Link2 className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Inserir imagem" onClick={onOpenImage}>
        <ImageIcon className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Bloco de código"
        active={editor.isActive('codeBlock')}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'codeBlock',
              attrs: { language: 'sql', title: '', description: '', showLineNumbers: true, wrapLines: false, blockId: crypto.randomUUID() },
            })
            .run()
        }
      >
        <Code2 className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Inserir tabela" active={inTable} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
        <TableIcon className="size-3.5" />
      </ToolBtn>

      <span className="mx-1 h-4 w-px bg-line" aria-hidden />

      <ToolBtn label="Mover bloco para cima" onClick={() => onMoveBlock(-1)}>
        <ArrowUp className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Mover bloco para baixo" onClick={() => onMoveBlock(1)}>
        <ArrowDown className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Duplicar bloco atual" onClick={onDuplicateBlock}>
        <CopyPlus className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Importar Markdown" onClick={onOpenMarkdownImport}>
        <FileUp className="size-3.5" />
      </ToolBtn>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault()
          onOpenSlash()
        }}
        className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface-2 px-2 text-[11px] font-medium text-ink hover:border-ink/40"
      >
        <Plus className="size-3" /> Bloco (/)
      </button>

      {inTable && (
        <div className="mt-1 flex w-full flex-wrap items-center gap-1 border-t border-line pt-1.5 text-[11px]">
          <span className="font-semibold text-muted">Tabela:</span>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="rounded border border-line px-2 py-0.5 hover:bg-surface-2">
            + Linha
          </button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="rounded border border-line px-2 py-0.5 hover:bg-surface-2">
            + Coluna
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="rounded border border-line px-2 py-0.5 hover:bg-surface-2">
            − Linha
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="rounded border border-line px-2 py-0.5 hover:bg-surface-2">
            − Coluna
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="ml-auto inline-flex items-center gap-1 rounded border border-danger/30 px-2 py-0.5 text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-3" /> Remover tabela
          </button>
        </div>
      )}
    </div>
  )
}

export function SelectionBubbleBar({
  editor,
  position,
  onOpenLink,
  onCreateFlashcard,
}: {
  editor: Editor
  position: { top: number; left: number }
  onOpenLink: () => void
  onCreateFlashcard?: () => void
}) {
  return (
    <div
      role="toolbar"
      aria-label="Formatação rápida da seleção"
      style={{ top: position.top, left: position.left, transform: 'translate(-50%, -100%)' }}
      className="animate-fade-in fixed z-40 flex items-center gap-0.5 rounded-lg border border-line bg-bg p-1 shadow-xl"
    >
      <ToolBtn label="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Código" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code className="size-3.5" />
      </ToolBtn>
      <ToolBtn
        label="Destacar"
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight({ color: '#FEE2E2' }).run()}
      >
        <Highlighter className="size-3.5" />
      </ToolBtn>
      <ToolBtn label="Link" active={editor.isActive('link')} onClick={onOpenLink}>
        <Link2 className="size-3.5" />
      </ToolBtn>
      {onCreateFlashcard && (
        <>
          <span className="mx-1 h-4 w-px bg-line" aria-hidden />
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onCreateFlashcard()
            }}
            title="Criar flashcard a partir do trecho selecionado (Ctrl+Shift+F)"
            className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2 text-[11px] font-medium text-accent-ink hover:bg-accent-strong"
          >
            <Layers className="size-3" aria-hidden />
            Criar flashcard
          </button>
        </>
      )}
    </div>
  )
}
