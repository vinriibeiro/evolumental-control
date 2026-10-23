import type { PedagogicChallenge } from '../challenges'
import { PyTerminal } from './PyTerminal'
import { Terminal } from './Terminal'

interface Props {
  challenge: PedagogicChallenge
  sound: boolean
  /** Chamado com a resposta canônica quando o resultado confere. */
  onSolved: (answer: string) => Promise<boolean> | boolean
  onClose: () => void
}

/** Abre o terminal da disciplina do desafio (SQL ou Python). */
export function ChallengeTerminal({ challenge, ...rest }: Props) {
  return challenge.kind === 'python' ? <PyTerminal challenge={challenge} {...rest} /> : <Terminal challenge={challenge} {...rest} />
}
