import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { AudioLibrary, audioErrorMessage, type AudioCloud } from '../audio'
import { FakeAudioCloud } from '@/test/fakeAudioCloud'

const TOPIC = 'topico-lesson-01'
const OUTRO = 'topico-lesson-02'

const created: AudioLibrary[] = []
let n = 0
const probe = async () => 12.5
function shelf(cloud: AudioCloud | null = null, max?: number): AudioLibrary {
  const l = new AudioLibrary(`teste-audio-${++n}`, cloud, probe, max)
  created.push(l)
  return l
}
let seed = 0
/** Um "mp3" de teste: conteúdo único por chamada (o id vem do conteúdo). */
const mp3 = (name: string, tamanho = 64) => new File([new Uint8Array(tamanho).fill(++seed % 250)], name, { type: 'audio/mpeg' })

afterEach(async () => {
  await Promise.all(created.splice(0).map((l) => l.destroy()))
})

describe('áudios locais (sem nuvem)', () => {
  it('adiciona faixas ao tópico, com nome amigável, duração e ordem', async () => {
    const lib = shelf()
    const r1 = await lib.add(TOPIC, mp3('L01_T01_pag07.mp3'))
    const r2 = await lib.add(TOPIC, mp3('L01_T02_pag09.mp3'))
    expect(r1).toMatchObject({ status: 'added', upload: 'off' })
    expect(r2.track.order).toBe(1)
    const tracks = await lib.list(TOPIC)
    expect(tracks.map((t) => t.name)).toEqual(['Track 1 · pág. 7', 'Track 2 · pág. 9'])
    expect(tracks[0]).toMatchObject({ duration: 12.5, fileLocal: true, cloud: 'off', topicId: TOPIC })
    expect((await lib.open(tracks[0].id)).data.byteLength).toBe(64)
  })

  it('mantém cada tópico com as suas faixas', async () => {
    const lib = shelf()
    await lib.add(TOPIC, mp3('a.mp3'))
    await lib.add(OUTRO, mp3('b.mp3'))
    expect(await lib.list(TOPIC)).toHaveLength(1)
    expect(await lib.list(OUTRO)).toHaveLength(1)
  })

  it('não duplica o mesmo conteúdo e recusa o que não é áudio', async () => {
    const lib = shelf()
    const bytes = new Uint8Array(40).fill(7)
    expect((await lib.add(TOPIC, new File([bytes], 'x.mp3', { type: 'audio/mpeg' }))).status).toBe('added')
    expect((await lib.add(TOPIC, new File([bytes], 'copia.mp3', { type: 'audio/mpeg' }))).status).toBe('duplicate')
    await expect(lib.add(TOPIC, new File(['pdf'], 'livro.pdf', { type: 'application/pdf' }))).rejects.toThrow(/não parece ser um arquivo de áudio/)
    expect(await lib.list(TOPIC)).toHaveLength(1)
  })

  it('segue funcionando se a duração não puder ser lida', async () => {
    const lib = new AudioLibrary(`teste-audio-${++n}`, null, async () => {
      throw new Error('sem decodificador')
    })
    created.push(lib)
    const { track } = await lib.add(TOPIC, mp3('a.mp3'))
    expect(track.duration).toBeUndefined()
  })

  it('remove a faixa e o arquivo', async () => {
    const lib = shelf()
    const { track } = await lib.add(TOPIC, mp3('a.mp3'))
    await lib.remove(track.id)
    expect(await lib.list(TOPIC)).toEqual([])
    await expect(lib.open(track.id)).rejects.toThrow(/não está guardado neste aparelho/)
  })
})

describe('áudios com nuvem privada', () => {
  it('envia o arquivo e os metadados ao adicionar', async () => {
    const cloud = new FakeAudioCloud()
    const lib = shelf(cloud)
    const r = await lib.add(TOPIC, mp3('L01_T01_pag07.mp3'))
    expect(r).toMatchObject({ status: 'added', upload: 'synced' })
    expect(cloud.files.has(r.track.id)).toBe(true)
    expect(cloud.tracks.get(r.track.id)).toMatchObject({ topicId: TOPIC, name: 'Track 1 · pág. 7', duration: 12.5 })
  })

  it('outro aparelho vê as faixas do tópico, baixa ao tocar e depois toca do cache', async () => {
    const cloud = new FakeAudioCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { track } = await a.add(TOPIC, mp3('L01_T01_pag07.mp3', 100))
    await a.add(OUTRO, mp3('L02_T06_pag20.mp3'))

    const summary = await b.sync(TOPIC)
    expect(summary.fromCloud).toBe(1) // só as do tópico pedido
    expect(await b.get(track.id)).toMatchObject({ fileLocal: false, cloud: 'synced' })
    expect(await b.list(OUTRO)).toEqual([])

    expect((await b.open(track.id)).data.byteLength).toBe(100)
    expect((await b.get(track.id))?.fileLocal).toBe(true)
    cloud.calls.length = 0
    await b.open(track.id)
    expect(cloud.calls).not.toContain('downloadFile')
  })

  it('sincroniza todos os tópicos de uma vez (tela de áudios) e lista tudo', async () => {
    const cloud = new FakeAudioCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const r1 = await a.add(TOPIC, mp3('L01_T01_pag07.mp3'))
    const r2 = await a.add(OUTRO, mp3('L02_T06_pag20.mp3'))

    const summary = await b.sync()
    expect(summary.fromCloud).toBe(2)
    expect((await b.listAll()).map((t) => t.id).sort()).toEqual([r1.track.id, r2.track.id].sort())

    await a.remove(r1.track.id)
    expect((await b.sync()).removed).toBe(1)
    expect((await b.listAll()).map((t) => t.topicId)).toEqual([OUTRO])
  })

  it('remover apaga da nuvem e some dos outros aparelhos', async () => {
    const cloud = new FakeAudioCloud()
    const a = shelf(cloud)
    const b = shelf(cloud)
    const { track } = await a.add(TOPIC, mp3('a.mp3'))
    await b.sync(TOPIC)
    await a.remove(track.id)
    expect(cloud.tracks.size).toBe(0)
    expect(cloud.files.size).toBe(0)
    expect((await b.sync(TOPIC)).removed).toBe(1)
    expect(await b.list(TOPIC)).toEqual([])
  })

  it('se a nuvem falhar ao remover, nada é apagado localmente', async () => {
    const cloud = new FakeAudioCloud()
    const a = shelf(cloud)
    const { track } = await a.add(TOPIC, mp3('a.mp3'))
    cloud.offline = true
    await expect(a.remove(track.id)).rejects.toThrow()
    expect(await a.get(track.id)).toBeDefined()
  })

  it('arquivo acima do limite fica só no aparelho', async () => {
    const cloud = new FakeAudioCloud()
    const a = shelf(cloud, 50)
    const r = await a.add(TOPIC, mp3('grande.mp3', 200))
    expect(r.upload).toBe('too-large')
    expect(cloud.files.size).toBe(0)
    await a.sync(TOPIC)
    expect(await a.get(r.track.id)).toBeDefined()
  })

  it('envio que falha fica pendente e a próxima sincronização reenvia', async () => {
    const cloud = new FakeAudioCloud()
    const a = shelf(cloud)
    cloud.failUploads = true
    const r = await a.add(TOPIC, mp3('a.mp3'))
    expect(r.upload).toBe('failed')
    expect((await a.get(r.track.id))?.cloud).toBe('pending')
    cloud.failUploads = false
    expect((await a.sync(TOPIC)).uploaded).toBe(1)
    expect((await a.get(r.track.id))?.cloud).toBe('synced')
  })

  it('sem internet a sincronização falha, mas as faixas locais continuam disponíveis', async () => {
    const cloud = new FakeAudioCloud()
    const a = shelf(cloud)
    const { track } = await a.add(TOPIC, mp3('a.mp3'))
    cloud.offline = true
    await expect(a.sync(TOPIC)).rejects.toThrow()
    expect(await a.list(TOPIC)).toHaveLength(1)
    expect((await a.open(track.id)).data.byteLength).toBeGreaterThan(0)
  })

  it('explica quando a migração dos áudios ainda não foi aplicada', () => {
    expect(audioErrorMessage({ code: 'PGRST205', message: "Could not find the table 'public.topic_audios' in the schema cache" })).toMatch(/20261031010000_audios\.sql/)
    expect(audioErrorMessage({ message: 'Bucket not found', statusCode: '404' })).toMatch(/audios/)
    expect(audioErrorMessage(new Error('Failed to fetch'))).toBe('Sem conexão com o servidor.')
  })
})
