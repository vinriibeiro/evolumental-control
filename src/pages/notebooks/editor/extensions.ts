import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { sanitizeSafeUrl } from '@/lib/notebookMarkdown'
import { CalloutNodeView, CodeBlockNodeView, GlossaryNodeView, QaNodeView, ToggleNodeView } from './CustomBlockViews'
import { MathBlockNodeView, MermaidBlockNodeView } from './RichTechnicalViews'
import { getNotebookLowlight } from './languages'

const BLOCK_ID_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'taskList',
  'table',
  'horizontalRule',
  'callout',
  'qaBlock',
  'toggleBlock',
  'glossaryBlock',
  'mathBlock',
  'mermaidBlock',
  'image',
]

/**
 * Garante que todo bloco de nível superior possua um `blockId` único e estável,
 * preservando referências existentes e gerando novos UUIDs ao criar ou duplicar blocos.
 */
export const BlockIdExtension = Extension.create({
  name: 'blockId',
  addGlobalAttributes() {
    return [
      {
        types: BLOCK_ID_TYPES,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (el) => el.getAttribute('data-block-id'),
            renderHTML: (attrs) => (attrs.blockId ? { 'data-block-id': String(attrs.blockId) } : {}),
          },
        },
      },
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('notebook-block-id'),
        appendTransaction(_transactions, _oldState, newState) {
          const seen = new Set<string>()
          let tr = newState.tr
          let changed = false

          newState.doc.forEach((node, offset) => {
            if (!BLOCK_ID_TYPES.includes(node.type.name)) return
            const id = typeof node.attrs.blockId === 'string' && node.attrs.blockId.trim() ? node.attrs.blockId : null
            if (!id || seen.has(id)) {
              const nextId = crypto.randomUUID()
              seen.add(nextId)
              tr = tr.setNodeMarkup(offset, undefined, { ...node.attrs, blockId: nextId })
              changed = true
            } else {
              seen.add(id)
            }
          })

          return changed ? tr.setMeta('addToHistory', false) : null
        },
      }),
    ]
  },
})

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      variant: { default: 'info' },
      title: { default: 'Informação' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView)
  },
})

export const QaBlockExtension = Node.create({
  name: 'qaBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      question: { default: '' },
      open: { default: false },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="qa-block"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'qa-block' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(QaNodeView)
  },
})

export const ToggleBlockExtension = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      summary: { default: '' },
      open: { default: true },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="toggle-block"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle-block' }), 0]
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleNodeView)
  },
})

export const GlossaryBlockExtension = Node.create({
  name: 'glossaryBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      title: { default: 'Glossário' },
      entries: {
        default: [{ id: 'term-1', term: '', definition: '' }],
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="glossary-block"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'glossary-block' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(GlossaryNodeView)
  },
})

export const MathBlockExtension = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      formula: { default: '' },
      caption: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MathBlockNodeView)
  },
})

export const MermaidBlockExtension = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      code: { default: '' },
      title: { default: '' },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="mermaid-block"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid-block' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockNodeView)
  },
})

export const EnhancedCodeBlockExtension = CodeBlockLowlight.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: { default: 'sql' },
      title: { default: '' },
      description: { default: '' },
      showLineNumbers: { default: true },
      wrapLines: { default: false },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockNodeView)
  },
}).configure({
  lowlight: getNotebookLowlight(),
  defaultLanguage: 'sql',
})

export function buildNotebookEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: false,
      underline: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    Underline,
    Superscript,
    Subscript,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      validate: (href) => Boolean(sanitizeSafeUrl(href)),
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
        class: 'text-accent underline underline-offset-2 hover:text-accent-strong',
      },
    }),
    Image.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: 'my-4 max-h-[480px] rounded-xl border border-line object-contain',
      },
    }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    EnhancedCodeBlockExtension,
    CalloutExtension,
    QaBlockExtension,
    ToggleBlockExtension,
    GlossaryBlockExtension,
    MathBlockExtension,
    MermaidBlockExtension,
    BlockIdExtension,
    Placeholder.configure({
      placeholder: 'Escreva aqui ou digite "/" para inserir blocos…',
    }),
  ]
}
