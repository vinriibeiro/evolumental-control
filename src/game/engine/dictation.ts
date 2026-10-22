// Correção de ditado: compara palavra a palavra, sem punir pontuação, caixa
// nem contrações equivalentes ("I'm" = "I am").

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "that's": 'that is',
  "there's": 'there is',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "we'll": 'we will',
  "they'll": 'they will',
  "he'll": 'he will',
  "she'll": 'she will',
  "it'll": 'it will',
  "i'd": 'i would',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "won't": 'will not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "shouldn't": 'should not',
  "wouldn't": 'would not',
  "let's": 'let us',
}

/** Palavras normalizadas de uma frase. */
export function dictationWords(s: string): string[] {
  const words = s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
  return words.flatMap((w) => (CONTRACTIONS[w] ?? w).split(' ')).map((w) => (w === 'can not' ? 'cannot' : w))
}

export type DiffToken = { word: string; status: 'ok' | 'missing' | 'extra' }

/** Diferença por maior subsequência comum: o que acertou, o que faltou e o que sobrou. */
export function diffWords(expected: string, typed: string): { tokens: DiffToken[]; matched: number; total: number } {
  const a = dictationWords(expected)
  const b = dictationWords(typed)
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const tokens: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      tokens.push({ word: a[i], status: 'ok' })
      i++
      j++
    } else if (j < b.length && (i >= a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      tokens.push({ word: b[j], status: 'extra' })
      j++
    } else {
      tokens.push({ word: a[i], status: 'missing' })
      i++
    }
  }
  return { tokens, matched: dp[0][0], total: a.length }
}

/** Nota 0..1: penaliza tanto palavras faltando quanto sobrando. */
export function dictationScore(expected: string, typed: string): number {
  const { matched, total } = diffWords(expected, typed)
  const extra = dictationWords(typed).length - matched
  return total === 0 ? 0 : Math.max(0, (matched - extra * 0.5) / total)
}

export function dictationMatches(accept: string[], typed: string): boolean {
  const t = dictationWords(typed).join(' ')
  return t.length > 0 && accept.some((a) => dictationWords(a).join(' ') === t)
}
