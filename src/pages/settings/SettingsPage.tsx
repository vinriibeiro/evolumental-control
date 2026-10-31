import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Database, Download, Info, Smartphone, Upload, Moon, Palette, RotateCcw, Sun, Timer, User, Volume2 } from 'lucide-react'
import { useAuth } from '@/app/auth'
import { useBackend } from '@/app/data'
import { LogoMark } from '@/components/brand/Logo'
import { InstallAppSection } from '@/components/InstallApp'
import { Button } from '@/components/ui/Button'
import { Checkbox, Field, Input, Select, Switch } from '@/components/ui/Field'
import { Card, Segmented } from '@/components/ui/layout'
import { Spinner, useToast } from '@/components/ui/feedback'
import { Modal } from '@/components/ui/Modal'
import { fetchAll, fetchAllSessions, invalidateTables } from '@/hooks/data'
import { planImport, runImport, type ImportPlan } from '@/services/importData'
import { useProfile, useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { useSpeech } from '@/hooks/useSpeech'
import { TABLES } from '@/lib/data/schema'
import { DEFAULT_SRS } from '@/lib/srs'
import { browserTimeZone } from '@/lib/time'
import { downloadJson, slugDate } from '@/lib/download'
import { playChime, unlockAudio } from '@/lib/timer/sound'
import type { SrsParams, TableName, UserSettings } from '@/types/db'

function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 text-accent-strong">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="text-xs text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  )
}

export default function SettingsPage() {
  const settings = useSettings()
  const profile = useProfile()
  const update = useUpdateSettings()
  const auth = useAuth()
  const toast = useToast()
  const save = (patch: Partial<UserSettings> & { display_name?: string }, msg = 'Preferência salva.') => update.mutateAsync(patch).then(() => toast.success(msg), toast.error)

  if (profile.isPending) return <Spinner />
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="mb-2 text-xl font-semibold text-ink">Configurações</h1>
      <ProfileSection displayName={profile.data?.display_name ?? ''} email={auth.user?.email ?? null} mode={auth.mode} onSave={(n) => save({ display_name: n }, 'Perfil atualizado.')} />

      <Section icon={<Smartphone className="size-5" />} title="Aplicativo no celular">
        <InstallAppSection />
      </Section>

      <Section icon={<Palette className="size-5" />} title="Aparência">
        <Segmented
          label="Tema"
          value={settings.theme}
          onChange={(theme) => save({ theme })}
          options={[
            { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" /> Claro</span> },
            { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" /> Escuro</span> },
            { value: 'system', label: 'Sistema' },
          ]}
        />
      </Section>

      <StudySection settings={settings} onSave={save} />
      <VoiceSection settings={settings} onSave={save} />
      <SrsSection value={settings.srs} onSave={(srs) => save({ srs }, 'Parâmetros da repetição espaçada salvos.')} />
      <DataSection />

      <Section icon={<Info className="size-5" />} title="Sobre">
        <div className="flex items-center gap-3">
          <LogoMark className="size-10" />
          <div className="text-sm">
            <p className="font-semibold text-ink">VLM Control</p>
            <p className="text-xs text-muted">
              Versão 1.0.0 · {auth.mode === 'supabase' ? 'Conectado ao Supabase (dados na nuvem, protegidos por usuário)' : 'Modo local (IndexedDB deste navegador, sem sincronização)'}
            </p>
          </div>
        </div>
      </Section>
    </div>
  )
}

function ProfileSection({ displayName, email, mode, onSave }: { displayName: string; email: string | null; mode: 'supabase' | 'local'; onSave: (n: string) => void }) {
  const [name, setName] = useState(displayName)
  const [pwd, setPwd] = useState({ a: '', b: '' })
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const auth = useAuth()
  const toast = useToast()
  useEffect(() => setName(displayName), [displayName])
  const changePassword = async () => {
    if (pwd.a.length < 8) return setPwdError('A senha deve ter pelo menos 8 caracteres.')
    if (pwd.a !== pwd.b) return setPwdError('As senhas não coincidem.')
    setPwdError(null)
    setBusy(true)
    try {
      await auth.updatePassword(pwd.a)
      setPwd({ a: '', b: '' })
      toast.success('Senha alterada.')
    } catch (e) {
      setPwdError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Section icon={<User className="size-5" />} title="Perfil">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Nome de exibição">{(id) => <Input id={id} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}</Field>
        <Button onClick={() => onSave(name.trim())} disabled={name.trim() === displayName}>
          Salvar nome
        </Button>
      </div>
      {mode === 'supabase' ? (
        <div className="mt-5 border-t border-line pt-5">
          <p className="mb-3 text-sm text-muted">E-mail: {email}</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Nova senha" error={pwdError}>
              {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={pwd.a} onChange={(e) => setPwd({ ...pwd, a: e.target.value })} />}
            </Field>
            <Field label="Confirmar">{(id) => <Input id={id} type="password" autoComplete="new-password" value={pwd.b} onChange={(e) => setPwd({ ...pwd, b: e.target.value })} />}</Field>
            <Button onClick={changePassword} loading={busy} disabled={!pwd.a}>
              Alterar senha
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted">No modo local não há conta nem senha. Configure o Supabase para usar login real.</p>
      )}
    </Section>
  )
}

function StudySection({ settings, onSave }: { settings: UserSettings; onSave: (p: Partial<UserSettings>) => unknown }) {
  const [daily, setDaily] = useState(String(settings.dailyGoalMinutes / 60))
  const [weekly, setWeekly] = useState(String(settings.weeklyGoalMinutes / 60))
  const [pomo, setPomo] = useState(settings.pomodoro)
  const [intervals, setIntervals] = useState(settings.reviewIntervals.join(', '))
  const [error, setError] = useState<string | null>(null)
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [browserTimeZone()]
    } catch {
      return [browserTimeZone()]
    }
  }, [])
  const saveGoals = () => {
    const d = Number(daily.replace(',', '.'))
    const w = Number(weekly.replace(',', '.'))
    const iv = intervals.split(/[,;\s]+/).filter(Boolean).map(Number)
    if (!(d > 0 && d <= 24)) return setError('Meta diária entre 0 e 24 horas.')
    if (!(w > 0 && w <= 168)) return setError('Meta semanal entre 0 e 168 horas.')
    if (iv.length === 0 || iv.some((n) => !Number.isInteger(n) || n < 1 || n > 365)) return setError('Intervalos de revisão: dias inteiros entre 1 e 365, separados por vírgula.')
    if ([pomo.focus, pomo.shortBreak, pomo.longBreak].some((v) => !(v >= 1 && v <= 240)) || !(pomo.rounds >= 1 && pomo.rounds <= 12)) return setError('Valores do pomodoro inválidos.')
    setError(null)
    onSave({ dailyGoalMinutes: Math.round(d * 60), weeklyGoalMinutes: Math.round(w * 60), pomodoro: pomo, reviewIntervals: [...new Set(iv)].sort((a, b) => a - b) })
  }
  return (
    <Section icon={<Timer className="size-5" />} title="Estudo" description="Metas padrão, fuso horário e cronômetro.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Meta diária (horas)">{(id) => <Input id={id} inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} />}</Field>
        <Field label="Meta semanal (horas)">{(id) => <Input id={id} inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} />}</Field>
        <Field label="Fuso horário" hint="Define o início de cada dia nos indicadores.">
          {(id, d) => (
            <Select id={id} aria-describedby={d} value={settings.timezone} onChange={(e) => onSave({ timezone: e.target.value })}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Formato de hora">
          {(id) => (
            <Select id={id} value={settings.hourFormat} onChange={(e) => onSave({ hourFormat: e.target.value as UserSettings['hourFormat'] })}>
              <option value="24h">24 horas (14:30)</option>
              <option value="12h">12 horas (2:30 PM)</option>
            </Select>
          )}
        </Field>
      </div>
      <p className="mt-5 mb-2 text-sm font-medium text-ink">Pomodoro padrão (minutos)</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['focus', 'Foco'],
            ['shortBreak', 'Pausa curta'],
            ['longBreak', 'Pausa longa'],
            ['rounds', 'Focos até a longa'],
          ] as const
        ).map(([k, l]) => (
          <Field key={k} label={l}>
            {(id) => <Input id={id} type="number" value={pomo[k]} onChange={(e) => setPomo({ ...pomo, [k]: Number(e.target.value) })} />}
          </Field>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:items-end">
        <Field label="Revisões automáticas após estudar um tópico (dias)">{(id) => <Input id={id} value={intervals} onChange={(e) => setIntervals(e.target.value)} />}</Field>
        <Checkbox label="Sugerir revisões automáticas ao salvar sessões" checked={settings.autoReviews} onChange={(e) => onSave({ autoReviews: e.target.checked })} />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Button className="mt-4" variant="primary" onClick={saveGoals}>
        Salvar estudo
      </Button>
    </Section>
  )
}

function VoiceSection({ settings, onSave }: { settings: UserSettings; onSave: (p: Partial<UserSettings>) => unknown }) {
  const speech = useSpeech({ voiceURI: settings.voiceURI, rate: settings.speechRate })
  return (
    <Section icon={<Volume2 className="size-5" />} title="Som e voz" description="A leitura por voz usa as vozes instaladas no navegador/sistema; nada é enviado a serviços externos.">
      <div className="flex flex-wrap items-center gap-3">
        <Switch checked={settings.sound} onChange={(v) => onSave({ sound: v })} label="Som dos alertas do cronômetro" />
        <span className="text-sm text-ink">Som dos alertas do cronômetro</span>
        <Button
          size="sm"
          onClick={() => {
            unlockAudio()
            playChime()
          }}
        >
          Testar som
        </Button>
      </div>
      {!speech.supported ? (
        <p className="mt-4 text-sm text-muted">Este navegador não suporta síntese de voz.</p>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Voz" hint={!speech.hasPortuguese && speech.voices.length > 0 ? 'Nenhuma voz pt-BR instalada; instale uma voz em português no sistema para melhor resultado.' : undefined}>
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={speech.voice?.voiceURI ?? ''} onChange={(e) => onSave({ voiceURI: e.target.value || null })}>
                <option value="">Automática (pt-BR quando disponível)</option>
                {speech.voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={`Velocidade: ${settings.speechRate.toFixed(1)}×`}>
            {(id) => <input id={id} type="range" min={0.5} max={2} step={0.1} value={settings.speechRate} onChange={(e) => onSave({ speechRate: Number(e.target.value) })} className="mt-2 w-full accent-[var(--accent-strong)]" />}
          </Field>
          <Checkbox label="Leitura automática dos flashcards" checked={settings.autoRead} onChange={(e) => onSave({ autoRead: e.target.checked })} />
          <Button size="sm" className="justify-self-start" onClick={() => void speech.speak(['Olá! Esta é a voz que vai ler seus flashcards.'])}>
            Testar voz
          </Button>
        </div>
      )}
    </Section>
  )
}

const SRS_FIELDS: Array<[keyof SrsParams, string, number, number, number]> = [
  ['initialEase', 'Facilidade inicial', 1.3, 5, 0.05],
  ['minEase', 'Facilidade mínima', 1.1, 3, 0.05],
  ['firstInterval', '1º intervalo "Bom" (dias)', 1, 30, 1],
  ['secondInterval', '2º intervalo "Bom" (dias)', 1, 60, 1],
  ['hardFactor', 'Multiplicador "Difícil"', 1, 3, 0.05],
  ['easyBonus', 'Bônus "Fácil"', 1, 3, 0.05],
  ['relearnMinutes', 'Reaprender após erro (min)', 1, 1440, 1],
  ['maxIntervalDays', 'Intervalo máximo (dias)', 30, 36500, 1],
]

function SrsSection({ value, onSave }: { value: SrsParams; onSave: (v: SrsParams) => unknown }) {
  const [form, setForm] = useState(value)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => setForm(value), [value])
  const save = () => {
    for (const [k, label, min, max] of SRS_FIELDS) {
      const v = Number(form[k])
      if (!(v >= min && v <= max)) return setError(`${label}: entre ${min} e ${max}.`)
    }
    if (form.minEase > form.initialEase) return setError('A facilidade mínima não pode ser maior que a inicial.')
    setError(null)
    onSave(form)
  }
  return (
    <Section icon={<RotateCcw className="size-5" />} title="Repetição espaçada" description="Variante do SM-2 com quatro respostas (Errei, Difícil, Bom, Fácil).">
      <ul className="mb-4 list-disc space-y-1 pl-5 text-xs text-muted">
        <li>Errei: o cartão volta ao aprendizado e reaparece após o tempo de reaprendizado; facilidade −0,20.</li>
        <li>Difícil: intervalo anterior × multiplicador "Difícil"; facilidade −0,15.</li>
        <li>Bom: 1º e 2º intervalos fixos; depois intervalo anterior × facilidade.</li>
        <li>Fácil: intervalo de "Bom" × bônus; facilidade +0,15.</li>
      </ul>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SRS_FIELDS.map(([k, label, min, max, step]) => (
          <Field key={k} label={label}>
            {(id) => <Input id={id} type="number" min={min} max={max} step={step} value={form[k]} onChange={(e) => setForm({ ...form, [k]: Number(e.target.value) })} />}
          </Field>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="primary" onClick={save}>
          Salvar parâmetros
        </Button>
        <Button onClick={() => setForm(DEFAULT_SRS)}>Restaurar padrão</Button>
      </div>
    </Section>
  )
}

function DataSection() {
  const backend = useBackend()
  const auth = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState<{ name: string; plan: ImportPlan } | null>(null)
  const [progress, setProgress] = useState<[number, number] | null>(null)
  const [danger, setDanger] = useState<'reset' | 'delete' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportAll = async () => {
    setBusy(true)
    try {
      const out: Record<string, unknown> = { exportado_em: new Date().toISOString(), aplicativo: 'VLM Control', versao: 1, perfil: await backend.getProfile() }
      for (const t of TABLES.filter((x) => x !== 'profiles' && x !== 'study_sessions' && x !== 'study_session_pauses')) {
        out[t] = await fetchAll(backend, t as TableName)
      }
      out.study_sessions = await fetchAllSessions(backend, {})
      downloadJson(out, `vlm-backup-${slugDate()}.json`)
      toast.success('Exportação concluída.')
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return toast.error('Arquivo muito grande (máx. 50 MB).')
    try {
      const json = JSON.parse(await file.text())
      setPlan({ name: file.name, plan: planImport(json) })
    } catch (e) {
      toast.error(e instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : e)
    }
  }

  const runPlan = async () => {
    if (!plan) return
    setProgress([0, 1])
    try {
      const n = await runImport(backend, plan.plan, (d, t) => setProgress([d, t]))
      toast.success(`${n} registro(s) importado(s).`)
      setPlan(null)
    } catch (e) {
      toast.error(e)
    } finally {
      setProgress(null)
      await invalidateTables(qc, TABLES)
    }
  }

  const confirmDanger = async () => {
    const kind = danger
    setDanger(null)
    setBusy(true)
    try {
      if (kind === 'reset') {
        await backend.resetAllData()
        try {
          localStorage.removeItem('evl:theme')
        } catch {
          /* sem armazenamento local */
        }
        await invalidateTables(qc, TABLES)
        toast.success('Progresso zerado. Seu conteúdo (matérias, vídeos, flashcards, livros, áudios e questões) foi mantido.')
        navigate('/')
      } else if (kind === 'delete') {
        await backend.deleteAccount()
        await auth.signOut()
        qc.clear()
        navigate('/login')
      }
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }

  const counts = plan?.plan.counts
  const labels: Record<string, string> = { subjects: 'Matérias', topics: 'Tópicos', study_materials: 'Materiais', flashcard_decks: 'Baralhos', flashcards: 'Flashcards', mind_maps: 'Mapas mentais', study_sessions: 'Sessões de estudo', study_session_pauses: 'Pausas' }

  return (
    <>
      <Section icon={<Database className="size-5" />} title="Seus dados" description="Exporte um backup completo ou importe conteúdo (matérias, tópicos, flashcards, mapas e sessões de estudo) de um arquivo JSON.">
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download className="size-4" />} onClick={exportAll} loading={busy && !danger}>
            Exportar todos os dados
          </Button>
          <Button icon={<Upload className="size-4" />} onClick={() => fileRef.current?.click()}>
            Importar dados (JSON)
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" aria-label="Arquivo JSON para importar" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <p className="mt-3 text-xs text-muted">A importação sempre cria cópias novas e não altera nem apaga o que você já tem. Importar o mesmo arquivo duas vezes duplica o conteúdo.</p>
      </Section>

      <Section icon={<AlertTriangle className="size-5 text-danger" />} title="Zona de perigo" description="Ações definitivas. Exporte seus dados antes se quiser guardar uma cópia.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-sm font-medium text-ink">Zerar todos os dados</p>
              <p className="text-xs text-muted">
                Apaga sessões e horas, cronogramas, ciclos, revisões e metas, zera o progresso dos tópicos e volta as preferências ao padrão. Mantém matérias, tópicos, vídeos e links, flashcards, mapas, livros, áudios e questões.
                {auth.mode === 'supabase' ? ' Sua conta e seu login continuam.' : ''}
              </p>
            </div>
            <Button variant="danger" onClick={() => setDanger('reset')} disabled={busy}>
              Zerar tudo
            </Button>
          </div>
          {auth.mode === 'supabase' && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-sm font-medium text-ink">Excluir minha conta</p>
                <p className="text-xs text-muted">Remove sua conta e todos os seus dados permanentemente. Para usar de novo, será preciso criar outra conta.</p>
              </div>
              <Button variant="danger" onClick={() => setDanger('delete')} disabled={busy}>
                Excluir conta
              </Button>
            </div>
          )}
        </div>
      </Section>

      <Modal
        open={Boolean(plan)}
        onClose={() => !progress && setPlan(null)}
        persistent
        title="Importar dados"
        description={plan?.name}
        footer={
          <>
            <Button onClick={() => setPlan(null)} disabled={Boolean(progress)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={runPlan} loading={Boolean(progress)} disabled={!counts || Object.values(counts).every((n) => n === 0)}>
              {progress ? `Importando ${progress[0]}/${progress[1]}` : 'Importar'}
            </Button>
          </>
        }
      >
        {counts && plan && (
          <div className="space-y-3">
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(counts).map(([k, n]) => (
                <li key={k} className="flex justify-between rounded-lg bg-surface px-3 py-2">
                  <span className="text-ink">{labels[k]}</span>
                  <span className="tabular font-semibold text-ink">{n}</span>
                </li>
              ))}
            </ul>
            {plan.plan.warnings.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-warning">
                {plan.plan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <TypedConfirm
        open={danger !== null}
        onClose={() => setDanger(null)}
        onConfirm={confirmDanger}
        word={danger === 'delete' ? 'EXCLUIR' : 'ZERAR'}
        title={danger === 'delete' ? 'Excluir sua conta?' : 'Zerar todos os dados?'}
        message={
          danger === 'delete'
            ? 'Sua conta e todos os dados serão apagados para sempre. Não é possível desfazer.'
            : 'Horas, sessões, cronogramas, ciclos, revisões e metas serão apagados para sempre, e os tópicos voltam a "não iniciado". Matérias, vídeos, flashcards, mapas, livros, áudios e questões não são apagados. Não é possível desfazer.'
        }
      />
    </>
  )
}

function TypedConfirm({ open, onClose, onConfirm, word, title, message }: { open: boolean; onClose: () => void; onConfirm: () => void; word: string; title: string; message: string }) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText('')
  }, [open])
  const ok = text.trim().toUpperCase() === word
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="danger" disabled={!ok} onClick={onConfirm}>
            Confirmar
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">{message}</p>
      <Field
        label={
          <>
            Digite <strong>{word}</strong> para confirmar
          </>
        }
      >
        {(id) => <Input id={id} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" />}
      </Field>
    </Modal>
  )
}
