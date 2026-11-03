export interface FocusActionInput {
  sessionStatus?: 'active' | 'pending_review' | null
  paused?: boolean
  reviewsDue: number
  cardsDue: number
  todayBlock?: { id: string; subject: string; minutes: number } | null
  hasSubjects: boolean
}

export interface FocusAction {
  kind: 'session' | 'review' | 'block' | 'cards' | 'setup' | 'study'
  eyebrow: string
  title: string
  description: string
  label: string
  to: string
}

/** Uma sugestão explicável; abrir o cronômetro nunca inicia uma segunda sessão. */
export function nextAction(input: FocusActionInput): FocusAction {
  if (input.sessionStatus === 'pending_review') return {
    kind: 'session', eyebrow: 'Falta só registrar', title: 'Seu esforço merece ficar na história.',
    description: 'Você tem uma sessão finalizada. Confira o resumo e salve seu tempo de estudo.',
    label: 'Confirmar sessão', to: '/cronometro',
  }
  if (input.sessionStatus === 'active') return {
    kind: 'session', eyebrow: input.paused ? 'Uma pausa, depois o próximo passo' : 'Seu foco está em andamento',
    title: input.paused ? 'Tudo pronto para continuar.' : 'Continue de onde você está.',
    description: input.paused ? 'Sua sessão está pausada. Volte ao cronômetro quando estiver pronto.' : 'Sua sessão continua ativa. Acompanhe o tempo e conclua no seu ritmo.',
    label: input.paused ? 'Voltar à sessão' : 'Acompanhar sessão', to: '/cronometro',
  }
  if (input.reviewsDue > 0) return {
    kind: 'review', eyebrow: 'Fortaleça o que você aprendeu', title: 'Um pouco de revisão. Muito mais retenção.',
    description: `Você tem ${input.reviewsDue} ${input.reviewsDue === 1 ? 'revisão para colocar em dia' : 'revisões para colocar em dia'}. Revise antes de seguir para um novo conteúdo.`,
    label: 'Revisar agora', to: '/revisoes',
  }
  if (input.todayBlock) return {
    kind: 'block', eyebrow: 'No seu planejamento de hoje', title: input.todayBlock.subject,
    description: `Um bloco de ${input.todayBlock.minutes} minutos espera por você. Abra o cronômetro e prepare sua próxima sessão.`,
    label: 'Preparar este estudo', to: `/cronometro?bloco=${encodeURIComponent(input.todayBlock.id)}`,
  }
  if (input.cardsDue > 0) return {
    kind: 'cards', eyebrow: 'Mantenha o conhecimento vivo', title: 'Relembre hoje. Leve para amanhã.',
    description: `${input.cardsDue} ${input.cardsDue === 1 ? 'flashcard está pronto' : 'flashcards estão prontos'} para sua próxima rodada de revisão.`,
    label: 'Revisar flashcards', to: '/flashcards/revisar?modo=vencidos',
  }
  if (!input.hasSubjects) return {
    kind: 'setup', eyebrow: 'Seu ponto de partida', title: 'Grandes conquistas começam com um plano.',
    description: 'Escolha uma trilha de estudos ou organize suas matérias. Depois, transforme intenção em um pouco de progresso todos os dias.',
    label: 'Explorar trilhas', to: '/trilhas',
  }
  return {
    kind: 'study', eyebrow: 'Um passo de cada vez', title: 'Abra espaço para o seu próximo avanço.',
    description: 'Escolha uma matéria, encontre seu ritmo e dedique alguns minutos ao que você quer aprender.',
    label: 'Iniciar estudo', to: '/cronometro',
  }
}
