import { Check, Coins } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Switch } from '@/components/ui/Field'
import { Card, CardHeader, PageHeader } from '@/components/ui/layout'
import { ErrorState, Spinner, useToast, useConfirm } from '@/components/ui/feedback'
import { useProfile } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import type { DataBackend } from '@/lib/data/types'
import { SHOP, type ShopItem } from '@/game/engine/rewards'
import { LEVEL_TITLES } from '@/game/engine/rules'
import { useGameData, useGameMutation, useGameSettings, useMemoSummary } from '@/game/useGame'
import { BackLink, PlayerCard, StreakCalendar } from './parts'

const buy = (b: DataBackend, item: ShopItem) => b.gameBuy(item.id)

export default function ProfilePage() {
  const { game, settings, save, saving } = useGameSettings()
  const profile = useProfile()
  const data = useGameData()
  const summary = useMemoSummary(data, settings.timezone)
  const toast = useToast()
  const confirm = useConfirm()
  const purchase = useGameMutation(buy, ['game_rewards', 'game_purchases'])

  if (data.isError) return <ErrorState error={data.error} onRetry={data.refetch} />
  if (data.isPending) return <Spinner />

  const doBuy = async (item: ShopItem) => {
    const ok = await confirm({ title: `Comprar ${item.name}?`, message: `Custa ${item.price} moedas virtuais (sem dinheiro real). Itens são apenas visuais.`, confirmLabel: 'Comprar' })
    if (!ok) return
    try {
      await purchase.mutateAsync(item)
      await save(item.kind === 'avatar' ? { avatar: item.id } : { title: item.id })
      toast.success(`${item.name} desbloqueado e equipado!`)
    } catch (e) {
      toast.error(e)
    }
  }
  const equip = (item: ShopItem | null, kind: 'avatar' | 'title') => save(kind === 'avatar' ? { avatar: item?.id ?? null } : { title: item?.id ?? null })

  return (
    <div>
      <BackLink to="/evoquest">EvoQuest</BackLink>
      <PageHeader title="Perfil, sequência e loja" />
      <div className="grid gap-4 lg:grid-cols-2">
        <PlayerCard summary={summary} game={game} name={profile.data?.display_name ?? 'Estudante'} />
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-ink">Sequência de estudo</h2>
          <p className="mt-0.5 mb-3 text-xs text-muted">
            Atual: {summary.streak} {summary.streak === 1 ? 'dia' : 'dias'} · Maior: {summary.bestStreak} · {summary.activeDays.length} dias com atividade. Dias de descanso não apagam nada.
          </p>
          <StreakCalendar days={summary.activeDays} tz={settings.timezone} />
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Loja de cosméticos"
          description="Moedas são ganhas jogando e servem só para personalização. Não existe compra com dinheiro, sorteio ou caixa surpresa."
          action={
            <span className="tabular inline-flex items-center gap-1 rounded-full bg-accent/30 px-3 py-1 text-sm font-semibold text-ink">
              <Coins className="size-4" aria-hidden /> {summary.coins}
            </span>
          }
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {(['avatar', 'title'] as const).map((kind) => (
            <div key={kind} className="contents">
              <ItemCard
                label={kind === 'avatar' ? 'Broto (padrão)' : 'Título do nível (padrão)'}
                value={kind === 'avatar' ? '🌱' : 'Automático'}
                equipped={kind === 'avatar' ? !game.avatar : !game.title}
                onEquip={() => equip(null, kind)}
                busy={saving}
              />
              {SHOP.filter((i) => i.kind === kind).map((item) => {
                const owned = summary.owned.has(item.id)
                const equipped = kind === 'avatar' ? game.avatar === item.id : game.title === item.id
                return (
                  <ItemCard
                    key={item.id}
                    label={item.name}
                    value={item.value}
                    equipped={equipped}
                    price={owned ? undefined : item.price}
                    affordable={summary.coins >= item.price}
                    onEquip={() => equip(item, kind)}
                    onBuy={() => doBuy(item)}
                    busy={saving || purchase.isPending}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Preferências do EvoQuest" />
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Field label="Meta diária de jogo (minutos)">
            {(id) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={240}
                defaultValue={game.dailyMinutes}
                onBlur={(e) => {
                  const n = Math.round(Number(e.target.value))
                  if (n >= 1 && n <= 240 && n !== game.dailyMinutes) void save({ dailyMinutes: n })
                }}
              />
            )}
          </Field>
          <div className="flex flex-col gap-3">
            {([
              ['registerTime', 'Registrar o tempo ativo como sessão de estudo'],
              ['sound', 'Efeitos sonoros'],
            ] as const).map(([k, label]) => (
              <div key={k} className="flex items-center justify-between gap-3 text-sm text-ink">
                <span>{label}</span>
                <Switch checked={game[k]} onChange={(v) => save({ [k]: v })} label={label} />
              </div>
            ))}
          </div>
        </div>
        <p className="px-4 pb-4 text-xs text-muted">
          O tempo é registrado só com a aba visível e com interação nos últimos 2 minutos. Se o cronômetro estiver ligado no mesmo intervalo, o tempo não é contado de novo. Para diminuir animações, use a preferência de “movimento reduzido” do sistema — o EvoQuest a respeita.
        </p>
      </Card>

      <Card className="mt-4 p-4">
        <h2 className="text-sm font-semibold text-ink">Como funcionam os níveis</h2>
        <p className="mt-1 text-sm text-muted">
          Cada nível pede 50 XP a mais que o anterior (nível 1→2: 100 XP). Acertos valem de 12 a 28 XP conforme a dificuldade; combos somam até +50%. Repetir um desafio já acertado nas últimas 20 h não rende XP — revisar depois rende metade.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {LEVEL_TITLES.map(([l, t]) => (
            <li key={l} className={cn('rounded-full border px-2.5 py-1', summary.level.level >= l ? 'border-accent-strong bg-accent/20 text-ink' : 'border-line text-muted')}>
              Nível {l}+: {t}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function ItemCard({
  label,
  value,
  equipped,
  price,
  affordable,
  onEquip,
  onBuy,
  busy,
}: {
  label: string
  value: string
  equipped: boolean
  price?: number
  affordable?: boolean
  onEquip: () => void
  onBuy?: () => void
  busy?: boolean
}) {
  const isEmoji = [...value].length <= 3
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border p-3', equipped ? 'border-accent-strong bg-accent/15' : 'border-line')}>
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface', isEmoji ? 'text-2xl' : 'text-[10px] font-semibold text-ink')} aria-hidden>
        {isEmoji ? value : '🏷️'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{label}</p>
        {!isEmoji && <p className="truncate text-xs text-muted">{value}</p>}
      </div>
      {equipped ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
          <Check className="size-4" aria-hidden /> Em uso
        </span>
      ) : price != null ? (
        <Button size="sm" variant="primary" disabled={!affordable || busy} onClick={onBuy} title={affordable ? undefined : 'Moedas insuficientes'}>
          🪙 {price}
        </Button>
      ) : (
        <Button size="sm" onClick={onEquip} disabled={busy}>
          Usar
        </Button>
      )}
    </div>
  )
}
