// Página de apresentação pública (antes do login).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Brain,
  CalendarRange,
  Check,
  ChevronDown,
  ClipboardCheck,
  Headphones,
  Layers,
  Lock,
  RefreshCcw,
  Route,
  Smartphone,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react'
import { LogoMark, Wordmark } from '@/components/brand/Logo'
import { InstallAppButton } from '@/components/InstallApp'
import { useAuth } from '@/app/auth'
import { CAREER_TRAILS } from '@/content/trails'
import { cn } from '@/lib/cn'

/** Revela o conteúdo ao entrar na tela (respeita "reduzir movimento"). */
function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setShown(true)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={cn('transition-all duration-700 ease-out', shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

const FEATURES = [
  { icon: Timer, title: 'Cronômetro que não mente', text: 'Cronômetro, temporizador, Pomodoro e intervalos. Pausas ficam fora do tempo líquido, e o tempo continua certo mesmo se você fechar a aba ou recarregar a página.' },
  { icon: CalendarRange, title: 'Planejamento por horário', text: 'Agenda de 30 em 30 minutos: clique para criar, arraste para mover, puxe para mudar a duração. Gere a semana automaticamente pela sua disponibilidade.' },
  { icon: Route, title: 'Trilhas prontas', text: 'Concursos, professor, programação, dados, cloud, segurança e mais — matérias e tópicos na ordem certa, com fontes e pesos.' },
  { icon: RefreshCcw, title: 'Ciclo de estudos', text: 'Rodízio de matérias que só avança quando você estuda. Faltou um dia? Você não perde a posição.' },
  { icon: Layers, title: 'Flashcards com voz', text: 'Repetição espaçada, importação de CSV e leitura em voz alta no próprio aparelho — ótimo para revisar no trânsito.' },
  { icon: Brain, title: 'Revisões no momento certo', text: 'Revisões agendadas após cada estudo (1, 7 e 30 dias) e um painel com tudo que está pendente ou atrasado.' },
  { icon: ClipboardCheck, title: 'Questões e desempenho', text: 'Registre baterias de questões e veja a taxa de acertos por matéria, tópico e período — e o que precisa de atenção.' },
  { icon: BarChart3, title: 'Metas e relatórios', text: 'Horas por dia, semana e mês, sequência de dias, planejado × realizado e exportação em CSV ou JSON.' },
]

const FAQ = [
  { q: 'Serve só para concursos?', a: 'Não. Ele organiza qualquer objetivo de estudo: concursos, faculdade, certificações, carreira em tecnologia, idiomas ou o que você quiser aprender. Você cria suas matérias ou começa por uma trilha pronta.' },
  { q: 'Funciona no celular?', a: 'Sim. Abra no navegador do celular e instale como aplicativo (Android: “Instalar app”; iPhone: “Adicionar à Tela de Início”). Ele abre em tela cheia, com ícone próprio.' },
  { q: 'Meus dados ficam protegidos?', a: 'Cada conta só enxerga os próprios dados — a regra é aplicada no próprio banco de dados, não apenas na tela. Você pode exportar tudo a qualquer momento ou excluir sua conta.' },
  { q: 'Já tenho flashcards e anotações. Consigo trazer?', a: 'Sim. Flashcards entram por CSV, a estrutura de tópicos pode ser colada como texto indentado, e há importação completa em JSON.' },
  { q: 'O que é “tempo líquido”?', a: 'É o tempo que você realmente estudou: do início ao fim da sessão, descontando as pausas. É ele que alimenta metas, gráficos e relatórios.' },
]

export default function LandingPage() {
  const auth = useAuth()
  const inside = auth.mode === 'local' || Boolean(auth.user)
  const careers = CAREER_TRAILS.map((c) => ({ key: c.key, name: c.name, icon: c.icon, area: c.area }))
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const primaryCta = inside ? (
      <Link to="/" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brown px-6 text-base font-semibold text-wheat shadow-lg shadow-brown/20 transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-wheat dark:text-brown">
        Abrir o app <ArrowRight className="size-4" />
      </Link>
    ) : (
      <Link to="/cadastro" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brown px-6 text-base font-semibold text-wheat shadow-lg shadow-brown/20 transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-wheat dark:text-brown">
        Começar agora <ArrowRight className="size-4" />
      </Link>
    )

  return (
    <div className="min-h-full overflow-x-hidden bg-bg text-ink">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-40 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/inicio" className="flex items-center gap-2.5" aria-label="EVoLuMentaL Control">
            <LogoMark className="size-9" />
            <Wordmark />
          </Link>
          <nav className="ml-6 hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Seções">
            <a href="#recursos" className="hover:text-ink">
              Recursos
            </a>
            <a href="#como-funciona" className="hover:text-ink">
              Como funciona
            </a>
            <a href="#trilhas" className="hover:text-ink">
              Trilhas
            </a>
            <a href="#perguntas" className="hover:text-ink">
              Dúvidas
            </a>
          </nav>
          <span className="flex-1" />
          {inside ? (
            <Link to="/" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong">
              Abrir o app
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden h-10 items-center rounded-lg px-3 text-sm font-medium text-ink hover:bg-surface sm:inline-flex">
                Entrar
              </Link>
              <Link to="/cadastro" className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-strong">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-wheat/50 blur-3xl dark:bg-wheat/10" />
          <div className="absolute top-40 -right-40 size-96 rounded-full bg-accent/30 blur-3xl dark:bg-accent/10" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/60 bg-wheat/40 px-3 py-1 text-xs font-semibold text-brown dark:bg-wheat/10 dark:text-wheat">
              <Sparkles className="size-3.5" /> Seu estudo, sob controle
            </span>
            <h1 className="mt-5 text-4xl leading-[1.05] font-bold tracking-tight text-ink sm:text-5xl lg:text-6xl">
              Estude com método.
              <br />
              <span className="bg-gradient-to-r from-[#B98545] via-[#DEB887] to-[#B98545] bg-clip-text text-transparent">Evolua com dados.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              O EVoLuMentaL Control junta cronômetro, planejamento por horário, ciclo de estudos, trilhas prontas, flashcards com voz, revisões e
              relatórios em um só lugar — para concursos, faculdade, tecnologia, idiomas ou qualquer meta.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {primaryCta}
              {!inside && (
                <Link to="/login" className="inline-flex h-12 items-center rounded-xl border border-line bg-bg px-5 text-base font-medium text-ink transition hover:bg-surface">
                  Já tenho conta
                </Link>
              )}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {['Tempo líquido sem pausas', 'Funciona no celular', 'Seus dados exportáveis'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-4 text-success" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={150}>
            <AppPreview />
          </Reveal>
        </div>
      </section>

      {/* Para quem */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 text-sm font-medium text-muted sm:px-6">
          <span className="text-ink">Feito para quem estuda para:</span>
          {['Concursos públicos', 'Faculdade', 'Carreira em tecnologia', 'Certificações', 'Idiomas', 'Vestibular e ENEM'].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-accent-strong" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold tracking-widest text-accent-strong uppercase">Recursos</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Tudo que você precisa para estudar com constância</h2>
          <p className="mt-3 text-muted">Sem planilhas soltas, sem cinco aplicativos diferentes. Cada minuto estudado vira informação para você decidir o próximo passo.</p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90}>
              <div className="group h-full rounded-2xl border border-line bg-bg p-6 transition hover:-translate-y-1 hover:border-accent hover:shadow-lg hover:shadow-brown/5">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-wheat/60 text-brown transition group-hover:bg-accent dark:bg-wheat/15 dark:text-wheat dark:group-hover:text-brown">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="scroll-mt-20 bg-brown text-wheat">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="max-w-2xl">
            <p className="text-sm font-semibold tracking-widest text-accent uppercase">Como funciona</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">Três passos para sair do improviso</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { n: '01', icon: Route, t: 'Escolha o que estudar', d: 'Comece por uma trilha pronta (Auditor Fiscal, Polícia Federal, Professor, Analista de Dados, DevOps…) ou monte suas matérias e cole a estrutura de tópicos.' },
              { n: '02', icon: CalendarRange, t: 'Planeje sua semana', d: 'Informe seus horários livres e deixe o sistema distribuir os blocos pelo peso de cada matéria — ou arraste tudo na agenda do seu jeito.' },
              { n: '03', icon: Target, t: 'Estude e acompanhe', d: 'Inicie o cronômetro direto do bloco. Revisões, ciclo, metas e gráficos se atualizam sozinhos com o que você realmente fez.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <div className="relative h-full rounded-2xl border border-wheat/15 bg-white/5 p-6">
                  <span className="text-5xl font-bold text-accent/40">{s.n}</span>
                  <s.icon className="absolute top-6 right-6 size-6 text-accent" />
                  <h3 className="mt-3 text-lg font-semibold text-white">{s.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-wheat/75">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Destaques */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold tracking-widest text-accent-strong uppercase">Precisão</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Horas que você pode confiar</h2>
            <p className="mt-3 text-muted">O tempo é calculado pelos horários de início, pausa e fim — não por um contador que trava quando a aba dorme. Pausas ficam de fora, sessões canceladas não contam e lançamentos manuais não podem se sobrepor.</p>
            <ul className="mt-6 space-y-3">
              {['Sessão continua certa depois de recarregar ou trocar de aba', 'Uma sessão ativa por conta — sem horas duplicadas', 'Ajustes ficam registrados na própria sessão'].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-ink">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15">
                    <Check className="size-3.5 text-success" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120}>
            <div className="grid gap-4 sm:grid-cols-2">
              <HighlightCard icon={Headphones} title="Revise ouvindo" text="Os flashcards leem pergunta e resposta em voz alta, com voz em português do seu aparelho." />
              <HighlightCard icon={Smartphone} title="App no celular" text="Instale direto pelo navegador, sem loja. Abre em tela cheia com ícone próprio." />
              <HighlightCard icon={Lock} title="Dados protegidos" text="Cada conta só acessa os próprios dados. Exporte tudo quando quiser." />
              <HighlightCard icon={Sparkles} title="Tema claro e escuro" text="Visual limpo e acolhedor, pensado para longas horas de estudo." />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Trilhas */}
      <section id="trilhas" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold tracking-widest text-accent-strong uppercase">Trilhas prontas</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{careers.length} carreiras para começar em um clique</h2>
            <p className="mt-3 text-muted">Matérias e tópicos na ordem de estudo, com pesos baseados em editais e roteiros de mercado — e o ciclo de estudos montado automaticamente.</p>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10 flex flex-wrap justify-center gap-2.5">
              {careers.map((c) => (
                <span key={c.key} className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-4 py-2 text-sm font-medium text-ink shadow-sm">
                  <span aria-hidden>{c.icon}</span> {c.name}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section id="perguntas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
        <Reveal className="text-center">
          <p className="text-sm font-semibold tracking-widest text-accent-strong uppercase">Dúvidas</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Perguntas frequentes</h2>
        </Reveal>
        <div className="mt-10 divide-y divide-line rounded-2xl border border-line bg-bg">
          {FAQ.map((f, i) => {
            const open = openFaq === i
            return (
              <div key={f.q}>
                <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium text-ink" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                  {f.q}
                  <ChevronDown className={cn('size-5 shrink-0 text-muted transition-transform', open && 'rotate-180')} />
                </button>
                {open && <p className="animate-fade-in px-5 pb-5 text-sm leading-relaxed text-muted">{f.a}</p>}
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-20 sm:px-6">
        <Reveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-brown px-6 py-14 text-center sm:px-12">
            <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-accent/25 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -right-24 -bottom-24 size-72 rounded-full bg-wheat/20 blur-3xl" aria-hidden />
            <LogoMark variant="plain" className="relative mx-auto size-16" />
            <h2 className="relative mt-5 text-3xl font-bold tracking-tight text-white sm:text-4xl">Sua evolução começa no próximo bloco de estudo.</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-wheat/80">Crie sua conta, escolha uma trilha e veja seu planejamento da semana pronto em minutos.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              {inside ? (
                <Link to="/" className="inline-flex h-12 items-center gap-2 rounded-xl bg-wheat px-6 font-semibold text-brown transition hover:-translate-y-0.5">
                  Abrir o app <ArrowRight className="size-4" />
                </Link>
              ) : (
                <>
                  <Link to="/cadastro" className="inline-flex h-12 items-center gap-2 rounded-xl bg-wheat px-6 font-semibold text-brown transition hover:-translate-y-0.5">
                    Criar minha conta <ArrowRight className="size-4" />
                  </Link>
                  <Link to="/login" className="inline-flex h-12 items-center rounded-xl border border-wheat/30 px-6 font-medium text-wheat hover:bg-white/5">
                    Entrar
                  </Link>
                </>
              )}
            </div>
            <div className="relative mt-6 flex justify-center [&_button]:border-wheat/30 [&_button]:text-wheat [&_button:hover]:bg-white/5">
              <InstallAppButton variant="ghost" size="sm" />
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:px-6">
          <span className="flex items-center gap-2">
            <LogoMark className="size-6" /> EVoLuMentaL Control · Evolução, disciplina e tempo
          </span>
          <span className="flex gap-4">
            <Link to="/login" className="hover:text-ink">
              Entrar
            </Link>
            <Link to="/cadastro" className="hover:text-ink">
              Criar conta
            </Link>
          </span>
        </div>
      </footer>
    </div>
  )
}

function HighlightCard({ icon: Icon, title, text }: { icon: typeof Timer; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-bg p-5">
      <Icon className="size-6 text-accent-strong" />
      <h3 className="mt-3 font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  )
}

/** Ilustração do app (decorativa, montada em HTML/CSS). */
function AppPreview() {
  const blocks = [
    { day: 0, top: 0, h: 2, c: '#2A78D6', t: 'Português' },
    { day: 0, top: 3, h: 2, c: '#E34948', t: 'Dir. Tributário' },
    { day: 1, top: 1, h: 3, c: '#1BAF7A', t: 'Estatística' },
    { day: 2, top: 0, h: 2, c: '#EDA100', t: 'Power BI' },
    { day: 2, top: 2, h: 2, c: '#6250D6', t: 'Python' },
    { day: 3, top: 1, h: 2, c: '#E87BA4', t: 'Literatura' },
    { day: 3, top: 4, h: 1, c: '#2A78D6', t: 'Revisão' },
    { day: 4, top: 0, h: 3, c: '#EB6834', t: 'SQL' },
  ]
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden>
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-wheat/70 via-transparent to-accent/40 blur-2xl dark:from-wheat/10 dark:to-accent/10" />
      <div className="relative rotate-1 rounded-2xl border border-line bg-bg p-4 shadow-2xl shadow-brown/15 transition duration-500 hover:rotate-0">
        <div className="mb-3 flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#E34948]/70" />
          <span className="size-2.5 rounded-full bg-[#EDA100]/70" />
          <span className="size-2.5 rounded-full bg-[#1BAF7A]/70" />
          <span className="ml-3 text-xs font-semibold text-muted">Planejamento · semana</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-[10px] font-semibold text-muted">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((d) => (
            <span key={d} className="text-center">
              {d}
            </span>
          ))}
        </div>
        <div className="relative mt-1.5 grid h-48 grid-cols-5 gap-1.5">
          {[0, 1, 2, 3, 4].map((d) => (
            <div key={d} className="relative rounded-lg bg-surface">
              {blocks
                .filter((b) => b.day === d)
                .map((b) => (
                  <div
                    key={b.t + b.top}
                    className="absolute inset-x-1 overflow-hidden rounded-md border-l-[3px] px-1 py-0.5 text-[9px] leading-tight font-semibold text-ink"
                    style={{ top: `${b.top * 18 + 4}px`, height: `${b.h * 18 - 3}px`, background: `color-mix(in srgb, ${b.c} 24%, var(--bg))`, borderColor: b.c }}
                  >
                    {b.t}
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-10 -left-4 w-44 -rotate-3 rounded-2xl border border-line bg-bg p-4 shadow-xl shadow-brown/15 sm:-left-10">
        <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">Foco 2</p>
        <div className="relative mx-auto mt-2 flex size-24 items-center justify-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--border)" strokeWidth="6" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent-strong)" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 44} strokeDashoffset={2 * Math.PI * 44 * 0.32} />
          </svg>
          <span className="tabular text-lg font-bold text-ink">17:04</span>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted">Pomodoro · Estatística</p>
      </div>
      <div className="absolute -top-8 -right-2 w-40 rotate-3 rounded-2xl border border-line bg-bg p-3 shadow-xl shadow-brown/15 sm:-right-8">
        <p className="text-[10px] font-semibold tracking-wide text-muted uppercase">Esta semana</p>
        <div className="mt-2 flex h-14 items-end gap-1">
          {[40, 65, 50, 85, 70, 30, 55].map((h, i) => (
            <span key={i} className="flex-1 rounded-t-sm bg-accent-strong" style={{ height: `${h}%`, opacity: i === 3 ? 1 : 0.55 }} />
          ))}
        </div>
        <p className="mt-1.5 text-[10px] text-muted">Constância diária</p>
      </div>
    </div>
  )
}
