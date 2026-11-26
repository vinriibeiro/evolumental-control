import { Suspense, lazy, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { DataProvider, makeQueryClient } from './data'
import { AppShell } from './AppShell'
import { ConfirmProvider, Spinner, ToastProvider } from '@/components/ui/feedback'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignUpPage } from '@/pages/auth/AuthPages'

// 1. Meu Planejamento
const PlanningPage = lazy(() => import('@/pages/planning/PlanningPage'))
const RoutinesPage = lazy(() => import('@/pages/routines/RoutinesPage'))
const ReviewsPage = lazy(() => import('@/pages/reviews/ReviewsPage'))
const CyclePage = lazy(() => import('@/pages/cycles/CyclePage'))
// 2. Trilhas de Estudo
const TrailsPage = lazy(() => import('@/pages/trails/DsTrailsPage'))
const DiagnosticPage = lazy(() => import('@/pages/trails/DiagnosticPage'))
const ProjectsPage = lazy(() => import('@/pages/trails/ProjectsPage'))
const CatalogPage = lazy(() => import('@/pages/trails/TrailsPage'))
const ChallengesPage = lazy(() => import('@/pages/challenges/ChallengesPage'))
const SubjectsPage = lazy(() => import('@/pages/subjects/SubjectsPage'))
const SubjectDetailPage = lazy(() => import('@/pages/subjects/SubjectDetailPage'))
const DecksPage = lazy(() => import('@/pages/flashcards/DecksPage'))
const DeckDetailPage = lazy(() => import('@/pages/flashcards/DeckDetailPage'))
const StudyCardsPage = lazy(() => import('@/pages/flashcards/StudyCardsPage'))
const QuestionBankPage = lazy(() => import('@/pages/questions/QuestionBankPage'))
const CguPlanPage = lazy(() => import('@/pages/cgu/CguPlanPage'))
const CguLessonPage = lazy(() => import('@/pages/cgu/CguLessonPage'))
// 3. Biblioteca
const LibraryPage = lazy(() => import('@/pages/library/LibraryPage'))
const ReaderPage = lazy(() => import('@/pages/library/ReaderPage'))
const CoursesPage = lazy(() => import('@/pages/courses/CoursesPage'))
const CoursePage = lazy(() => import('@/pages/courses/CoursePage'))
const CoursePdfReaderPage = lazy(() => import('@/pages/courses/CoursePdfReaderPage'))
const AudiosPage = lazy(() => import('@/pages/audios/AudiosPage'))
const VideosPage = lazy(() => import('@/pages/videos/VideosPage'))
// 4. Sala de Estudos
const StudyRoomPage = lazy(() => import('@/pages/timer/StudyRoomPage'))
const SessionHistoryPage = lazy(() => import('@/pages/timer/SessionHistoryPage'))
// 5. Metas e Evolução
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage'))
const EvolutionPage = lazy(() => import('@/pages/reports/EvolutionPage'))
const WeeklyReportPage = lazy(() => import('@/pages/reports/WeeklyReportPage'))
const QuestionsPage = lazy(() => import('@/pages/questions/QuestionsPage'))
// 6. Configurações
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading) return <Spinner label="Verificando sessão…" className="min-h-screen" />
  if (auth.mode === 'supabase' && auth.recovering) return <Navigate to="/redefinir-senha" replace />
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

/** Endereços antigos continuam funcionando: redireciona mantendo os parâmetros (ex.: /cronometro?bloco=…). */
function Redirect({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={to + search} replace />
}

export function App() {
  const [client] = useState(makeQueryClient)
  return (
    <AuthProvider>
      <DataProvider client={client}>
        <ToastProvider>
          <ConfirmProvider>
            <BrowserRouter>
              <Suspense fallback={<Spinner className="min-h-screen" />}>
                <Routes>
                  <Route path="/inicio" element={<Navigate to="/login" replace />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/cadastro" element={<SignUpPage />} />
                  <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
                  <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
                  <Route
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    {/* 1. Meu Planejamento */}
                    <Route index element={<PlanningPage />} />
                    <Route path="rotinas" element={<RoutinesPage />} />
                    <Route path="revisoes" element={<ReviewsPage />} />
                    <Route path="ciclos" element={<CyclePage />} />
                    <Route path="calendario" element={<Navigate to="/" replace />} />
                    <Route path="cronograma" element={<Navigate to="/" replace />} />
                    <Route path="espaco" element={<Navigate to="/" replace />} />

                    {/* 2. Trilhas de Estudo */}
                    <Route path="trilhas" element={<TrailsPage />} />
                    <Route path="diagnostico/:track" element={<DiagnosticPage />} />
                    <Route path="projetos" element={<ProjectsPage />} />
                    <Route path="laboratorio" element={<ChallengesPage />} />
                    <Route path="banco-de-questoes/desafios" element={<Redirect to="/laboratorio" />} />
                    <Route path="catalogo" element={<CatalogPage />} />
                    <Route path="materias" element={<SubjectsPage />} />
                    <Route path="materias/:id" element={<SubjectDetailPage />} />
                    <Route path="flashcards" element={<DecksPage />} />
                    <Route path="flashcards/revisar" element={<StudyCardsPage />} />
                    <Route path="flashcards/:id" element={<DeckDetailPage />} />
                    <Route path="banco-de-questoes" element={<QuestionBankPage />} />
                    <Route path="cgu" element={<CguPlanPage />} />
                    <Route path="cgu/aula/:taskId" element={<CguLessonPage />} />

                    {/* 3. Biblioteca */}
                    <Route path="biblioteca" element={<LibraryPage />} />
                    <Route path="livros" element={<Navigate to="/biblioteca" replace />} />
                    <Route path="livros/:id" element={<ReaderPage />} />
                    {/* endereços antigos da estante (links salvos) continuam abrindo o leitor */}
                    <Route path="biblioteca/:id" element={<ReaderPage />} />
                    <Route path="cursos" element={<CoursesPage />} />
                    <Route path="cursos/:id" element={<CoursePage />} />
                    <Route path="cursos/:id/pdf/:itemId" element={<CoursePdfReaderPage />} />
                    <Route path="audios" element={<AudiosPage />} />
                    <Route path="videos" element={<VideosPage />} />

                    {/* 4. Sala de Estudos */}
                    <Route path="sala" element={<StudyRoomPage />} />
                    <Route path="sala/historico" element={<SessionHistoryPage />} />
                    <Route path="cronometro" element={<Redirect to="/sala" />} />

                    {/* 5. Metas e Evolução */}
                    <Route path="metas" element={<GoalsPage />} />
                    <Route path="evolucao" element={<EvolutionPage />} />
                    <Route path="relatorio-semanal" element={<WeeklyReportPage />} />
                    <Route path="questoes" element={<QuestionsPage />} />
                    <Route path="relatorios" element={<Navigate to="/evolucao" replace />} />

                    {/* 6. Configurações */}
                    <Route path="configuracoes" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  )
}
