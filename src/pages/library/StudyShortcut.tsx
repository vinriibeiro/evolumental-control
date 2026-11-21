import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ROOM_PATH, useStartStudy } from '@/features/timer/useStartStudy'
import { cn } from '@/lib/cn'
import type { SessionSource } from '@/types/db'

interface Props {
  /** O livro como origem da sessão: o cronômetro passa a saber o que está sendo estudado. */
  source: SessionSource
  /** Já houve leitura antes: o botão convida a continuar em vez de iniciar. */
  resumed?: boolean
  className?: string
}

/**
 * Atalho do leitor para o cronômetro do app. Nunca cria uma segunda sessão: se a sessão em andamento
 * é deste livro, mostra o estado e leva à Sala de Estudos; se é de outro conteúdo, o próprio
 * useStartStudy avisa e oferece abrir a sessão atual.
 */
export function StudyShortcut({ source, resumed, className }: Props) {
  const study = useStartStudy()

  if (study.isLiveFor({ source })) {
    return (
      <Link
        to={ROOM_PATH}
        className={cn('inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-line bg-bg px-3 text-sm font-medium whitespace-nowrap text-ink transition-colors hover:bg-surface-2', className)}
        aria-label="Sessão em andamento. Abrir a Sala de Estudos"
      >
        <span className="size-2 rounded-full bg-accent" aria-hidden />
        Sessão em andamento
      </Link>
    )
  }
  return (
    <Button
      size="sm"
      variant="primary"
      className={className}
      icon={<Play className="size-3.5" aria-hidden />}
      loading={study.pending}
      onClick={() => void study.start({ activity_type: 'reading', source, after: 'stay' })}
    >
      {resumed ? 'Continuar estudo' : 'Iniciar estudo'}
    </Button>
  )
}
