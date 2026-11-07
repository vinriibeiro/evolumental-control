import { describe, expect, it } from 'vitest'
import { YOUTUBE_MIME, driveEmbedUrl, driveOpenUrl, isDriveId, isTrustedDriveUrl, materialType } from '@/lib/drive'
import { TEO_SOURCE, buildYoutubeCourses, isYoutubeSource } from '@/lib/youtubeCourses'

describe('plano dos cursos do Téo Me Why (YouTube) para Cursos', () => {
  it('um curso por matéria da trilha, uma aula por vídeo, IDs e posições no formato do banco', () => {
    const plan = buildYoutubeCourses()
    expect(plan).toHaveLength(9)
    expect(plan.reduce((s, c) => s + c.lessons.length, 0)).toBe(135)
    for (const c of plan) {
      expect(isDriveId(c.driveId), c.driveId).toBe(true)
      expect(c.skipped, c.title).toEqual([])
      expect(c.lessons.length).toBeGreaterThan(0)
      for (const l of c.lessons) {
        expect(isDriveId(l.driveId)).toBe(true)
        expect(l.driveId).toHaveLength(11)
        expect(l.placementKey).toBe(`${c.driveId}/${l.driveId}`)
        expect(l.durationMs).toBeGreaterThan(0)
      }
    }
    const keys = plan.flatMap((c) => [c.placementKey, ...c.lessons.map((l) => l.placementKey)])
    expect(new Set(keys).size).toBe(keys.length)
    expect(plan[0]).toMatchObject({ driveId: 'youtube-course-teo_git', title: 'Téo 1 · Git e GitHub', subjectName: 'Téo 1 · Git e GitHub', sortOrder: 0 })
    expect(plan[0].lessons[0]).toMatchObject({ driveId: '84FhNXNWoig', title: 'Ep 01 - Instalação E Primeiros Conceitos', durationMs: 31 * 60_000, sortOrder: 0 })
    expect(isDriveId(TEO_SOURCE.folderId)).toBe(true)
    expect(isYoutubeSource({ drive_folder_id: TEO_SOURCE.folderId })).toBe(true)
    expect(isYoutubeSource({ drive_folder_id: '1MsIzL9Qv0bXU9mxmUSux7IsksEu_N19p' })).toBe(false)
  })

  it('ignora tópicos sem link do YouTube e vídeos repetidos; entra em grupos', () => {
    const plan = buildYoutubeCourses([
      {
        key: 'x',
        name: 'X',
        area: 'Tecnologia',
        color: '#000',
        icon: 'x',
        difficulty: 1,
        description: '',
        topics: [
          'Só texto',
          { name: 'A', url: 'https://youtu.be/abcdefghijk', minutes: 10 },
          { name: 'B', url: 'https://www.youtube.com/watch?v=abcdefghijk' },
          ['Grupo', [{ name: 'C', url: 'https://example.com/v' }, { name: 'D', url: 'https://www.youtube.com/watch?v=zyxwvutsrqp' }]],
        ],
      },
    ])
    expect(plan[0].lessons.map((l) => [l.driveId, l.title, l.durationMs])).toEqual([
      ['abcdefghijk', 'A', 600_000],
      ['zyxwvutsrqp', 'D', null],
    ])
    expect(plan[0].skipped).toEqual(['Só texto', 'B', 'C'])
  })
})

describe('vídeo do YouTube no catálogo de Cursos', () => {
  it('toca pelo player sem cookies, abre no YouTube e rejeita IDs inválidos', () => {
    expect(materialType(YOUTUBE_MIME)).toMatchObject({ kind: 'video', embeddable: true })
    const src = driveEmbedUrl('84FhNXNWoig', YOUTUBE_MIME)
    expect(src).toBe('https://www.youtube-nocookie.com/embed/84FhNXNWoig?rel=0')
    expect(isTrustedDriveUrl(src!)).toBe(true)
    expect(driveOpenUrl('84FhNXNWoig', YOUTUBE_MIME)).toBe('https://www.youtube.com/watch?v=84FhNXNWoig')
    expect(driveEmbedUrl('invalido', YOUTUBE_MIME)).toBeNull()
    expect(driveOpenUrl('1MsIzL9Qv0bXU9mxmUSux7IsksEu_N19p', YOUTUBE_MIME)).toBeNull()
    expect(isTrustedDriveUrl('https://www.youtube.com/embed/84FhNXNWoig')).toBe(false)
    // arquivos do Drive continuam como antes
    expect(driveEmbedUrl('1MsIzL9Qv0bXU9mxmUSux7IsksEu_N19p', 'video/mp4')).toBe('https://drive.google.com/file/d/1MsIzL9Qv0bXU9mxmUSux7IsksEu_N19p/preview')
  })
})
