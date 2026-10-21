import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { useAuth } from '@/app/auth'

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-16" />
          <p className="mt-4 text-xl font-bold tracking-tight text-ink">EVoLuMentaL Control</p>
          <p className="mt-1 text-xs tracking-[0.2em] text-muted uppercase">Evolução · Disciplina · Tempo</p>
        </div>
        <div className="rounded-2xl border border-line bg-bg p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  )
}

const email = z.string().trim().email('Informe um e-mail válido.')
const password = z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.').max(72, 'Máximo de 72 caracteres.')

function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  )
}

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (auth.mode === 'local' || auth.user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = z.object({ email, password: z.string().min(1, 'Informe a senha.') }).safeParse(form)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    setError(null)
    try {
      await auth.signIn(parsed.data.email, parsed.data.password)
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse seu controle de estudos."
      footer={
        <>
          Não tem conta?{' '}
          <Link to="/cadastro" className="font-medium text-ink underline underline-offset-2">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <Field label="E-mail">{(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />}</Field>
        <Field label="Senha">
          {(id) => <Input id={id} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />}
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          Entrar
        </Button>
        <Link to="/recuperar-senha" className="text-center text-sm text-muted underline-offset-2 hover:underline">
          Esqueci minha senha
        </Link>
      </form>
    </AuthLayout>
  )
}

export function SignUpPage() {
  const auth = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  if (auth.mode === 'local' || auth.user) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = z
      .object({ name: z.string().trim().min(1, 'Informe seu nome.').max(120), email, password, confirm: z.string() })
      .refine((v) => v.password === v.confirm, { message: 'As senhas não coincidem.' })
      .safeParse(form)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    setError(null)
    try {
      const r = await auth.signUp(parsed.data.email, parsed.data.password, parsed.data.name)
      if (r.needsConfirmation) setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <AuthLayout title="Confirme seu e-mail" subtitle="Enviamos um link de confirmação. Depois de confirmar, volte e entre." footer={<Link to="/login" className="font-medium text-ink underline">Ir para o login</Link>}>
        <p className="text-sm text-muted">Não recebeu? Verifique a caixa de spam.</p>
      </AuthLayout>
    )

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Organize matérias, tempo e revisões em um só lugar."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-ink underline underline-offset-2">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <Field label="Nome">{(id) => <Input id={id} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label="E-mail">{(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres.">
          {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        </Field>
        <Field label="Confirmar senha">
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />}
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  )
}

export function ForgotPasswordPage() {
  const auth = useAuth()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  if (auth.mode === 'local') return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = email.safeParse(value)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    setError(null)
    try {
      await auth.sendPasswordReset(parsed.data)
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Recuperar senha" subtitle="Enviaremos um link para redefinir sua senha." footer={<Link to="/login" className="underline">Voltar ao login</Link>}>
      {sent ? (
        <p role="status" className="text-sm text-ink">
          Se existir uma conta com este e-mail, você receberá o link em instantes.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormError message={error} />
          <Field label="E-mail">{(id) => <Input id={id} type="email" autoComplete="email" value={value} onChange={(e) => setValue(e.target.value)} />}</Field>
          <Button type="submit" variant="primary" loading={busy} className="w-full">
            Enviar link
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}

export function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (auth.mode === 'local') return <Navigate to="/" replace />
  if (!auth.loading && !auth.user)
    return (
      <AuthLayout title="Link inválido ou expirado" footer={<Link to="/recuperar-senha" className="underline">Solicitar novo link</Link>}>
        <p className="text-sm text-muted">Abra o link mais recente enviado ao seu e-mail.</p>
      </AuthLayout>
    )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const parsed = z
      .object({ password, confirm: z.string() })
      .refine((v) => v.password === v.confirm, { message: 'As senhas não coincidem.' })
      .safeParse(form)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    setError(null)
    try {
      await auth.updatePassword(parsed.data.password)
      navigate('/')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Definir nova senha">
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError message={error} />
        <Field label="Nova senha" hint="Mínimo de 8 caracteres.">
          {(id, d) => <Input id={id} aria-describedby={d} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}
        </Field>
        <Field label="Confirmar nova senha">
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />}
        </Field>
        <Button type="submit" variant="primary" loading={busy} className="w-full">
          Salvar senha
        </Button>
      </form>
    </AuthLayout>
  )
}
