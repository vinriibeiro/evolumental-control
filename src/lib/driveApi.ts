// Cliente da API oficial do Google Drive v3, só leitura de METADADOS (files.get / files.list com `fields`).
// Nunca pede o conteúdo dos arquivos (sem alt=media), nunca altera permissões nem arquivos.
import { DriveApiError, type DriveClient, type DriveFile, type DriveListPage } from './driveCrawl'
import { isDriveId, isResourceKey } from './drive'

const API = 'https://www.googleapis.com/drive/v3/files'
const FILE_FIELDS = 'id,name,mimeType,resourceKey,size,modifiedTime,trashed,videoMediaMetadata(durationMillis),shortcutDetails(targetId,targetMimeType,targetResourceKey)'

function classify(status: number, reason: string): DriveApiError['kind'] {
  if (status === 401) return 'auth'
  if (status === 429) return 'rate'
  if (status === 403) return /rate|quota|limit/i.test(reason) ? 'rate' : 'forbidden'
  if (status === 404) return 'not_found'
  if (status >= 500) return 'server'
  return 'invalid'
}

const MESSAGES: Record<DriveApiError['kind'], string> = {
  auth: 'A autorização do Google expirou ou foi revogada. Conecte de novo.',
  forbidden: 'Sem permissão para ler esta pasta com a conta Google conectada.',
  not_found: 'Pasta ou arquivo não encontrado (removido ou sem acesso para a conta conectada).',
  rate: 'Limite de uso da API do Google atingido. Tente de novo em alguns minutos.',
  server: 'O Google Drive não respondeu. Tente de novo.',
  network: 'Falha de conexão com o Google Drive.',
  invalid: 'Pedido inválido à API do Google Drive.',
}

/** Header de chaves de recurso para pastas/arquivos compartilhados por link antigos. */
const keyHeader = (id: string, resourceKey?: string): Record<string, string> => (isResourceKey(resourceKey) ? { 'X-Goog-Drive-Resource-Keys': `${id}/${resourceKey}` } : {})

export function createDriveClient(getToken: () => string | null, fetchImpl: typeof fetch = (...a) => fetch(...a)): DriveClient {
  const call = async <T,>(url: string, headers: Record<string, string>): Promise<T> => {
    const token = getToken()
    if (!token) throw new DriveApiError('auth', 401, MESSAGES.auth)
    let res: Response
    try {
      res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, ...headers }, credentials: 'omit', referrerPolicy: 'no-referrer' })
    } catch {
      throw new DriveApiError('network', 0, MESSAGES.network)
    }
    if (!res.ok) {
      let reason = ''
      try {
        const body = (await res.json()) as { error?: { errors?: Array<{ reason?: string }>; status?: string } }
        reason = [body.error?.status, ...(body.error?.errors ?? []).map((x) => x.reason)].filter(Boolean).join(' ')
      } catch {
        /* corpo sem JSON */
      }
      const kind = classify(res.status, reason)
      throw new DriveApiError(kind, res.status, MESSAGES[kind])
    }
    return (await res.json()) as T
  }

  return {
    getFile(id, resourceKey) {
      if (!isDriveId(id)) return Promise.reject(new DriveApiError('invalid', 400, 'ID inválido.'))
      const q = new URLSearchParams({ fields: FILE_FIELDS, supportsAllDrives: 'true' })
      return call<DriveFile>(`${API}/${encodeURIComponent(id)}?${q}`, keyHeader(id, resourceKey))
    },
    listChildren(folderId, pageToken, resourceKey) {
      if (!isDriveId(folderId)) return Promise.reject(new DriveApiError('invalid', 400, 'ID inválido.'))
      const q = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false`,
        fields: `nextPageToken,files(${FILE_FIELDS})`,
        pageSize: '1000',
        orderBy: 'folder,name_natural',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      })
      if (pageToken) q.set('pageToken', pageToken)
      return call<DriveListPage>(`${API}?${q}`, keyHeader(folderId, resourceKey))
    },
  }
}
