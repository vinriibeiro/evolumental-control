import { describe, expect, it } from 'vitest'
import { advance, clampRepeats, formatClock, isAudioFile, progressLabel, skipNext, skipPrevious, totalListeningSeconds, trackNameFromFile, type PlayState } from '../audioPlayer'

const st = (over: Partial<PlayState> = {}): PlayState => ({ index: 0, lap: 1, mode: 'licao', repeats: 5, total: 3, ...over })

describe('repetição da lição inteira (ciclo de 5 vezes)', () => {
  it('passa de faixa em faixa e volta ao começo até completar as voltas', () => {
    let s = st()
    const visited: string[] = []
    for (let i = 0; i < 100; i++) {
      visited.push(`${s.lap}.${s.index}`)
      const step = advance(s)
      if (step.done) break
      s = { ...s, index: step.index, lap: step.lap }
    }
    expect(visited).toHaveLength(15) // 5 voltas x 3 faixas
    expect(visited.slice(0, 4)).toEqual(['1.0', '1.1', '1.2', '2.0'])
    expect(visited.at(-1)).toBe('5.2')
  })

  it('termina depois da última faixa da última volta', () => {
    expect(advance(st({ index: 2, lap: 5 })).done).toBe(true)
    expect(advance(st({ index: 2, lap: 4 }))).toEqual({ index: 0, lap: 5, done: false })
  })

  it('uma única repetição toca a lição uma vez', () => {
    expect(advance(st({ repeats: 1, index: 1 }))).toEqual({ index: 2, lap: 1, done: false })
    expect(advance(st({ repeats: 1, index: 2 })).done).toBe(true)
  })
})

describe('repetição de cada faixa', () => {
  it('repete a faixa N vezes antes de seguir', () => {
    expect(advance(st({ mode: 'faixa', lap: 1 }))).toEqual({ index: 0, lap: 2, done: false })
    expect(advance(st({ mode: 'faixa', lap: 5 }))).toEqual({ index: 1, lap: 1, done: false })
    expect(advance(st({ mode: 'faixa', index: 2, lap: 4 }))).toEqual({ index: 2, lap: 5, done: false })
    expect(advance(st({ mode: 'faixa', index: 2, lap: 5 })).done).toBe(true)
  })
})

describe('casos de borda', () => {
  it('sem faixas, termina na hora', () => {
    expect(advance(st({ total: 0 })).done).toBe(true)
  })

  it('pular não passa dos limites e reinicia a repetição no modo "faixa"', () => {
    expect(skipNext(st({ index: 2 })).index).toBe(2)
    expect(skipPrevious(st({ index: 0 })).index).toBe(0)
    expect(skipNext(st({ index: 0, lap: 3 }))).toEqual({ index: 1, lap: 3, done: false })
    expect(skipNext(st({ mode: 'faixa', index: 0, lap: 3 }))).toEqual({ index: 1, lap: 1, done: false })
  })

  it('limita o número de repetições', () => {
    expect(clampRepeats(0)).toBe(1)
    expect(clampRepeats(99)).toBe(20)
    expect(clampRepeats(4.6)).toBe(5)
    expect(clampRepeats(Number.NaN)).toBe(5)
  })
})

describe('textos', () => {
  it('mostra a volta e a faixa atuais', () => {
    expect(progressLabel(st({ index: 2, lap: 2 }))).toBe('Volta 2 de 5 · faixa 3 de 3')
    expect(progressLabel(st({ mode: 'faixa', lap: 3 }))).toBe('Repetição 3 de 5 · faixa 1 de 3')
  })

  it('calcula o tempo para ouvir N vezes, ignorando faixas sem duração', () => {
    expect(totalListeningSeconds([78, 37, 96, undefined, 49, 57], 5)).toBe(317 * 5)
    expect(formatClock(1585)).toBe('26:25')
    expect(formatClock(3725)).toBe('1:02:05')
    expect(formatClock(-3)).toBe('0:00')
  })

  it('gera nomes amigáveis a partir do nome do arquivo', () => {
    expect(trackNameFromFile('L01_T01_pag07.mp3')).toBe('Track 1 · pág. 7')
    expect(trackNameFromFile('L03_T12_pag110.mp3')).toBe('Track 12 · pág. 110')
    expect(trackNameFromFile('B02_L07_T013.mp3')).toBe('Track 13')
    expect(trackNameFromFile('minha_gravacao  final.mp3')).toBe('minha gravacao final')
  })

  it('reconhece arquivos de áudio', () => {
    expect(isAudioFile('a.MP3')).toBe(true)
    expect(isAudioFile('semext', 'audio/mpeg')).toBe(true)
    expect(isAudioFile('livro.epub', 'application/epub+zip')).toBe(false)
  })
})
