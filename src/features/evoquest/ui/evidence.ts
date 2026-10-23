import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import { invalidateTables } from '@/hooks/data'
import type { PedagogicChallenge } from '../challenges'
import { STAGE_LABELS, type HelpLevel } from '../engine/pedagogy'

export interface EvidenceOutcome {
  ok: boolean
  /** Texto curto e transparente sobre o que foi registrado (ou por que não). */
  text: string
}

const HELP_TEXT: Record<HelpLevel, string> = {
  0: 'sem pistas',
  1: 'com 1 pista',
  2: 'com 2 pistas',
  3: 'com 3 pistas',
  4: 'depois da explicação completa',
}

/** Explica, sem jargão, o que a atividade acrescenta ao domínio do Control. */
export function evidenceText(ch: Pick<PedagogicChallenge, 'stage'>, help: HelpLevel, solved: boolean): string {
  const stage = ch.stage ? STAGE_LABELS[ch.stage].toLowerCase() : 'atividade'
  if (!solved) return `Registrado no Control: ${stage} não concluída — conta como ponto de atenção, não como acerto.`
  if (help === 4) return `Registrado no Control: ${stage} resolvida ${HELP_TEXT[help]} — conta como contato com o conceito, não como domínio.`
  return `Registrado no Control: ${stage} resolvida ${HELP_TEXT[help]}.`
}

/**
 * Grava a evidência de uma atividade pedagógica (só desafios com estágio).
 * O servidor confere a resposta e completa estágio/conceito pelo catálogo.
 */
export function useRecordEvidence() {
  const backend = useBackend()
  const qc = useQueryClient()
  return useCallback(
    async (ch: Pick<PedagogicChallenge, 'id' | 'stage' | 'seed'>, r: { help: HelpLevel; attempts: number; solved: boolean; answer: string | null }): Promise<EvidenceOutcome | null> => {
      if (!ch.stage) return null
      try {
        await backend.gameRecordEvidence({ id: crypto.randomUUID(), activity: ch.id, help: r.help, attempts: r.attempts, solved: r.solved, seed: ch.seed ?? null, answer: r.answer })
        await invalidateTables(qc, ['game_evidence'])
        return { ok: true, text: evidenceText(ch, r.help, r.solved) }
      } catch (e) {
        return { ok: false, text: `Evidência não registrada: ${e instanceof Error ? e.message : 'erro desconhecido'}.` }
      }
    },
    [backend, qc],
  )
}
