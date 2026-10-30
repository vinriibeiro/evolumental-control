// Catálogo de modelos de rotina (editáveis) para o motor de src/lib/routine.ts.
// Os pilares ainda não têm matérias do usuário (subjectIds vazio): o assistente
// liga cada pilar às matérias criadas a partir de `trailId` / `subjectKeys`.
import type { RoutinePillar } from '@/lib/routine'

export interface RoutineTemplatePillar extends RoutinePillar {
  description: string
  /** Chaves de SUBJECT_LIBRARY (src/content/trails.ts) sugeridas para o pilar. */
  subjectKeys: string[]
  /** Checklist de tarefas sugeridas (ex.: LinkedIn semanal). */
  tasks?: string[]
}

/** Marco de exemplo: a data fica a cargo do usuário. */
export interface RoutineTemplateMilestone {
  title: string
  pillarId: string
  date: null
}

export interface RoutineTemplate {
  id: string
  name: string
  description: string
  /** Modo sugerido: automático (gera a partir do modelo) ou manual. */
  mode: 'auto' | 'manual'
  pillars: RoutineTemplatePillar[]
  milestones: RoutineTemplateMilestone[]
}

export const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    id: 'transicao_analista_cientista',
    name: 'Transição: Analista → Cientista de Dados',
    description:
      'Estudo de ciência de dados como prioridade, sem deixar a análise de dados enferrujar, com projetos práticos, LinkedIn, certificações e inglês todos os dias.',
    mode: 'auto',
    pillars: [
      {
        id: 'ciencia_dados',
        name: 'Estudo de Ciência de Dados',
        description: 'Estatística, matemática para ML, Python e machine learning.',
        weight: 5,
        frequency: 'days_per_week',
        daysPerWeek: 4,
        blockMinutes: 50,
        activityType: 'theory',
        subjectIds: [],
        trailId: 'cientista_dados',
        subjectKeys: ['estatistica_dados', 'matematica_ml', 'python', 'machine_learning'],
      },
      {
        id: 'analise_dados',
        name: 'Manter-se pronto em Análise de Dados',
        description: 'Prática semanal de SQL, Power BI, Excel e storytelling — nunca zerar.',
        weight: 3,
        frequency: 'weekly',
        blockMinutes: 60,
        activityType: 'questions',
        subjectIds: [],
        trailId: 'analista_dados',
        subjectKeys: ['sql', 'power_bi', 'excel', 'storytelling'],
      },
      {
        id: 'problemas_ds',
        name: 'Resolver problemas de Ciência de Dados',
        description: 'Projetos práticos e desafios, uma sessão por semana.',
        weight: 3,
        frequency: 'weekly',
        blockMinutes: 90,
        activityType: 'questions',
        subjectIds: [],
        trailId: 'cientista_dados',
        subjectKeys: ['machine_learning', 'python'],
      },
      {
        id: 'linkedin',
        name: 'LinkedIn e carreira',
        description: 'Tarefas semanais de posicionamento para ciência de dados.',
        weight: 1,
        frequency: 'weekly',
        blockMinutes: 30,
        activityType: 'other',
        subjectIds: [],
        trailId: null,
        subjectKeys: [],
        tasks: [
          'Revisar título e "Sobre" com foco em ciência de dados',
          'Destacar um projeto no perfil (Destaques/Projetos)',
          'Publicar um aprendizado da semana',
          'Conectar-se com pessoas da área de dados',
        ],
      },
      {
        id: 'certificacoes',
        name: 'Certificações',
        description: 'Preparação para provas; as datas dos marcos são definidas por você.',
        weight: 2,
        frequency: 'days_per_week',
        daysPerWeek: 1,
        blockMinutes: 50,
        activityType: 'review',
        subjectIds: [],
        trailId: null,
        subjectKeys: [],
      },
      {
        id: 'ingles',
        name: 'Inglês — prática diária',
        description: 'Bloco curto todos os dias, sem material (aba Inglês).',
        weight: 2,
        frequency: 'daily',
        blockMinutes: 20,
        activityType: 'other',
        subjectIds: [],
        trailId: null,
        subjectKeys: [],
      },
    ],
    milestones: [
      { title: 'Exemplo: certificação em ciência de dados ou machine learning', pillarId: 'certificacoes', date: null },
      { title: 'Exemplo: certificação em nuvem para dados', pillarId: 'certificacoes', date: null },
    ],
  },
  {
    id: 'em_branco',
    name: 'Rotina em branco',
    description: 'Comece do zero e monte seus próprios pilares no modo manual.',
    mode: 'manual',
    pillars: [],
    milestones: [],
  },
]

export function routineTemplateById(id: string): RoutineTemplate | undefined {
  return ROUTINE_TEMPLATES.find((t) => t.id === id)
}

/** Cópia profunda para edição, sem alterar o catálogo. */
export function cloneRoutineTemplate(template: RoutineTemplate): RoutineTemplate {
  return {
    ...template,
    pillars: template.pillars.map((p) => ({ ...p, subjectIds: [...p.subjectIds], subjectKeys: [...p.subjectKeys], tasks: p.tasks ? [...p.tasks] : undefined })),
    milestones: template.milestones.map((m) => ({ ...m })),
  }
}
