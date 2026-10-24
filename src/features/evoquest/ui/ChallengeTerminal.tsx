import type { PedagogicChallenge } from '../challenges'
import { EnTerminal } from './EnTerminal'
import { PyTerminal } from './PyTerminal'
import { Terminal } from './Terminal'

interface Props {
  challenge: PedagogicChallenge
  sound: boolean
  /** Chamado com a resposta canônica quando o resultado confere. */
  onSolved: (answer: string) => Promise<boolean> | boolean
  onClose: () => void
}

/** Abre o adaptador da disciplina do desafio: terminal SQL, terminal Python ou rádio (inglês). */
export function ChallengeTerminal({ challenge, ...rest }: Props) {
  if (challenge.kind === 'python') return <PyTerminal challenge={challenge} {...rest} />
  if (challenge.kind === 'english') return <EnTerminal challenge={challenge} {...rest} />
  return <Terminal challenge={challenge} {...rest} />
}
