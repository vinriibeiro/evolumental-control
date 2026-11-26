import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { LocalBackend } from '@/lib/data/local'
import {
  addCourseToCycle,
  createManualDriveCourse,
  detectDataArea,
  parseDriveLink,
  scheduleCourseInCalendar,
} from '../courseIntegration'

let backend: LocalBackend
let seq = 0

beforeEach(() => {
  backend = new LocalBackend(`test-course-int-${++seq}-${Date.now()}`)
})

describe('integração Cursos do Google Drive ↔ Dados ↔ Ciclo ↔ Cronograma', () => {
  it('classifica automaticamente cursos nas áreas de Dados', () => {
    expect(detectDataArea('PostgreSQL Avançado e Modelagem').id).toBe('sql')
    expect(detectDataArea('Python com Pandas do Zero').id).toBe('python')
    expect(detectDataArea('Machine Learning e Scikit-learn').id).toBe('ml')
    expect(detectDataArea('Engenharia de Dados com Spark e Airflow').id).toBe('engenharia')
    expect(detectDataArea('Power BI e DAX na Prática').id).toBe('bi')
    expect(detectDataArea('Estatística para Ciência de Dados').id).toBe('estatistica')
    expect(detectDataArea('Git e Docker para Dados').id).toBe('ferramentas')
  })

  it('interpreta links de pasta e arquivo do Google Drive', () => {
    expect(parseDriveLink('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz12345')).toMatchObject({
      id: '1AbCdEfGhIjKlMnOpQrStUvWxYz12345',
      kind: 'folder',
    })
    expect(parseDriveLink('https://drive.google.com/file/d/1XyZ9876543210abcdef/view?usp=sharing')).toMatchObject({
      id: '1XyZ9876543210abcdef',
      kind: 'file',
    })
    expect(parseDriveLink('https://exemplo.com/nada')).toBeNull()
  })

  it('cadastra curso do Drive por link, cria matéria e inclui no ciclo ativo automaticamente', async () => {
    const res = await createManualDriveCourse(backend, {
      title: 'SQL para Análise de Dados',
      driveUrl: 'https://drive.google.com/drive/folders/1FolderSqlCourse123456',
      lessons: [
        { title: 'Aula 01 - SELECT', url: 'https://drive.google.com/file/d/1LessonSql01abcdef/view' },
        { title: 'Aula 02 - JOIN', url: 'https://drive.google.com/file/d/1LessonSql02abcdef/view' },
      ],
      addToCycle: true,
      cycleDurationMinutes: 50,
    })

    expect(res.lessonsCreated).toBe(2)
    expect(res.subject.name).toBe('SQL para Análise de Dados')
    expect(res.course.subject_id).toBe(res.subject.id)

    const cycles = (await backend.list('study_cycles')).rows
    expect(cycles).toHaveLength(1)
    expect(cycles[0].status).toBe('active')
    const items = (await backend.list('study_cycle_items')).rows
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ subject_id: res.subject.id, duration_minutes: 50, activity_type: 'video' })
  })

  it('adiciona curso existente ao ciclo e agenda no cronograma reaproveitando a mesma matéria', async () => {
    const created = await createManualDriveCourse(backend, {
      title: 'Apache Airflow na Prática',
      driveUrl: 'https://drive.google.com/drive/folders/1AirflowFolder123456',
      addToCycle: false,
    })

    const cyc = await addCourseToCycle(backend, created.course, { durationMinutes: 75, weight: 2 })
    expect(cyc.subject.id).toBe(created.subject.id)
    expect(cyc.item.duration_minutes).toBe(75)
    expect(cyc.item.weight).toBe(2)

    const sched = await scheduleCourseInCalendar(backend, created.course, {
      date: '2026-11-26',
      startTime: '19:30',
      durationMinutes: 60,
    })
    expect(sched.subject.id).toBe(created.subject.id)
    expect(sched.task).toMatchObject({
      date: '2026-11-26',
      start_time: '19:30',
      duration_minutes: 60,
      subject_id: created.subject.id,
      category: 'estudos',
    })
    expect((await backend.list('subjects')).rows).toHaveLength(1)
  })
})
