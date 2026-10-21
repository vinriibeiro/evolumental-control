import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import { LOCAL_USER_ID } from '@/lib/data/local'

export type AuthMode = 'supabase' | 'local'

interface AuthState {
  mode: AuthMode
  loading: boolean
  user: { id: string; email: string | null } | null
  /** Link de recuperação aberto: o usuário precisa definir nova senha. */
  recovering: boolean
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>
  signOut(): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function translateAuthError(message: string): string {
  if (/Invalid login credentials/i.test(message)) return 'E-mail ou senha incorretos.'
  if (/Email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.'
  if (/User already registered/i.test(message)) return 'Já existe uma conta com este e-mail.'
  if (/Password should be at least/i.test(message)) return 'A senha é muito curta.'
  if (/rate limit/i.test(message)) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (/fetch|network/i.test(message)) return 'Falha de conexão com o servidor.'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode: AuthMode = isSupabaseConfigured ? 'supabase' : 'local'
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(mode === 'supabase')
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(() => {
    const user: User | null = session?.user ?? null
    return {
      mode,
      loading,
      recovering,
      user: mode === 'local' ? { id: LOCAL_USER_ID, email: null } : user ? { id: user.id, email: user.email ?? null } : null,
      async signIn(email, password) {
        if (!supabase) return
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw new Error(translateAuthError(error.message))
      },
      async signUp(email, password, displayName) {
        if (!supabase) return { needsConfirmation: false }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin },
        })
        if (error) throw new Error(translateAuthError(error.message))
        return { needsConfirmation: !data.session }
      },
      async signOut() {
        if (!supabase) return
        await supabase.auth.signOut()
      },
      async sendPasswordReset(email) {
        if (!supabase) return
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` })
        if (error) throw new Error(translateAuthError(error.message))
      },
      async updatePassword(password) {
        if (!supabase) return
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw new Error(translateAuthError(error.message))
        setRecovering(false)
      },
    }
  }, [mode, loading, session, recovering])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}
