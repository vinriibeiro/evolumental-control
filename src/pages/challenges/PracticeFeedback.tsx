import type { ReactNode } from 'react'
import type { CaseDetail, GitDetail, RepoSnapshot, ResultTable } from './practiceTypes'

const rowKey = (row: string[]) => JSON.stringify(row)

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-ink">{label}</p>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-bg p-2.5 font-mono text-xs leading-5 text-ink"><code>{children}</code></pre>
    </div>
  )
}

/** Tabela pequena; linhas sem correspondente na outra tabela ficam destacadas. */
function Table({ title, table, other, tone, byPosition }: { title: string; table: ResultTable; other: ResultTable; tone: 'got' | 'expected'; byPosition: boolean }) {
  const otherRows = new Set(other.rows.map(rowKey))
  const differs = (row: string[], index: number) => byPosition ? rowKey(row) !== rowKey(other.rows[index] ?? []) : !otherRows.has(rowKey(row))
  const mark = tone === 'got' ? 'bg-danger/10' : 'bg-warning/15'
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-semibold text-ink">{title} <span className="font-normal text-muted">· {table.total} {table.total === 1 ? 'linha' : 'linhas'}</span></p>
      <div className="overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full min-w-max border-collapse text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-muted">{table.columns.map((column, index) => <th key={`${column}-${index}`} scope="col" className="px-2.5 py-1.5 font-semibold">{column}</th>)}</tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index} className={`border-b border-line/60 last:border-0 ${differs(row, index) ? mark : ''}`}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-2.5 py-1.5 text-ink">{cell}</td>)}</tr>
            ))}
            {table.total > table.rows.length && <tr><td colSpan={table.columns.length} className="px-2.5 py-1.5 text-muted">… mais {table.total - table.rows.length} {table.total - table.rows.length === 1 ? 'linha' : 'linhas'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Files({ label, files, added }: { label: string; files: string[]; added?: string[] }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink">{label}</dt>
      <dd className="mt-0.5">
        {files.length ? <ul className="space-y-0.5">{files.map((file) => <li key={file} className={`break-words font-mono text-xs ${added?.includes(file) ? 'font-semibold text-success' : 'text-muted'}`}>{added?.includes(file) ? '+ ' : ''}{file}</li>)}</ul> : <span className="text-xs text-muted">nenhum</span>}
      </dd>
    </div>
  )
}

function RepoState({ title, snapshot, compare }: { title: string; snapshot: RepoSnapshot; compare?: RepoSnapshot }) {
  const fresh = (now: string[], before: string[] | undefined) => before ? now.filter((item) => !before.includes(item)) : undefined
  return (
    <section aria-label={title} className="min-w-0 rounded-lg border border-line bg-bg p-3">
      <h5 className="mb-2 text-xs font-semibold tracking-wide text-ink uppercase">{title}</h5>
      <dl className="space-y-2">
        <div>
          <dt className="text-xs font-semibold text-ink">Branch atual</dt>
          <dd className={`font-mono text-xs ${compare && compare.branch !== snapshot.branch ? 'font-semibold text-success' : 'text-muted'}`}>{snapshot.branch || 'sem repositório'}</dd>
        </div>
        {snapshot.branches.length > 0 && <Files label="Branches" files={snapshot.branches} added={fresh(snapshot.branches, compare?.branches)} />}
        <Files label="Commits (branch atual)" files={snapshot.commits.length ? snapshot.commits : []} added={compare && compare.branch !== snapshot.branch ? undefined : fresh(snapshot.commits, compare?.commits)} />
        <Files label="Preparados (staged)" files={snapshot.staged} added={fresh(snapshot.staged, compare?.staged)} />
        <Files label="Modificados, não preparados" files={snapshot.modified} added={fresh(snapshot.modified, compare?.modified)} />
        <Files label="Não rastreados" files={snapshot.untracked} added={fresh(snapshot.untracked, compare?.untracked)} />
        {snapshot.extras.length > 0 && <Files label="Outros" files={snapshot.extras} added={fresh(snapshot.extras, compare?.extras)} />}
      </dl>
    </section>
  )
}

function Changes({ repo }: { repo: GitDetail }) {
  return (
    <div>
      <p className="text-xs font-semibold text-ink">{repo.before && repo.after ? 'O que deveria mudar nesta etapa' : 'Como o repositório mudou'}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs leading-relaxed text-muted">{repo.changes.map((change) => <li key={change}>{change}</li>)}</ul>
    </div>
  )
}

function RepoDetail({ repo, passed }: { repo: GitDetail; passed: boolean }) {
  if (passed) return <Changes repo={repo} />
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        <strong className="text-ink">Comando {Math.min(repo.step, repo.total)} de {repo.total}. </strong>
        {repo.command ? <>Você digitou <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-ink">{repo.command}</code>.</> : 'Nenhum comando foi digitado nesta etapa.'}
      </p>
      <Changes repo={repo} />
      {repo.before && (
        <div className="grid gap-3 md:grid-cols-2">
          <RepoState title="Antes do comando" snapshot={repo.before} />
          {repo.after && <RepoState title="Esperado depois" snapshot={repo.after} compare={repo.before} />}
        </div>
      )}
    </div>
  )
}

/** Orientação estruturada de uma verificação: entrada, saída obtida/esperada, tabelas ou estado do repositório. */
export function CaseDetailView({ detail, passed }: { detail: CaseDetail; passed: boolean }) {
  if (detail.repo) {
    return (
      <div className="mt-2 space-y-2">
        {!passed && detail.kind && <span className="inline-block rounded-full border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs font-semibold text-danger">{detail.kind}</span>}
        <RepoDetail repo={detail.repo} passed={passed} />
      </div>
    )
  }
  const ordered = detail.kind === 'Ordem incorreta'
  return (
    <div className="mt-2 space-y-3">
      {detail.kind && <span className="inline-block rounded-full border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs font-semibold text-danger">{detail.kind}</span>}
      {detail.line && detail.code && (
        <div>
          <p className="mb-1 text-xs font-semibold text-ink">Linha {detail.line}</p>
          <pre className="overflow-x-auto rounded-lg border border-line bg-bg p-2.5 font-mono text-xs leading-5 text-ink"><code>{detail.code}</code></pre>
        </div>
      )}
      {detail.explanation && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{detail.explanation}</p>}
      {(detail.input || detail.got || detail.expected) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {detail.input && <Block label="Entrada de exemplo">{detail.input}</Block>}
          {detail.got && <Block label="Saída obtida">{detail.got}</Block>}
          {detail.expected && <Block label="Saída esperada">{detail.expected}</Block>}
        </div>
      )}
      {detail.gotTable && detail.expectedTable && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Table title="Seu resultado" table={detail.gotTable} other={detail.expectedTable} tone="got" byPosition={ordered} />
          <Table title="Resultado esperado" table={detail.expectedTable} other={detail.gotTable} tone="expected" byPosition={ordered} />
        </div>
      )}
      {detail.original && <p className="break-words text-xs text-muted">Mensagem original: <code className="font-mono">{detail.original}</code></p>}
    </div>
  )
}
