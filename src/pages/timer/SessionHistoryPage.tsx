// Histórico de sessões e lançamento manual de tempo estudado fora do app.
import { useState } from 'react'
import { PenLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/layout'
import { SessionList } from '@/features/timer/SessionList'
import { ManualEntry } from './ManualEntry'

export default function SessionHistoryPage() {
  const [manual, setManual] = useState(false)
  return (
    <div>
      <PageHeader
        title="Histórico de sessões"
        description="Todas as sessões concluídas, com o tempo líquido de cada uma. Você pode corrigir uma sessão ou lançar um estudo feito fora do app."
        actions={
          <Button icon={<PenLine className="size-4" />} onClick={() => setManual(true)}>
            Lançamento manual
          </Button>
        }
      />
      <SessionList emptyText="Nenhuma sessão concluída ainda." />
      <ManualEntry open={manual} onClose={() => setManual(false)} />
    </div>
  )
}
