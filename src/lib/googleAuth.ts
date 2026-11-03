// O importador continua solicitando só metadados (drive.metadata.readonly).
// O leitor de PDFs solicita drive.readonly separadamente, mediante ação explícita.
//
// - Usa o Google Identity Services (fluxo de token no navegador): não há client secret nem refresh token;
//   o token de acesso vale ~1 hora e fica apenas na memória desta aba (nunca em localStorage, banco ou logs).
// - O ID do cliente OAuth é público por natureza (identifica o app ao Google); pode vir de VITE_GOOGLE_CLIENT_ID
//   ou ser informado na tela e guardado neste navegador.
// - O login no VLM Control (Supabase) não dá acesso ao Drive, e este token não autentica os visualizadores:
//   o iframe do Drive usa a sessão Google do próprio navegador.

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly'
/** Leitura do conteúdo, solicitada separadamente apenas ao abrir o leitor PDF do Drive. */
export const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_KEY = 'evolumental.google.clientId'
const CLIENT_ID = /^[0-9]{6,30}-[a-z0-9]{8,64}\.apps\.googleusercontent\.com$/

export const isClientId = (v: unknown): v is string => typeof v === 'string' && CLIENT_ID.test(v.trim())

export function envClientId(): string | null {
  const v = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
  return isClientId(v) ? v : null
}

export function getClientId(): string | null {
  const env = envClientId()
  if (env) return env
  try {
    const v = localStorage.getItem(CLIENT_KEY)
    return isClientId(v) ? v : null
  } catch {
    return null
  }
}

export function saveClientId(id: string | null) {
  try {
    if (id && isClientId(id)) localStorage.setItem(CLIENT_KEY, id.trim())
    else localStorage.removeItem(CLIENT_KEY)
  } catch {
    // armazenamento bloqueado: vale só nesta sessão
  }
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}
interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}
interface GoogleOAuth2 {
  initTokenClient(cfg: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type?: string; message?: string }) => void }): TokenClient
  revoke(token: string, done?: () => void): void
  hasGrantedAllScopes(r: TokenResponse, scope: string): boolean
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

let gisPromise: Promise<GoogleOAuth2> | null = null
function loadGis(): Promise<GoogleOAuth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2)
  if (gisPromise) return gisPromise
  gisPromise = new Promise<GoogleOAuth2>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error('O Google não carregou o módulo de autorização.')))
    s.onerror = () => {
      gisPromise = null
      reject(new Error('Não foi possível carregar o login do Google (bloqueador de conteúdo ou sem internet?).'))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

let current: { token: string; expiresAt: number } | null = null
let currentRead: { token: string; expiresAt: number } | null = null

/** Token ainda válido nesta aba (com 1 minuto de folga), ou null. */
export function currentDriveToken(): string | null {
  return current && current.expiresAt - 60_000 > Date.now() ? current.token : null
}

export function currentDriveReadToken(): string | null {
  return currentRead && currentRead.expiresAt - 60_000 > Date.now() ? currentRead.token : null
}

/** Permissão adicional explícita para ler PDFs; o token não é persistido. */
export async function requestDriveReadToken(clientId: string): Promise<string> {
  if (!isClientId(clientId)) throw new Error('ID do cliente OAuth inválido.')
  const oauth2 = await loadGis()
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: DRIVE_READ_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) return reject(new Error(response.error_description || 'Autorização do Google não concedida.'))
        if (!oauth2.hasGrantedAllScopes(response, DRIVE_READ_SCOPE)) return reject(new Error('A permissão de leitura dos PDFs do Drive não foi concedida.'))
        currentRead = { token: response.access_token, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 }
        resolve(response.access_token)
      },
      error_callback: (error) => reject(new Error(error.type === 'popup_closed' ? 'Janela do Google fechada antes de autorizar.' : error.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela do Google. Libere pop-ups para este site.' : error.message || 'Falha na autorização do Google.')),
    })
    client.requestAccessToken({ prompt: currentRead ? '' : 'consent' })
  })
}

/** Abre a janela do Google para autorizar a leitura dos metadados do Drive. Precisa vir de um clique. */
export async function requestDriveToken(clientId: string): Promise<string> {
  if (!isClientId(clientId)) throw new Error('ID do cliente OAuth inválido.')
  const oauth2 = await loadGis()
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (r.error || !r.access_token) return reject(new Error(r.error_description || 'Autorização do Google não concedida.'))
        if (!oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE)) return reject(new Error('A permissão de leitura dos metadados do Drive não foi concedida.'))
        current = { token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 }
        resolve(r.access_token)
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Janela do Google fechada antes de autorizar.' : e.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela do Google. Libere pop-ups para este site.' : e.message || 'Falha na autorização do Google.')),
    })
    client.requestAccessToken({ prompt: current ? '' : 'consent' })
  })
}

/** Desconecta: revoga o token no Google e apaga da memória. */
export function revokeDriveToken() {
  const tokens = new Set([current?.token, currentRead?.token].filter((token): token is string => Boolean(token)))
  current = null
  currentRead = null
  for (const token of tokens) window.google?.accounts?.oauth2?.revoke(token)
}
