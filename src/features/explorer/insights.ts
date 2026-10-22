// Indicadores derivados de um tópico. Puro e testável.

/**
 * Domínio estimado (0–100). Combina a autoavaliação (0–5) com o desempenho
 * real em questões, que pesa mais conforme há mais questões respondidas
 * (até metade do peso com 20 ou mais). Sem questões, vale a autoavaliação.
 */
export function estimateMastery(selfRated: number, questions: { total: number; correct: number }): number {
  const self = Math.max(0, Math.min(5, selfRated)) / 5
  if (questions.total <= 0) return Math.round(self * 100)
  const accuracy = Math.max(0, Math.min(1, questions.correct / questions.total))
  const w = Math.min(0.5, questions.total / 40)
  return Math.round(((1 - w) * self + w * accuracy) * 100)
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const GAME_SUBJECTS: Array<{ id: string; test: RegExp }> = [
  { id: 'sql', test: /\b(sql|join|select|banco de dados|bancos de dados|consulta)/ },
  { id: 'python', test: /\b(python|pandas|numpy)/ },
  { id: 'dax', test: /\b(dax|power bi|medida|calculate)\b/ },
  { id: 'm', test: /\b(power query|linguagem m)\b/ },
  { id: 'estatistica', test: /\b(estatistic|probabilidade|media|mediana|desvio padrao|variancia)/ },
  { id: 'logica', test: /\b(raciocinio logico|logica|proposic|silogism|tabela verdade)/ },
  { id: 'ingles', test: /\b(ingles|english|lingua inglesa)/ },
  { id: 'portugues', test: /\b(portugues|lingua portuguesa|crase|concordancia|regencia|pontuacao|interpretacao de texto)/ },
]

/** Disciplina do EvoQuest relacionada ao conteúdo (pelo nome do tópico e da matéria). */
export function relatedGameSubject(...names: Array<string | null | undefined>): string | null {
  for (const raw of names) {
    if (!raw) continue
    const name = fold(raw)
    const hit = GAME_SUBJECTS.find((g) => g.test.test(name))
    if (hit) return hit.id
  }
  return null
}
