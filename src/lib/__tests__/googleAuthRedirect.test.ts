import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clientId = '123456789012-abcdefghijklmnop.apps.googleusercontent.com'

describe('conexão com o Google na mesma aba (redirecionamento)', () => {
  beforeEach(() => vi.stubGlobal('crypto', webcrypto))
  afterEach(() => { sessionStorage.clear(); vi.unstubAllGlobals(); vi.resetModules() })

  const stateSaved = () => JSON.parse(sessionStorage.getItem('evolumental.google.redirect')!) as { state: string; scope: string }

  it('monta a URL do Google com state, escopo e URI de retorno /cursos', async () => {
    const auth = await import('@/lib/googleAuth')
    const go = vi.fn<(url: string) => void>()
    auth.startDriveRedirect(clientId, auth.DRIVE_SCOPE, go)
    const url = new URL(go.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe(clientId)
    expect(url.searchParams.get('response_type')).toBe('token')
    expect(url.searchParams.get('scope')).toBe(auth.DRIVE_SCOPE)
    expect(url.searchParams.get('redirect_uri')).toBe(`${window.location.origin}/cursos`)
    expect(url.searchParams.get('state')).toMatch(/^[0-9a-f]{32}$/)
    expect(stateSaved()).toMatchObject({ state: url.searchParams.get('state'), scope: auth.DRIVE_SCOPE })
    expect(() => auth.startDriveRedirect('invalido', auth.DRIVE_SCOPE, go)).toThrow(/inválido/)
  })

  it('lê o token do fragmento uma única vez, limpa a URL e guarda só em memória', async () => {
    const auth = await import('@/lib/googleAuth')
    auth.startDriveRedirect(clientId, auth.DRIVE_SCOPE, () => {})
    const { state } = stateSaved()
    const hash = `#state=${state}&access_token=tok-metadata&token_type=Bearer&expires_in=3599&scope=${encodeURIComponent(auth.DRIVE_SCOPE)}`
    window.history.replaceState(null, '', `/cursos${hash}`)
    expect(auth.consumeRedirectToken()).toEqual({ ok: true, scope: auth.DRIVE_SCOPE })
    expect(auth.currentDriveToken()).toBe('tok-metadata')
    expect(auth.currentDriveReadToken()).toBeNull()
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/cursos')
    expect(sessionStorage.getItem('evolumental.google.redirect')).toBeNull()
    expect(localStorage.getItem('evolumental.google.redirect')).toBeNull()
    expect(auth.consumeRedirectToken()).toBeNull()
  })

  it('rejeita state desconhecido, erro do Google e escopo não concedido', async () => {
    const auth = await import('@/lib/googleAuth')
    window.history.replaceState(null, '', '/cursos#state=forjado&access_token=x&scope=y')
    expect(auth.consumeRedirectToken()).toMatchObject({ ok: false, message: expect.stringMatching(/não reconhecido/) })
    expect(auth.currentDriveToken()).toBeNull()

    auth.startDriveRedirect(clientId, auth.DRIVE_SCOPE, () => {})
    window.history.replaceState(null, '', `/cursos#state=${stateSaved().state}&error=access_denied`)
    expect(auth.consumeRedirectToken()).toMatchObject({ ok: false, message: expect.stringMatching(/access_denied/) })

    auth.startDriveRedirect(clientId, auth.DRIVE_SCOPE, () => {})
    window.history.replaceState(null, '', `/cursos#state=${stateSaved().state}&access_token=x&scope=openid`)
    expect(auth.consumeRedirectToken()).toMatchObject({ ok: false, message: expect.stringMatching(/não foi concedida/) })
    expect(auth.currentDriveToken()).toBeNull()
    window.history.replaceState(null, '', '/')
    expect(auth.consumeRedirectToken()).toBeNull()
  })

  it('guarda o token de leitura de PDF separado quando o escopo é drive.readonly', async () => {
    const auth = await import('@/lib/googleAuth')
    auth.startDriveRedirect(clientId, auth.DRIVE_READ_SCOPE, () => {})
    window.history.replaceState(null, '', `/cursos#state=${stateSaved().state}&access_token=tok-read&expires_in=3600&scope=${encodeURIComponent(auth.DRIVE_READ_SCOPE)}`)
    expect(auth.consumeRedirectToken()).toEqual({ ok: true, scope: auth.DRIVE_READ_SCOPE })
    expect(auth.currentDriveReadToken()).toBe('tok-read')
    expect(auth.currentDriveToken()).toBeNull()
  })
})
