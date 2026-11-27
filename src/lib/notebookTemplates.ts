import type { NotebookContentDoc, NotebookContentNode } from '@/types/db'

export interface BuiltinTemplate {
  id: string
  name: string
  category: string
  description: string
  build: () => NotebookContentDoc
}

const bid = () => ({ blockId: crypto.randomUUID() })

const h = (level: 1 | 2 | 3, text: string): NotebookContentNode => ({
  type: 'heading',
  attrs: { level, ...bid() },
  content: [{ type: 'text', text }],
})

const p = (text = ''): NotebookContentNode =>
  text
    ? { type: 'paragraph', attrs: bid(), content: [{ type: 'text', text }] }
    : { type: 'paragraph', attrs: bid() }

const callout = (variant: 'info' | 'warning' | 'definition' | 'example' | 'summary' | 'pitfall' | 'exercise', title: string): NotebookContentNode => ({
  type: 'callout',
  attrs: { variant, title, ...bid() },
  content: [p()],
})

const qa = (question = ''): NotebookContentNode => ({
  type: 'qaBlock',
  attrs: { question, open: false, ...bid() },
  content: [p()],
})

const code = (language = 'sql', title = ''): NotebookContentNode => ({
  type: 'codeBlock',
  attrs: { language, title, description: '', showLineNumbers: true, wrapLines: false, ...bid() },
  content: [],
})

const checklist = (items: string[]): NotebookContentNode => ({
  type: 'taskList',
  attrs: bid(),
  content: items.map((label) => ({
    type: 'taskItem',
    attrs: { checked: false },
    content: [p(label)],
  })),
})

const bulletList = (items: string[]): NotebookContentNode => ({
  type: 'bulletList',
  attrs: bid(),
  content: items.map((label) => ({
    type: 'listItem',
    content: [p(label)],
  })),
})

/**
 * Modelos iniciais de página.
 * Preenchem somente a estrutura organizacional — sem inventar conteúdo de estudo.
 */
export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: 'blank',
    name: 'Anotação livre',
    category: 'Geral',
    description: 'Página em branco para escrita manual.',
    build: () => ({ type: 'doc', content: [p()] }),
  },
  {
    id: 'cornell',
    name: 'Método Cornell',
    category: 'Estudo',
    description: 'Assunto, perguntas-chave, anotações, resumo e revisão.',
    build: () => ({
      type: 'doc',
      content: [
        h(2, 'Assunto'),
        p(),
        h(2, 'Perguntas-chave'),
        qa(),
        h(2, 'Anotações'),
        p(),
        callout('summary', 'Resumo'),
        h(2, 'Revisão'),
        checklist(['Reler anotações', 'Responder perguntas-chave sem consultar', 'Criar flashcards dos pontos críticos']),
      ],
    }),
  },
  {
    id: 'tech_doc',
    name: 'Documentação técnica',
    category: 'Tecnologia & Dados',
    description: 'Conceito, finalidade, sintaxe, parâmetros, exemplos, boas práticas, erros comuns e referências.',
    build: () => ({
      type: 'doc',
      content: [
        callout('definition', 'Conceito'),
        h(2, 'Finalidade'),
        p(),
        h(2, 'Sintaxe'),
        code('sql', 'Sintaxe'),
        h(2, 'Parâmetros'),
        bulletList(['']),
        callout('example', 'Exemplos'),
        h(2, 'Boas práticas'),
        bulletList(['']),
        callout('pitfall', 'Erros comuns'),
        h(2, 'Referências'),
        bulletList(['']),
      ],
    }),
  },
  {
    id: 'concurso',
    name: 'Estudo para concursos',
    category: 'Concursos',
    description: 'Tema, conceito, fundamentação, pontos importantes, exceções, pegadinhas, questões e resumo.',
    build: () => ({
      type: 'doc',
      content: [
        h(2, 'Tema'),
        p(),
        callout('definition', 'Conceito'),
        h(2, 'Fundamentação legal / doutrinária'),
        p(),
        callout('info', 'Pontos importantes'),
        callout('warning', 'Exceções e regras especiais'),
        callout('pitfall', 'Pegadinhas de prova'),
        callout('exercise', 'Questões e observações'),
        callout('summary', 'Resumo para revisão'),
      ],
    }),
  },
  {
    id: 'course_lesson',
    name: 'Aula de curso',
    category: 'Cursos',
    description: 'Curso, aula, objetivo, conteúdo, exemplos, dúvidas e exercícios.',
    build: () => ({
      type: 'doc',
      content: [
        h(2, 'Identificação'),
        bulletList(['Curso: ', 'Aula: ', 'Objetivo: ']),
        h(2, 'Conteúdo'),
        p(),
        callout('example', 'Exemplos'),
        callout('warning', 'Dúvidas para investigar'),
        callout('exercise', 'Exercícios'),
      ],
    }),
  },
  {
    id: 'problem_solving',
    name: 'Resolução de problemas',
    category: 'Engenharia',
    description: 'Problema, contexto, hipóteses, investigação, solução, código, validação e aprendizados.',
    build: () => ({
      type: 'doc',
      content: [
        h(2, 'Problema'),
        p(),
        h(2, 'Contexto'),
        p(),
        h(2, 'Hipóteses'),
        bulletList(['']),
        h(2, 'Investigação'),
        p(),
        h(2, 'Solução'),
        p(),
        code('python', 'Código / Implementação'),
        h(2, 'Validação'),
        checklist(['Reprodução do problema', 'Validação da correção', 'Verificação de regressões']),
        callout('summary', 'Aprendizados'),
      ],
    }),
  },
  {
    id: 'reading_notes',
    name: 'Fichamento',
    category: 'Leitura',
    description: 'Referência bibliográfica, ideia principal, conceitos, citações, interpretação pessoal e conclusão.',
    build: () => ({
      type: 'doc',
      content: [
        h(2, 'Referência bibliográfica'),
        p(),
        h(2, 'Ideia principal'),
        p(),
        callout('definition', 'Conceitos-chave'),
        h(2, 'Citações'),
        { type: 'blockquote', attrs: bid(), content: [p()] },
        h(2, 'Interpretação pessoal'),
        p(),
        callout('summary', 'Conclusão'),
      ],
    }),
  },
  {
    id: 'learning_journal',
    name: 'Diário de aprendizado',
    category: 'Reflexão',
    description: 'Data, o que estudei, o que aprendi, dificuldades e próximos passos.',
    build: () => ({
      type: 'doc',
      content: [
        h(2, `Data — ${new Date().toLocaleDateString('pt-BR')}`),
        h(3, 'O que estudei'),
        p(),
        h(3, 'O que aprendi'),
        p(),
        callout('warning', 'Dificuldades'),
        h(3, 'Próximos passos'),
        checklist(['']),
      ],
    }),
  },
]
