// Hooks de dados sobre TanStack Query. Chaves: ['data', tabelas[], ...].
// Mutações invalidam apenas as consultas que dependem das tabelas afetadas
// (incluindo as tabelas atingidas por cascata), e avisam as outras abas.
import { useMutation, useQuery, useQueryClient, keepPreviousData, type QueryClient } from '@tanstack/react-query'
import { useBackend } from '@/app/data'
import type { Insert, Patch, Row, TableName } from '@/types/db'
import { affectedTables } from '@/lib/data/schema'
import type { DataBackend, Filter, ListQuery, SessionWithPauses } from '@/lib/data/types'
import { eq } from '@/lib/data/types'

const CHANNEL = 'evl-data-changes'
let channel: BroadcastChannel | null = null
function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL)
  return channel
}

function invalidateLocal(qc: QueryClient, tables: string[]) {
  return qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey
      return k[0] === 'data' && Array.isArray(k[1]) && (k[1] as string[]).some((t) => tables.includes(t))
    },
  })
}

export function invalidateTables(qc: QueryClient, tables: string[]) {
  getChannel()?.postMessage({ tables })
  return invalidateLocal(qc, tables)
}

export function onRemoteChange(qc: QueryClient): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  const handler = (e: MessageEvent) => {
    if (Array.isArray(e.data?.tables)) invalidateLocal(qc, e.data.tables)
  }
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}

interface QueryOpts {
  enabled?: boolean
  keepPrevious?: boolean
  /** Tabelas adicionais cuja alteração deve recarregar esta consulta. */
  dependsOn?: TableName[]
  staleTime?: number
  refetchInterval?: number | false
}

export function useList<T extends TableName>(table: T, query: ListQuery = {}, opts: QueryOpts = {}) {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', [table, ...(opts.dependsOn ?? [])], 'list', backend.kind, query],
    queryFn: () => backend.list(table, query),
    enabled: opts.enabled ?? true,
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
    staleTime: opts.staleTime,
    refetchInterval: opts.refetchInterval,
  })
}

/** Lista todas as linhas (paginando internamente). Para conjuntos moderados. */
export function useAll<T extends TableName>(table: T, query: Omit<ListQuery, 'limit' | 'offset'> = {}, opts: QueryOpts = {}) {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', [table, ...(opts.dependsOn ?? [])], 'all', backend.kind, query],
    queryFn: () => fetchAll(backend, table, query),
    enabled: opts.enabled ?? true,
    staleTime: opts.staleTime,
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
  })
}

export async function fetchAll<T extends TableName>(backend: DataBackend, table: T, query: Omit<ListQuery, 'limit' | 'offset'> = {}): Promise<Row<T>[]> {
  const page = 1000
  const out: Row<T>[] = []
  for (let offset = 0; ; offset += page) {
    const { rows } = await backend.list(table, { ...query, limit: page, offset, order: query.order ?? [{ column: 'id' }] })
    out.push(...rows)
    if (rows.length < page) break
  }
  return out
}

export function useRow<T extends TableName>(table: T, id: string | null | undefined) {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', [table], 'row', backend.kind, id],
    queryFn: () => backend.get(table, id!),
    enabled: Boolean(id),
  })
}

export function useCount(table: TableName, filters: Filter[], opts: QueryOpts = {}) {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', [table, ...(opts.dependsOn ?? [])], 'count', backend.kind, filters],
    queryFn: () => backend.count(table, filters),
    enabled: opts.enabled ?? true,
  })
}

/** Sessões com suas pausas (horas líquidas são calculadas a partir delas). */
export function useSessions(query: ListQuery, opts: QueryOpts = {}) {
  const backend = useBackend()
  return useQuery({
    queryKey: ['data', ['study_sessions', 'study_session_pauses'], 'sessions', backend.kind, query],
    queryFn: () => fetchAllSessions(backend, query),
    enabled: opts.enabled ?? true,
    placeholderData: opts.keepPrevious ? keepPreviousData : undefined,
    refetchInterval: opts.refetchInterval,
  })
}

export async function fetchAllSessions(backend: DataBackend, query: ListQuery): Promise<SessionWithPauses[]> {
  if (query.limit != null) return backend.listSessions(query)
  const page = 1000
  const out: SessionWithPauses[] = []
  for (let offset = 0; ; offset += page) {
    const rows = await backend.listSessions({ ...query, limit: page, offset, order: query.order ?? [{ column: 'started_at' }] })
    out.push(...rows)
    if (rows.length < page) break
  }
  return out
}

export function useInsert<T extends TableName>(table: T, also: TableName[] = []) {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows: Insert<T> | Insert<T>[]) => backend.insert(table, Array.isArray(rows) ? rows : [rows]),
    onSettled: () => invalidateTables(qc, [table, ...also]),
  })
}

export function useUpdate<T extends TableName>(table: T, also: TableName[] = []) {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, filters, patch }: { id?: string; filters?: Filter[]; patch: Patch<T> }) =>
      backend.update(table, filters ?? [eq('id', id)], patch),
    onSettled: () => invalidateTables(qc, [table, ...also]),
  })
}

export function useRemove(table: TableName) {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (idOrFilters: string | Filter[]) => backend.remove(table, typeof idOrFilters === 'string' ? [eq('id', idOrFilters)] : idOrFilters),
    onSettled: () => invalidateTables(qc, affectedTables(table)),
  })
}

/** Para mutações compostas: executa `fn` e invalida as tabelas informadas. */
export function useTransaction<A, R>(tables: TableName[], fn: (backend: DataBackend, args: A) => Promise<R>) {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: A) => fn(backend, args),
    onSettled: () => invalidateTables(qc, tables),
  })
}
