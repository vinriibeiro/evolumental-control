// Paleta de comandos (Ctrl/Cmd+K): ações rápidas por texto. Pura e testável.

export interface Command {
  id: string
  label: string
  /** Palavras extras que também encontram o comando. */
  keywords: string
  to: string
}

export const COMMANDS: Command[] = [
  { id: 'hoje', label: 'O que estudar agora (tela Hoje)', keywords: 'hoje proxima acao recomendacao agora', to: '/espaco' },
  { id: 'iniciar', label: 'Iniciar sessão de estudo', keywords: 'iniciar sessao cronometro estudar timer pomodoro', to: '/cronometro' },
  { id: 'manual', label: 'Registrar estudo manual', keywords: 'registrar estudo manual lancamento sessao passada', to: '/cronometro?manual=1' },
  { id: 'questoes', label: 'Fazer questões (registrar)', keywords: 'questoes registrar acertos erros exercicios', to: '/questoes?registrar=1' },
  { id: 'atrasados', label: 'Revisar atrasados', keywords: 'revisar revisoes atrasadas pendentes', to: '/revisoes' },
  { id: 'cartoes', label: 'Revisar flashcards vencidos', keywords: 'flashcards cartoes revisar vencidos srs', to: '/flashcards/revisar?modo=vencidos' },
  { id: 'tarefa', label: 'Nova tarefa', keywords: 'nova tarefa calendario prazo prova lembrete', to: '/calendario?novo=tarefa' },
  { id: 'flashcard', label: 'Novo flashcard', keywords: 'novo flashcard cartao criar', to: '/flashcards?novo=cartao' },
  { id: 'mapa', label: 'Novo mapa mental', keywords: 'novo mapa mental criar', to: '/mapas?novo=mapa' },
  { id: 'calendario', label: 'Abrir calendário', keywords: 'abrir calendario agenda semana', to: '/calendario' },
  { id: 'caderno', label: 'Abrir caderno de erros', keywords: 'caderno erros motivos', to: '/questoes/caderno' },
  { id: 'cronograma', label: 'Abrir cronograma', keywords: 'cronograma planejamento planejado realizado', to: '/cronograma' },
]

export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** Todas as palavras do termo precisam aparecer no rótulo ou nas palavras-chave. */
export function matchCommands(term: string, subjects: Array<{ id: string; name: string; status?: string }> = []): Command[] {
  const words = fold(term).split(/\s+/).filter(Boolean)
  const hit = (c: Command) => words.every((w) => fold(`${c.label} ${c.keywords}`).includes(w))
  const base = words.length ? COMMANDS.filter(hit) : COMMANDS
  // "Estudar <matéria>": comando dinâmico para cada matéria ativa que casa com o termo.
  const study: Command[] = []
  if (words.length) {
    const rest = words.filter((w) => !['estudar', 'iniciar', 'sessao'].includes(w))
    for (const s of subjects) {
      if (s.status && s.status !== 'active') continue
      const name = fold(s.name)
      if (rest.length && rest.every((w) => name.includes(w))) study.push({ id: `estudar:${s.id}`, label: `Estudar ${s.name}`, keywords: '', to: `/cronometro?materia=${s.id}` })
    }
  }
  return [...study.slice(0, 3), ...base]
}
