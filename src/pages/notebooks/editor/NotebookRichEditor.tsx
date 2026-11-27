import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/feedback'
import { buildInternalPageHref, parseInternalPageHref } from '@/lib/notebookGraph'
import { markdownToDoc, sanitizeSafeImageSrc, sanitizeSafeUrl } from '@/lib/notebookMarkdown'
import { readValidatedImageAsDataUrl } from '@/services/notebooks'
import type { NotebookContentDoc } from '@/types/db'
import { buildNotebookEditorExtensions } from './extensions'
import { EditorToolbar, SelectionBubbleBar } from './EditorToolbars'
import { filterSlashItems, SlashCommandPopover, type SlashItem } from './SlashCommandMenu'
import { filterLinkablePages, WikiLinkPopover, type LinkablePageOption } from './WikiLinkPopover'

interface NotebookRichEditorProps {
  initialContent: NotebookContentDoc
  /** Incrementado apenas quando o conteúdo precisa ser recarregado externamente (ex.: restauração de versão ou template). */
  contentKey: string
  currentNodeId?: string
  readOnly?: boolean
  linkablePages?: LinkablePageOption[]
  onNavigateInternalLink?: (href: string) => void
  onChange: (doc: NotebookContentDoc) => void
  onCreateFlashcardFromSelection?: (payload: { selectedText: string; blockId: string | null }) => void
}

export default function NotebookRichEditor({
  initialContent,
  contentKey,
  currentNodeId,
  readOnly = false,
  linkablePages = [],
  onNavigateInternalLink,
  onChange,
  onCreateFlashcardFromSelection,
}: NotebookRichEditorProps) {
  const toast = useToast()
  const extensions = useMemo(() => buildNotebookEditorExtensions(), [])
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [slashState, setSlashState] = useState<{ open: boolean; query: string; from: number; pos: { top: number; left: number }; active: number }>({
    open: false,
    query: '',
    from: 0,
    pos: { top: 0, left: 0 },
    active: 0,
  })
  const [wikiState, setWikiState] = useState<{ open: boolean; query: string; from: number; pos: { top: number; left: number }; active: number }>({
    open: false,
    query: '',
    from: 0,
    pos: { top: 0, left: 0 },
    active: 0,
  })
  const [bubblePos, setBubblePos] = useState<{ top: number; left: number } | null>(null)
  const [linkModal, setLinkModal] = useState<{ open: boolean; url: string }>({ open: false, url: '' })
  const [imageModal, setImageModal] = useState<{ open: boolean; url: string; alt: string }>({ open: false, url: '', alt: '' })
  const [mdModal, setMdModal] = useState<{ open: boolean; text: string; mode: 'append' | 'replace' }>({ open: false, text: '', mode: 'append' })
  const [, forceToolbarTick] = useState(0)

  const slashItems = useMemo(() => filterSlashItems(slashState.query), [slashState.query])
  const wikiItems = useMemo(() => filterLinkablePages(linkablePages, wikiState.query, currentNodeId), [linkablePages, wikiState.query, currentNodeId])

  const editor = useEditor(
    {
      extensions,
      content: initialContent,
      editable: !readOnly,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: 'kb-prosemirror focus:outline-none min-h-[380px]',
          'aria-label': 'Editor de conteúdo da página',
        },
        handlePaste: (view, event) => {
          if (!view.editable) return false
          const items = event.clipboardData?.items
          if (!items) return false
          for (const item of items) {
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile()
              if (file) {
                event.preventDefault()
                void readValidatedImageAsDataUrl(file).then(
                  (src) => editor?.chain().focus().setImage({ src, alt: file.name || 'Imagem colada' }).run(),
                  (err) => toast.error(err),
                )
                return true
              }
            }
          }
          return false
        },
        handleDrop: (view, event) => {
          if (!view.editable) return false
          const files = event.dataTransfer?.files
          if (!files?.length) return false
          const img = [...files].find((f) => f.type.startsWith('image/'))
          if (!img) return false
          event.preventDefault()
          void readValidatedImageAsDataUrl(img).then(
            (src) => editor?.chain().focus().setImage({ src, alt: img.name || 'Imagem' }).run(),
            (err) => toast.error(err),
          )
          return true
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChangeRef.current(ed.getJSON() as NotebookContentDoc)
        forceToolbarTick((n) => n + 1)

        // Detecção dos comandos "/" e "[[" no bloco atual
        if (!ed.isEditable) return
        const { from, empty } = ed.state.selection
        if (!empty || ed.isActive('codeBlock')) {
          setSlashState((s) => (s.open ? { ...s, open: false } : s))
          setWikiState((s) => (s.open ? { ...s, open: false } : s))
          return
        }
        const $from = ed.state.doc.resolve(from)
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\n', '\0')

        const wikiMatch = /\[\[([^[\]\n]{0,60})$/.exec(textBefore)
        if (wikiMatch) {
          const wikiStart = from - wikiMatch[1].length - 2
          setSlashState((s) => (s.open ? { ...s, open: false } : s))
          try {
            const coords = ed.view.coordsAtPos(from)
            setWikiState({
              open: true,
              query: wikiMatch[1],
              from: wikiStart,
              pos: { top: Math.min(window.innerHeight - 280, coords.bottom + 8), left: Math.min(window.innerWidth - 300, Math.max(12, coords.left)) },
              active: 0,
            })
          } catch {
            /* pos fora da viewport */
          }
          return
        }
        setWikiState((s) => (s.open ? { ...s, open: false } : s))

        const match = /(?:^|\s)\/([a-zA-Z0-9À-ÿ_-]{0,24})$/.exec(textBefore)
        if (match) {
          const slashStart = from - match[1].length - 1
          try {
            const coords = ed.view.coordsAtPos(from)
            setSlashState({
              open: true,
              query: match[1],
              from: slashStart,
              pos: { top: Math.min(window.innerHeight - 300, coords.bottom + 8), left: Math.min(window.innerWidth - 300, Math.max(12, coords.left)) },
              active: 0,
            })
          } catch {
            /* pos fora da viewport */
          }
        } else {
          setSlashState((s) => (s.open ? { ...s, open: false } : s))
        }
      },
      onSelectionUpdate: ({ editor: ed }) => {
        forceToolbarTick((n) => n + 1)
        if (!ed.isEditable || ed.state.selection.empty || ed.isActive('codeBlock')) {
          setBubblePos(null)
          return
        }
        try {
          const { from, to } = ed.state.selection
          const a = ed.view.coordsAtPos(from)
          const b = ed.view.coordsAtPos(to)
          setBubblePos({
            top: Math.max(56, Math.min(a.top, b.top) - 8),
            left: Math.min(window.innerWidth - 150, Math.max(150, (a.left + b.right) / 2)),
          })
        } catch {
          setBubblePos(null)
        }
      },
      onBlur: () => {
        setTimeout(() => setBubblePos(null), 150)
      },
    },
    [contentKey],
  )

  useEffect(() => {
    if (editor && editor.isEditable !== !readOnly) {
      editor.setEditable(!readOnly)
      if (readOnly) {
        setBubblePos(null)
        setSlashState((s) => ({ ...s, open: false }))
        setWikiState((s) => ({ ...s, open: false }))
      }
    }
  }, [editor, readOnly])

  const executeWikiLink = useCallback(
    (item: LinkablePageOption) => {
      if (!editor) return
      const { from } = wikiState
      const to = editor.state.selection.from
      const href = buildInternalPageHref(item.notebookId, item.id)
      const chain = editor.chain().focus()
      if (wikiState.open && from >= 0 && to >= from) chain.deleteRange({ from, to })
      chain
        .insertContent([
          {
            type: 'text',
            text: item.title,
            marks: [{ type: 'link', attrs: { href } }],
          },
          { type: 'text', text: ' ' },
        ])
        .run()
      setWikiState((s) => ({ ...s, open: false }))
    },
    [editor, wikiState],
  )

  // Navegação por teclado do autocomplete "[["
  useEffect(() => {
    if (!wikiState.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setWikiState((s) => ({ ...s, open: false }))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setWikiState((s) => ({ ...s, active: Math.min(Math.max(0, wikiItems.length - 1), s.active + 1) }))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setWikiState((s) => ({ ...s, active: Math.max(0, s.active - 1) }))
      } else if (e.key === 'Enter' && wikiItems[wikiState.active]) {
        e.preventDefault()
        executeWikiLink(wikiItems[wikiState.active])
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [wikiState.open, wikiState.active, wikiItems, executeWikiLink])

  const executeSlashItem = useCallback(
    (item: SlashItem) => {
      if (!editor) return
      const { from } = slashState
      const to = editor.state.selection.from
      if (slashState.open && from >= 0 && to >= from) {
        editor.chain().focus().deleteRange({ from, to }).run()
      }
      setSlashState((s) => ({ ...s, open: false }))
      item.run(editor, { onPickImage: () => setImageModal({ open: true, url: '', alt: '' }) })
    },
    [editor, slashState],
  )

  // Navegação por teclado do menu "/"
  useEffect(() => {
    if (!slashState.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setSlashState((s) => ({ ...s, open: false }))
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashState((s) => ({ ...s, active: Math.min(Math.max(0, slashItems.length - 1), s.active + 1) }))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashState((s) => ({ ...s, active: Math.max(0, s.active - 1) }))
      } else if (e.key === 'Enter' && slashItems[slashState.active]) {
        e.preventDefault()
        executeSlashItem(slashItems[slashState.active])
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [slashState.open, slashState.active, slashItems, executeSlashItem])

  // Atalho Ctrl+Shift+F: criar flashcard a partir da seleção ou do bloco atual
  const triggerFlashcardFromSelection = useCallback(() => {
    if (!editor || !onCreateFlashcardFromSelection) return
    const { from, to } = editor.state.selection
    const selectedText = from !== to ? editor.state.doc.textBetween(from, to, '\n') : ''
    const $from = editor.state.doc.resolve(from)
    const topNode = $from.depth >= 1 ? $from.node(1) : null
    const blockId = typeof topNode?.attrs?.blockId === 'string' ? topNode.attrs.blockId : null
    setBubblePos(null)
    onCreateFlashcardFromSelection({ selectedText, blockId })
  }, [editor, onCreateFlashcardFromSelection])

  useEffect(() => {
    if (!onCreateFlashcardFromSelection) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        triggerFlashcardFromSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCreateFlashcardFromSelection, triggerFlashcardFromSelection])

  // Move o bloco de topo atual para cima ou para baixo
  const moveCurrentBlock = (dir: -1 | 1) => {
    if (!editor) return
    const { state, view } = editor
    const { $from } = state.selection
    if ($from.depth < 1) return
    const index = $from.index(0)
    const targetIndex = index + dir
    const doc = state.doc
    if (targetIndex < 0 || targetIndex >= doc.childCount) return

    const children = []
    for (let i = 0; i < doc.childCount; i++) children.push(doc.child(i))
    const [moved] = children.splice(index, 1)
    children.splice(targetIndex, 0, moved)

    const tr = state.tr.replaceWith(0, doc.content.size, children)
    view.dispatch(tr.scrollIntoView())
    editor.commands.focus()
  }

  // Duplica o bloco de topo atual (BlockIdExtension garante novo UUID automaticamente)
  const duplicateCurrentBlock = () => {
    if (!editor) return
    const { state } = editor
    const { $from } = state.selection
    if ($from.depth < 1) return
    const blockNode = $from.node(1)
    const afterPos = $from.after(1)
    const json = blockNode.toJSON() as Record<string, unknown>
    if (json.attrs && typeof json.attrs === 'object') {
      json.attrs = { ...(json.attrs as Record<string, unknown>), blockId: crypto.randomUUID() }
    }
    editor.chain().focus().insertContentAt(afterPos, json).run()
  }

  const openLinkModal = () => {
    if (!editor) return
    const current = (editor.getAttributes('link').href as string) ?? ''
    setLinkModal({ open: true, url: current })
  }

  const saveLink = () => {
    if (!editor) return
    const trimmed = linkModal.url.trim()
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      setLinkModal({ open: false, url: '' })
      return
    }
    const safe = sanitizeSafeUrl(trimmed)
    if (!safe) {
      toast.error('URL inválida. Use http://, https://, mailto: ou um caminho interno /cadernos/…')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run()
    setLinkModal({ open: false, url: '' })
  }

  const insertImageByUrl = () => {
    if (!editor) return
    const safe = sanitizeSafeImageSrc(imageModal.url)
    if (!safe) {
      toast.error('URL de imagem inválida. Use https:// ou envie um arquivo PNG/JPEG/WebP/GIF.')
      return
    }
    editor.chain().focus().setImage({ src: safe, alt: imageModal.alt.trim() || 'Imagem' }).run()
    setImageModal({ open: false, url: '', alt: '' })
  }

  const onImageFileChange = async (file: File | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file || !editor) return
    try {
      const src = await readValidatedImageAsDataUrl(file)
      editor.chain().focus().setImage({ src, alt: imageModal.alt.trim() || file.name }).run()
      setImageModal({ open: false, url: '', alt: '' })
    } catch (e) {
      toast.error(e)
    }
  }

  const applyMarkdownImport = () => {
    if (!editor || !mdModal.text.trim()) return
    const doc = markdownToDoc(mdModal.text)
    if (mdModal.mode === 'replace') {
      editor.commands.setContent(doc)
    } else {
      editor.chain().focus('end').insertContent(doc.content).run()
    }
    onChangeRef.current(editor.getJSON() as NotebookContentDoc)
    setMdModal({ open: false, text: '', mode: 'append' })
    toast.success('Markdown importado para a página.')
  }

  if (!editor) return null

  return (
    <div className="space-y-3">
      {!readOnly && (
        <EditorToolbar
          editor={editor}
          onOpenLink={openLinkModal}
          onOpenImage={() => setImageModal({ open: true, url: '', alt: '' })}
          onOpenSlash={() => {
            const { from } = editor.state.selection
            try {
              const coords = editor.view.coordsAtPos(from)
              setSlashState({
                open: true,
                query: '',
                from,
                pos: { top: Math.min(window.innerHeight - 300, coords.bottom + 8), left: Math.min(window.innerWidth - 300, Math.max(12, coords.left)) },
                active: 0,
              })
            } catch {
              setSlashState({ open: true, query: '', from, pos: { top: 180, left: 260 }, active: 0 })
            }
          }}
          onOpenMarkdownImport={() => setMdModal({ open: true, text: '', mode: 'append' })}
          onMoveBlock={moveCurrentBlock}
          onDuplicateBlock={duplicateCurrentBlock}
        />
      )}

      <div
        className={readOnly ? 'py-2' : 'rounded-xl border border-line bg-surface px-5 py-5 sm:px-7'}
        onClick={(e) => {
          const anchor = (e.target as HTMLElement | null)?.closest('a')
          if (!anchor) return
          const href = anchor.getAttribute('href')
          if (href && parseInternalPageHref(href) && (readOnly || e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onNavigateInternalLink?.(href)
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {!readOnly && bubblePos && (
        <SelectionBubbleBar
          editor={editor}
          position={bubblePos}
          onOpenLink={openLinkModal}
          onCreateFlashcard={onCreateFlashcardFromSelection ? triggerFlashcardFromSelection : undefined}
        />
      )}

      {!readOnly && slashState.open && (
        <SlashCommandPopover
          items={slashItems}
          activeIndex={slashState.active}
          position={slashState.pos}
          onHover={(active) => setSlashState((s) => ({ ...s, active }))}
          onSelect={executeSlashItem}
        />
      )}

      {!readOnly && wikiState.open && (
        <WikiLinkPopover
          items={wikiItems}
          activeIndex={wikiState.active}
          position={wikiState.pos}
          onHover={(active) => setWikiState((s) => ({ ...s, active }))}
          onSelect={executeWikiLink}
        />
      )}

      {/* Modal de link */}
      <Modal
        open={linkModal.open}
        onClose={() => setLinkModal({ open: false, url: '' })}
        size="sm"
        title="Inserir ou editar link"
        footer={
          <>
            <Button onClick={() => setLinkModal({ open: false, url: '' })}>Cancelar</Button>
            <Button variant="primary" onClick={saveLink}>
              Aplicar link
            </Button>
          </>
        }
      >
        <Field label="URL" hint="Aceita https://, http://, mailto: ou links internos /cadernos/… Deixe vazio para remover.">
          {(id, d) => (
            <Input
              id={id}
              aria-describedby={d}
              value={linkModal.url}
              placeholder="https://…"
              onChange={(e) => setLinkModal((m) => ({ ...m, url: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && saveLink()}
            />
          )}
        </Field>
      </Modal>

      {/* Modal de imagem */}
      <Modal
        open={imageModal.open}
        onClose={() => setImageModal({ open: false, url: '', alt: '' })}
        size="sm"
        title="Inserir imagem"
        description="Envie uma imagem local (PNG, JPEG, WebP ou GIF, até 4 MB) ou informe uma URL segura. Você também pode colar imagens direto no editor (Ctrl+V)."
        footer={
          <>
            <Button onClick={() => setImageModal({ open: false, url: '', alt: '' })}>Cancelar</Button>
            <Button variant="primary" onClick={insertImageByUrl} disabled={!imageModal.url.trim()}>
              Inserir por URL
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Button variant="secondary" className="w-full" onClick={() => fileInputRef.current?.click()}>
              Escolher arquivo de imagem…
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(e) => void onImageFileChange(e.target.files?.[0])}
            />
          </div>
          <Field label="Ou URL da imagem (https://)">
            {(id) => (
              <Input
                id={id}
                value={imageModal.url}
                placeholder="https://…"
                onChange={(e) => setImageModal((m) => ({ ...m, url: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Texto alternativo (acessibilidade)">
            {(id) => (
              <Input
                id={id}
                value={imageModal.alt}
                placeholder="Descrição breve da imagem"
                onChange={(e) => setImageModal((m) => ({ ...m, alt: e.target.value }))}
              />
            )}
          </Field>
        </div>
      </Modal>

      {/* Modal de importação de Markdown */}
      <Modal
        open={mdModal.open}
        onClose={() => setMdModal({ open: false, text: '', mode: 'append' })}
        size="lg"
        title="Importar Markdown"
        description="Converte títulos, listas, checklists, citações, tabelas e blocos de código em blocos estruturados (sem scripts executáveis)."
        footer={
          <>
            <Button onClick={() => setMdModal({ open: false, text: '', mode: 'append' })}>Cancelar</Button>
            <Button variant="primary" disabled={!mdModal.text.trim()} onClick={applyMarkdownImport}>
              Importar blocos
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={mdModal.mode === 'append'} onChange={() => setMdModal((m) => ({ ...m, mode: 'append' }))} />
              Adicionar ao final da página
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input type="radio" checked={mdModal.mode === 'replace'} onChange={() => setMdModal((m) => ({ ...m, mode: 'replace' }))} />
              Substituir conteúdo atual
            </label>
          </div>
          <Field label="Conteúdo Markdown">
            {(id) => (
              <Textarea
                id={id}
                rows={12}
                value={mdModal.text}
                placeholder={'## Exemplo\n\n- [ ] Item de checklist\n\n```sql\nSELECT 1;\n```'}
                onChange={(e) => setMdModal((m) => ({ ...m, text: e.target.value }))}
              />
            )}
          </Field>
        </div>
      </Modal>
    </div>
  )
}
