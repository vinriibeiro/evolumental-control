import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, CloudDownload, FolderPlus, KeyRound, LogOut, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useConfirm, useToast } from '@/components/ui/feedback'
import { Badge } from '@/components/ui/layout'
import { useBackend } from '@/app/data'
import { fetchAll, invalidateTables } from '@/hooks/data'
import { eq } from '@/lib/data/types'
import { FOLDER_MIME, KIND_LABELS, parseDriveFolder, type MaterialKind } from '@/lib/drive'
import { crawlFolder, type CrawlResult } from '@/lib/driveCrawl'
import { createDriveClient } from '@/lib/driveApi'
import { buildPlan, reconcile } from '@/lib/courseImport'
import { currentDriveToken, envClientId, getClientId, isClientId, requestDriveToken, revokeDriveToken, saveClientId, startDriveRedirect } from '@/lib/googleAuth'
import { isYoutubeSource } from '@/lib/youtubeCourses'
import { addSource, applySync, COURSE_TABLES, sourceConfig, removeSource } from '@/services/courses'
import type { CourseNode, CourseSource, CourseSourceConfig } from '@/types/db'

const STATUS: Record<CourseSource['last_sync_status'], { label: string; className: string }> = {
  never: { label: 'Ainda não importada', className: 'bg-surface-2 text-muted' },
  ok: { label: 'Atualizada', className: 'bg-success/15 text-success' },
  partial: { label: 'Atualização parcial', className: 'bg-warning/15 text-warning' },
  failed: { label: 'Falhou', className: 'bg-danger/15 text-danger' },
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null)

interface Pending {
  source: CourseSource | null
  folderId: string
  crawl: CrawlResult
  existing: CourseNode[]
  config: CourseSourceConfig
}

/** Conexão com o Google (somente leitura de metadados). O token fica só na memória desta aba. */
function GoogleConnection({ connected, onConnected }: { connected: boolean; onConnected: (v: boolean) => void }) {
  const toast = useToast()
  const fromEnv = envClientId()
  const [clientId, setClientId] = useState(getClientId() ?? '')
  const [busy, setBusy] = useState(false)
  const valid = isClientId(clientId)
  const connect = async () => {
    if (!valid) return
    setBusy(true)
    try {
      if (!fromEnv) saveClientId(clientId)
      await requestDriveToken(clientId)
      onConnected(true)
    } catch (e) {
      toast.error(e)
    } finally {
      setBusy(false)
    }
  }
  /** Sem janela pop-up: a aba inteira vai ao Google e volta para /cursos. */
  const connectHere = () => {
    if (!valid) return
    try {
      if (!fromEnv) saveClientId(clientId)
      startDriveRedirect(clientId)
    } catch (e) {
      toast.error(e)
    }
  }
  return (
    <section aria-label="Conexão com o Google Drive" className="space-y-3 rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <KeyRound className="size-4 text-accent-strong" aria-hidden /> Google Drive {connected ? '— conectado (só leitura)' : '— não conectado'}
        </p>
        {connected ? (
          <Button size="sm" icon={<LogOut className="size-3.5" aria-hidden />} onClick={() => { revokeDriveToken(); onConnected(false) }}>Desconectar</Button>
        ) : (
          <Button size="sm" variant="primary" disabled={!valid || busy} onClick={connectHere}>Conectar com o Google</Button>
        )}
      </div>
      {!connected && (
        <div className="space-y-1 text-xs text-muted">
          <p>
            O Google abre nesta mesma aba e volta para esta tela. Se aparecer <strong>“O Google não verificou este app”</strong>, é normal (o app está em modo de teste, só para o seu e-mail): toque em <strong>Continuar</strong> e depois em <strong>Permitir</strong>.
          </p>
          <p>
            Prefere a janela separada?{' '}
            <button type="button" className="font-medium text-accent-strong underline-offset-2 hover:underline disabled:opacity-50" disabled={!valid || busy} onClick={() => void connect()}>
              {busy ? 'Aguardando o Google…' : 'Conectar em janela separada'}
            </button>
            {' '}(pode falhar com bloqueio de cookies de terceiros ou pop-ups).
          </p>
        </div>
      )}
      {!fromEnv && !connected && (
        <Field label="ID do cliente OAuth do Google" hint="Público (não é segredo): termina em .apps.googleusercontent.com. Fica salvo só neste navegador. Veja docs/CURSOS.md para criar." error={clientId && !valid ? 'Formato inválido.' : null}>
          {(id, d) => <Input id={id} aria-describedby={d} value={clientId} onChange={(e) => setClientId(e.target.value.trim())} placeholder="123456789012-abc….apps.googleusercontent.com" autoComplete="off" spellCheck={false} />}
        </Field>
      )}
      <p className="text-xs text-muted">
        A autorização pede só <strong>ler metadados</strong> (nomes, tipos e pastas) para montar o catálogo; não lê conteúdo, não altera arquivos nem permissões. Ela vale por cerca de 1 hora nesta aba e não é guardada. Ver os arquivos depende da conta Google conectada no navegador, não deste login.
      </p>
    </section>
  )
}

function PlanPreview({ pending, onConfig }: { pending: Pending; onConfig: (c: CourseSourceConfig) => void }) {
  const plan = useMemo(() => buildPlan(pending.crawl, pending.config), [pending.crawl, pending.config])
  const diff = useMemo(() => reconcile(pending.existing, plan, pending.crawl, pending.source?.id ?? 'nova', new Date().toISOString()), [pending, plan])
  const root = pending.crawl.root!
  const topFolders = pending.crawl.entries.filter((e) => e.parentId === root.id && e.mimeType === FOLDER_MIME)
  const courses = plan.nodes.filter((n) => n.kind === 'course')
  const [showAll, setShowAll] = useState(false)
  const s = plan.summary
  const toggle = (id: string) => onConfig({ ...pending.config, excluded: pending.config.excluded.includes(id) ? pending.config.excluded.filter((x) => x !== id) : [...pending.config.excluded, id] })
  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-ink">Como organizar “{root.name}”</legend>
        {([[1, 'Cada subpasta é um curso', 'Ex.: uma pasta “Cursos” com um curso por pasta.'], [0, 'A pasta inteira é um curso', 'As subpastas viram módulos.']] as const).map(([level, label, hint]) => (
          <label key={level} className="flex items-start gap-2 text-sm">
            <input type="radio" name="courseLevel" className="mt-1" checked={pending.config.courseLevel === level} onChange={() => onConfig({ ...pending.config, courseLevel: level })} />
            <span><span className="font-medium text-ink">{label}</span> <span className="text-muted">— {hint}</span></span>
          </label>
        ))}
      </fieldset>

      {topFolders.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-ink">Pastas incluídas ({topFolders.length - topFolders.filter((f) => pending.config.excluded.includes(f.id)).length} de {topFolders.length})</legend>
          <ul className="scroll-thin max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-line p-2">
            {topFolders.map((f) => (
              <li key={f.id}>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={!pending.config.excluded.includes(f.id)} onChange={() => toggle(f.id)} />
                  <span className="truncate">{f.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <section aria-label="Resumo da importação" className="space-y-2 rounded-lg bg-surface p-3 text-sm">
        <p className="font-semibold text-ink">{s.courses} curso(s) · {s.modules} módulo(s) · {s.items} aula(s)/material(is)</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.entries(s.byKind) as Array<[MaterialKind, number]>).map(([k, n]) => <Badge key={k}>{KIND_LABELS[k]}: {n}</Badge>)}
        </div>
        <ul className="list-disc space-y-0.5 pl-5 text-muted">
          <li>Novos: {diff.counts.inserted} · atualizados: {diff.counts.updated} · sem mudança: {diff.counts.unchanged}</li>
          {diff.counts.missing > 0 && <li className="text-warning">Não encontrados no Drive (serão sinalizados, sem apagar o histórico): {diff.counts.missing}</li>}
          {diff.counts.restored > 0 && <li>Voltaram a aparecer: {diff.counts.restored}</li>}
          {diff.counts.excluded > 0 && <li>Deixados de fora pelo mapeamento: {diff.counts.excluded}</li>}
          {diff.counts.unverified > 0 && <li>Não verificados (pasta não lida agora, ficam como estão): {diff.counts.unverified}</li>}
          {s.repeatedFiles > 0 && <li>Arquivos em mais de um lugar (mesma referência, sem duplicar o arquivo): {s.repeatedFiles}</li>}
          {s.emptyFolders.length > 0 && <li>Pastas sem arquivos (ignoradas): {s.emptyFolders.length}</li>}
          {s.skipped.length > 0 && <li>Atalhos/repetições ignorados: {s.skipped.length}</li>}
        </ul>
        {(s.failedFolders.length > 0 || s.truncated) && (
          <div role="alert" className="flex gap-2 rounded-lg bg-warning/10 p-2 text-ink">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="font-medium">Leitura incompleta: {s.failedFolders.length} pasta(s) não puderam ser lidas{s.truncated ? ' e o limite de itens foi atingido' : ''}.</p>
              <p className="text-xs text-muted">Nada dessas pastas será marcado como removido. Tente atualizar de novo mais tarde.</p>
              <ul className="mt-1 text-xs text-muted">{s.failedFolders.slice(0, 5).map((f) => <li key={f.id}>{f.name || f.id}: {f.message}</li>)}</ul>
            </div>
          </div>
        )}
        {s.incompatible.length > 0 && (
          <details className="text-muted">
            <summary className="cursor-pointer text-ink">Sem visualização na plataforma ({s.incompatible.length}) — ficam com “Abrir no Drive”</summary>
            <ul className="scroll-thin mt-1 max-h-40 overflow-y-auto text-xs">{s.incompatible.slice(0, 200).map((x, i) => <li key={i}>{x.path} <span className="opacity-70">({x.mimeType})</span></li>)}</ul>
          </details>
        )}
      </section>

      <section aria-label="Estrutura proposta" className="space-y-1">
        <p className="text-sm font-semibold text-ink">Estrutura proposta</p>
        <ul className="scroll-thin max-h-60 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
          {(showAll ? courses : courses.slice(0, 30)).map((c) => {
            const modules = plan.nodes.filter((n) => n.parentKey === c.key && n.kind === 'module')
            const items = plan.nodes.filter((n) => n.path.startsWith(c.path + ' ›') && n.kind === 'item').length
            return (
              <li key={c.key} className="px-3 py-2">
                <details>
                  <summary className="cursor-pointer"><span className="font-medium text-ink">{c.title}</span> <span className="text-xs text-muted">· {modules.length} módulo(s) · {items} item(ns)</span></summary>
                  <ul className="mt-1 space-y-0.5 pl-4 text-xs text-muted">{modules.map((m) => <li key={m.key}>{m.title}</li>)}</ul>
                </details>
              </li>
            )
          })}
        </ul>
        {courses.length > 30 && !showAll && <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>Mostrar todos os {courses.length} cursos</Button>}
        <p className="text-xs text-muted">Depois de importar, dá para renomear, ocultar, reordenar e vincular a matérias. Isso é preservado nas próximas atualizações.</p>
      </section>
    </div>
  )
}

export function DriveSources({ open, onClose, sources }: { open: boolean; onClose: () => void; sources: CourseSource[] }) {
  const backend = useBackend()
  const qc = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [connected, setConnected] = useState(Boolean(currentDriveToken()))
  // Ao abrir, reflete o token já obtido (ex.: retorno do Google na mesma aba) ou expirado.
  useEffect(() => { if (open) setConnected(Boolean(currentDriveToken())) }, [open])
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [reading, setReading] = useState<{ folders: number; items: number } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [applying, setApplying] = useState<[number, number] | null>(null)

  const read = async (folderId: string, source: CourseSource | null) => {
    if (!currentDriveToken()) {
      setConnected(false)
      return toast.error('Conecte o Google Drive antes (a autorização expira em cerca de 1 hora).')
    }
    setReading({ folders: 0, items: 0 })
    try {
      const client = createDriveClient(currentDriveToken)
      const crawl = await crawlFolder(client, folderId, { onProgress: setReading })
      if (crawl.fatal || !crawl.root) {
        if (source) await applySync(backend, source, crawl, sourceConfig(source))
        await invalidateTables(qc, COURSE_TABLES)
        if (crawl.fatal?.kind === 'auth') setConnected(false)
        return toast.error(crawl.fatal?.message ?? 'Não foi possível ler a pasta.')
      }
      const existing = source ? await fetchAll(backend, 'course_nodes', { filters: [eq('source_id', source.id)] }) : []
      setPending({ source, folderId, crawl, existing, config: source ? sourceConfig(source) : { courseLevel: 1, excluded: [] } })
    } catch (e) {
      toast.error(e)
    } finally {
      setReading(null)
    }
  }

  const add = () => {
    const id = parseDriveFolder(link)
    if (!id) return setLinkError('Cole o link de uma pasta do Google Drive (drive.google.com/drive/folders/…).')
    setLinkError(null)
    const existing = sources.find((s) => s.drive_folder_id === id)
    void read(id, existing ?? null)
  }

  const apply = async () => {
    if (!pending) return
    setApplying([0, 1])
    try {
      const source = pending.source ?? (await addSource(backend, pending.folderId, pending.crawl.root!.name))
      const report = await applySync(backend, source, pending.crawl, pending.config, undefined, (d, t) => setApplying([d, t]))
      toast.success(`Catálogo atualizado: ${report.inserted ?? 0} novo(s), ${report.updated ?? 0} atualizado(s)${report.missing ? `, ${report.missing} não encontrado(s)` : ''}.`)
      setPending(null)
      setLink('')
    } catch (e) {
      toast.error(e)
    } finally {
      setApplying(null)
      await invalidateTables(qc, COURSE_TABLES)
    }
  }

  const remove = async (s: CourseSource) => {
    const ok = await confirm({
      title: `Remover “${s.label ?? s.title}” do catálogo?`,
      message: 'Os cursos desta pasta saem da plataforma (nada é apagado no Drive). O progresso fica guardado e volta se a pasta for cadastrada de novo.',
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return
    try {
      await removeSource(backend, s.id)
    } catch (e) {
      toast.error(e)
    } finally {
      await invalidateTables(qc, COURSE_TABLES)
    }
  }

  const busy = Boolean(reading || applying)
  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) { setPending(null); onClose() } }}
      persistent={busy || Boolean(pending)}
      size="lg"
      title={pending ? 'Prévia da importação' : 'Pastas do Google Drive'}
      description={pending ? 'Confira e ajuste antes de gravar. Nada é copiado: os arquivos continuam no Drive.' : 'Cadastre pastas e atualize o catálogo quando quiser. Só nomes, tipos e a organização são guardados.'}
      footer={pending ? (
        <>
          <Button disabled={busy} onClick={() => setPending(null)}>Voltar</Button>
          <Button variant="primary" loading={Boolean(applying)} disabled={!pending.crawl.root} onClick={() => void apply()}>
            {applying ? `Gravando ${applying[0]}/${applying[1]}…` : pending.source ? 'Aplicar atualização' : 'Importar'}
          </Button>
        </>
      ) : undefined}
    >
      {pending ? (
        <PlanPreview pending={pending} onConfig={(config) => setPending({ ...pending, config })} />
      ) : (
        <div className="space-y-4">
          <GoogleConnection connected={connected} onConnected={setConnected} />
          {reading && <p role="status" className="text-sm text-muted">Lendo o Drive… {reading.folders} pasta(s), {reading.items} item(ns)</p>}
          <section aria-label="Pastas cadastradas" className="space-y-2">
            {sources.length === 0 && <p className="text-sm text-muted">Nenhuma pasta cadastrada ainda.</p>}
            {sources.map((s) => {
              const st = STATUS[s.last_sync_status] ?? STATUS.never
              const r = s.last_sync_report
              return (
                <div key={s.id} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{s.label ?? s.title}</p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className={`rounded-full px-2 py-0.5 ${st.className}`}>{st.label}</span>
                      {when(s.last_sync_at) && <span>em {when(s.last_sync_at)}</span>}
                      {r?.error && <span className="text-danger">{r.error}</span>}
                      {r?.missing ? <span className="text-warning">{r.missing} não encontrado(s)</span> : null}
                      {r?.failedFolders?.length ? <span className="text-warning">{r.failedFolders.length} pasta(s) não lida(s)</span> : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isYoutubeSource(s) ? (
                      <Badge color="#c4302b">YouTube</Badge>
                    ) : (
                      <Button size="sm" variant="primary" disabled={busy || !connected} icon={<RefreshCw className="size-3.5" aria-hidden />} onClick={() => void read(s.drive_folder_id, s)}>Atualizar do Drive</Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={busy} aria-label={`Remover ${s.label ?? s.title}`} icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => void remove(s)} />
                  </div>
                </div>
              )
            })}
          </section>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); add() }}>
            <Field label="Adicionar pasta do Drive" error={linkError} hint="Link de compartilhamento da pasta. A conta conectada precisa conseguir abrir essa pasta.">
              {(id, d) => <Input id={id} aria-describedby={d} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" invalid={Boolean(linkError)} />}
            </Field>
            <Button type="submit" disabled={busy || !connected || !link.trim()} icon={<FolderPlus className="size-4" aria-hidden />}>Ler pasta e ver prévia</Button>
            {!connected && <p className="text-xs text-muted"><CloudDownload className="mr-1 inline size-3.5" aria-hidden />Conecte o Google Drive para ler pastas.</p>}
          </form>
          {sources.some((s) => s.last_sync_status === 'ok') && <p className="flex items-center gap-1 text-xs text-muted"><CheckCircle2 className="size-3.5 text-success" aria-hidden />Atualizar não duplica cursos e mantém progresso, nomes personalizados e organização.</p>}
        </div>
      )}
    </Modal>
  )
}
