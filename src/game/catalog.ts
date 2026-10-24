// Catálogo de disciplinas do EvoQuest. Para adicionar uma disciplina:
// 1) crie src/game/content/<id>.ts exportando um SubjectContent;
// 2) registre os metadados abaixo;
// 3) rode `npm run game:catalog` para atualizar o catálogo do servidor.
// Nenhuma outra parte do jogo precisa mudar.
import type { Challenge, SubjectContent, SubjectMeta, Unit } from './types'

export const SUBJECTS: SubjectMeta[] = [
  {
    id: 'ingles', name: 'Inglês', short: 'EN', icon: '🗣️', color: 'var(--series-1)', level: 'Do zero → C2',
    description: 'Gramática, vocabulário e escuta com áudio do navegador, do básico ao intermediário.',
    capabilities: ['speech'], matchNames: ['inglês', 'ingles', 'english', 'língua inglesa'],
    load: () => import('./content/ingles').then((m) => m.default),
  },
  {
    id: 'portugues', name: 'Português', short: 'PT', icon: '📝', color: 'var(--series-2)', level: 'Básico → concursos',
    description: 'Acentuação, concordância, regência, crase, pontuação e interpretação no estilo das bancas.',
    capabilities: [], matchNames: ['português', 'portugues', 'língua portuguesa', 'gramática'],
    load: () => import('./content/portugues').then((m) => m.default),
  },
  {
    id: 'logica', name: 'Raciocínio Lógico', short: 'RL', icon: '🧩', color: 'var(--series-3)', level: 'Básico → avançado',
    description: 'Proposições, equivalências, argumentos, diagramas, contagem e probabilidade.',
    capabilities: [], matchNames: ['raciocínio lógico', 'raciocinio logico', 'lógica', 'rlm'],
    load: () => import('./content/logica').then((m) => m.default),
  },
  {
    id: 'estatistica', name: 'Estatística', short: 'ES', icon: '📊', color: 'var(--series-4)', level: 'Descritiva → inferência',
    description: 'Média, mediana, dispersão, distribuição normal, amostragem e correlação.',
    capabilities: [], matchNames: ['estatística', 'estatistica', 'probabilidade e estatística'],
    load: () => import('./content/estatistica').then((m) => m.default),
  },
  {
    id: 'dax', name: 'DAX', short: 'DX', icon: '📈', color: 'var(--series-5)', level: 'Medidas → inteligência de tempo',
    description: 'Medidas, contexto de filtro, CALCULATE e inteligência de tempo com casos validados.',
    capabilities: [], matchNames: ['dax', 'power bi', 'powerbi'],
    load: () => import('./content/dax').then((m) => m.default),
  },
  {
    id: 'm', name: 'Linguagem M', short: 'M', icon: '🔧', color: 'var(--series-6)', level: 'Power Query',
    description: 'Etapas, tipos, limpeza, colunas personalizadas, mesclagem e remodelagem.',
    capabilities: [], matchNames: ['linguagem m', 'power query', 'power bi', 'powerbi'],
    load: () => import('./content/m').then((m) => m.default),
  },
  {
    id: 'sql', name: 'SQL', short: 'SQL', icon: '🗄️', color: 'var(--series-7)', level: 'Consultas → junções',
    description: 'SELECT, filtros, agregações e JOINs com laboratório real em SQLite no navegador.',
    capabilities: ['sql'], matchNames: ['sql', 'banco de dados', 'bancos de dados'],
    load: () => import('./content/sql').then((m) => m.default),
  },
  {
    id: 'python', name: 'Python para Dados', short: 'PY', icon: '🐍', color: 'var(--series-8)', level: 'Fundamentos → pandas',
    description: 'Fundamentos, pandas, filtros, agrupamentos e limpeza com laboratório executável.',
    capabilities: ['python'], matchNames: ['python', 'pandas', 'análise de dados'],
    load: () => import('./content/python').then((m) => m.default),
  },
]

export const subjectMeta = (id: string) => SUBJECTS.find((s) => s.id === id)

const cache = new Map<string, Promise<SubjectContent>>()
export function loadSubject(id: string): Promise<SubjectContent> {
  const meta = subjectMeta(id)
  if (!meta) return Promise.reject(new Error(`Disciplina desconhecida: ${id}`))
  let p = cache.get(id)
  if (!p) {
    p = meta.load()
    p.catch(() => cache.delete(id))
    cache.set(id, p)
  }
  return p
}

export const allChallenges = (c: SubjectContent): Challenge[] => c.units.flatMap((u) => u.challenges)

export function findChallenge(c: SubjectContent, id: string): { unit: Unit; challenge: Challenge } | null {
  for (const unit of c.units) {
    const challenge = unit.challenges.find((x) => x.id === id)
    if (challenge) return { unit, challenge }
  }
  return null
}

/** Disciplina dona de um id de desafio (`<disciplina>.<unidade>.<código>`). */
export const subjectOf = (challengeId: string) => challengeId.split('.')[0]
