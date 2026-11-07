import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, ClipboardCheck, GraduationCap, Headphones, Layers, Route, type LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/layout'
import { CAREER_TRAILS, SUBJECT_LIBRARY } from '@/content/trails'
import { useCount } from '@/hooks/data'
import { eq } from '@/lib/data/types'

interface Topic {
  to: string
  label: string
  icon: LucideIcon
  description: string
  /** O que você faz aqui, em uma frase (ordem do fluxo). */
  step: string
}

/** Pastas da Biblioteca, na ordem do fluxo de estudo. */
export const LIBRARY_TOPICS: Topic[] = [
  { to: '/materias', label: 'Matérias e tópicos', icon: BookOpen, step: 'Comece aqui', description: 'O edital organizado em matérias e tópicos: é onde o estudo, as revisões e as metas se registram.' },
  { to: '/trilhas', label: 'Trilhas', icon: Route, step: 'Monte a base', description: 'Trilhas prontas que instalam matérias, tópicos e um ciclo de estudo de uma vez.' },
  { to: '/cursos', label: 'Cursos e materiais', icon: GraduationCap, step: 'Assista e leia', description: 'Aulas em vídeo e apostilas do Google Drive e do YouTube, com progresso por aula.' },
  { to: '/livros', label: 'Livros', icon: BookOpen, step: 'Aprofunde', description: 'PDFs e EPUBs no leitor próprio, com destaques, notas e marcadores.' },
  { to: '/audios', label: 'Áudios', icon: Headphones, step: 'Ouça', description: 'Áudios de estudo para repassar o conteúdo em qualquer lugar.' },
  { to: '/flashcards', label: 'Flashcards', icon: Layers, step: 'Fixe', description: 'Repetição espaçada do que precisa ficar na memória.' },
  { to: '/banco-de-questoes', label: 'Banco de questões', icon: ClipboardCheck, step: 'Pratique', description: 'Questões por tema e desafios de código, com registro de erros.' },
]

/** Biblioteca: uma pasta por tipo de material, cada uma em seu cartão, na ordem do fluxo. */
export default function LibraryHubPage() {
  const subjects = useCount('subjects', [])
  const courses = useCount('course_nodes', [eq('kind', 'course'), eq('status', 'available')])
  const decks = useCount('flashcard_decks', [])
  const counts: Record<string, string | null> = {
    '/materias': subjects.data != null ? `${subjects.data} matéria${subjects.data === 1 ? '' : 's'}` : null,
    '/trilhas': `${CAREER_TRAILS.length} trilhas · ${SUBJECT_LIBRARY.length} matérias prontas`,
    '/cursos': courses.data != null ? `${courses.data} curso${courses.data === 1 ? '' : 's'}` : null,
    '/flashcards': decks.data != null ? `${decks.data} baralho${decks.data === 1 ? '' : 's'}` : null,
  }

  return (
    <div>
      <PageHeader title="Biblioteca" description="Cada tipo de material em sua pasta. Siga a ordem: matérias → trilhas → cursos → livros e áudios → flashcards → questões." />
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Pastas da biblioteca">
        {LIBRARY_TOPICS.map((t, i) => (
          <li key={t.to} className="grid">
            <Link
              to={t.to}
              className="group flex min-h-36 flex-col rounded-2xl border border-line bg-surface/50 p-4 transition-colors hover:border-accent-strong/40 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-accent-strong">
                  <span className="flex size-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold tabular-nums">{i + 1}</span>
                  <t.icon className="size-[18px]" aria-hidden />
                </span>
                <ArrowRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
              <span className="mt-3 text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">{t.step}</span>
              <span className="mt-1 text-base font-semibold tracking-tight text-ink">{t.label}</span>
              <span className="mt-1 text-sm leading-relaxed text-muted">{t.description}</span>
              {counts[t.to] && <span className="mt-auto pt-3 text-xs font-medium text-ink tabular-nums">{counts[t.to]}</span>}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}
