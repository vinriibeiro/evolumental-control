import { describe, expect, it } from 'vitest'
import { nextInQueue, parseStart, parseYoutube, youtubeEmbedUrl } from '../video'

const ID = 'dQw4w9WgXcQ'

describe('parseYoutube', () => {
  it('reconhece os formatos comuns de link de vídeo', () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&feature=share`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}?si=abc`,
      `http://www.youtube.com/watch?v=${ID}`,
    ]) {
      expect(parseYoutube(url), url).toMatchObject({ videoId: ID, playlistId: null, start: 0 })
    }
  })

  it('lê o ponto de início e a lista de reprodução', () => {
    expect(parseYoutube(`https://youtu.be/${ID}?t=90`)?.start).toBe(90)
    expect(parseYoutube(`https://www.youtube.com/watch?v=${ID}&t=1m30s`)?.start).toBe(90)
    expect(parseYoutube(`https://www.youtube.com/watch?v=${ID}&list=PLabcdefghij123`)).toMatchObject({ videoId: ID, playlistId: 'PLabcdefghij123' })
    expect(parseYoutube('https://www.youtube.com/playlist?list=PLabcdefghij123')).toMatchObject({ videoId: null, playlistId: 'PLabcdefghij123' })
  })

  it('não reconhece o que não é vídeo do YouTube', () => {
    for (const url of [
      'https://cursos.teomewhy.org/trilhas',
      'https://www.youtube.com/results?search_query=python',
      'https://www.youtube.com/@canal',
      'https://www.youtube.com/watch?v=curto',
      'https://evil-youtube.com/watch?v=' + ID,
      'https://www.youtube.com.evil.com/watch?v=' + ID,
      'javascript:alert(1)',
      'não é um link',
      '',
    ]) {
      expect(parseYoutube(url), url).toBeNull()
    }
    expect(parseYoutube(null)).toBeNull()
  })
})

describe('parseStart', () => {
  it('converte formatos de tempo em segundos', () => {
    expect(parseStart('45')).toBe(45)
    expect(parseStart('45s')).toBe(45)
    expect(parseStart('2m')).toBe(120)
    expect(parseStart('1h2m3s')).toBe(3723)
    expect(parseStart('abc')).toBe(0)
    expect(parseStart(null)).toBe(0)
    expect(parseStart('')).toBe(0)
  })
})

describe('youtubeEmbedUrl', () => {
  it('usa o domínio sem cookies e preserva início e lista', () => {
    expect(youtubeEmbedUrl({ videoId: ID, playlistId: null, start: 0 })).toBe(`https://www.youtube-nocookie.com/embed/${ID}?rel=0`)
    expect(youtubeEmbedUrl({ videoId: ID, playlistId: null, start: 90 })).toBe(`https://www.youtube-nocookie.com/embed/${ID}?rel=0&start=90`)
    expect(youtubeEmbedUrl({ videoId: null, playlistId: 'PLabcdefghij123', start: 0 })).toBe('https://www.youtube-nocookie.com/embed/videoseries?rel=0&list=PLabcdefghij123')
  })
})

describe('youtubeEmbedUrl com início automático', () => {
  it('só liga o autoplay quando pedido', () => {
    expect(youtubeEmbedUrl({ videoId: ID, playlistId: null, start: 0 }, { autoplay: true })).toBe(`https://www.youtube-nocookie.com/embed/${ID}?rel=0&autoplay=1`)
  })
})

describe('nextInQueue', () => {
  const queue = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('devolve o próximo da fila, ou null no último e quando o atual não existe', () => {
    expect(nextInQueue(queue, 'a')).toEqual({ id: 'b' })
    expect(nextInQueue(queue, 'c')).toBeNull()
    expect(nextInQueue(queue, 'x')).toBeNull()
    expect(nextInQueue(queue, null)).toBeNull()
  })
})
