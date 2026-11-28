import { Suspense, lazy, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { DataProvider, makeQueryClient } from './data'
import { AppShell } from './AppShell'
import { ConfirmProvider, Spinner, ToastProvider } from '@/components/ui/feedback'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignUpPage } from '@/pages/auth/AuthPages'

// Planejamento e revisões
const PlanningPage = lazy(() => import('@/pages/planning/PlanningPage'))
const ReviewsPage = lazy(() => import('@/pages/reviews/ReviewsPage'))
const CyclePage = lazy(() => import('@/pages/cycles/CyclePage'))
const SubjectsPage = lazy(() => import('@/pages/subjects/SubjectsPage'))
const SubjectDetailPage = lazy(() => import('@/pages/subjects/SubjectDetailPage'))
const DecksPage = lazy(() => import('@/pages/flashcards/DecksPage'))
const DeckDetailPage = lazy(() => import('@/pages/flashcards/DeckDetailPage'))
const StudyCardsPage = lazy(() => import('@/pages/flashcards/StudyCardsPage'))
// Cursos e livros
const LibraryPage = lazy(() => import('@/pages/library/LibraryPage'))
const ReaderPage = lazy(() => import('@/pages/library/ReaderPage'))
const CoursesPage = lazy(() => import('@/pages/courses/CoursesPage'))
const CourseFolderPage = lazy(() => import('@/pages/courses/CourseFolderPage'))
const CoursePage = lazy(() => import('@/pages/courses/CoursePage'))
const CoursePdfReaderPage = lazy(() => import('@/pages/courses/CoursePdfReaderPage'))
const AudiosPage = lazy(() => import('@/pages/audios/AudiosPage'))
const VideosPage = lazy(() => import('@/pages/videos/VideosPage'))
// Cadernos
const NotebooksHomePage = lazy(() => import('@/pages/notebooks/NotebooksHomePage'))
const NotebookWorkspacePage = lazy(() => import('@/pages/notebooks/NotebookWorkspacePage'))
const NotebooksFavoritesPage = lazy(() => import('@/pages/notebooks/NotebooksSubPages').then((m) => ({ default: m.NotebooksFavoritesPage })))
const NotebooksRecentPage = lazy(() => import('@/pages/notebooks/NotebooksSubPages').then((m) => ({ default: m.NotebooksRecentPage })))
const NotebooksConnectionsPage = lazy(() => import('@/pages/notebooks/NotebooksSubPages').then((m) => ({ default: m.NotebooksConnectionsPage })))
const NotebooksTrashPage = lazy(() => import('@/pages/notebooks/NotebooksSubPages').then((m) => ({ default: m.NotebooksTrashPage })))
// Sessões e evolução
const StudyRoomPage = lazy(() => import('@/pages/timer/StudyRoomPage'))
const SessionHistoryPage = lazy(() => import('@/pages/timer/SessionHistoryPage'))
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage'))
const EvolutionPage = lazy(() => import('@/pages/reports/EvolutionPage'))
const WeeklyReportPage = lazy(() => import('@/pages/reports/WeeklyReportPage'))
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
                    {/* Planejamento */}
                    <Route index element={<PlanningPage />} />
                    <Route path="revisoes" element={<ReviewsPage />} />
                    <Route path="ciclos" element={<CyclePage />} />
                    <Route path="calendario" element={<Navigate to="/" replace />} />
                    <Route path="cronograma" element={<Navigate to="/" replace />} />
                    <Route path="espaco" element={<Navigate to="/" replace />} />

                    {/* Matérias e revisões pessoais */}
                    <Route path="materias" element={<SubjectsPage />} />
                    <Route path="materias/:id" element={<SubjectDetailPage />} />
                    <Route path="flashcards" element={<DecksPage />} />
                    <Route path="flashcards/revisar" element={<StudyCardsPage />} />
                    <Route path="flashcards/:id" element={<DeckDetailPage />} />

                    {/* Livros e cursos */}
                    <Route path="biblioteca" element={<LibraryPage />} />
                    <Route path="livros" element={<Navigate to="/biblioteca" replace />} />
                    <Route path="livros/:id" element={<ReaderPage />} />
                    {/* endereços antigos da estante (links salvos) continuam abrindo o leitor */}
                    <Route path="biblioteca/:id" element={<ReaderPage />} />
                    <Route path="cursos" element={<CoursesPage />} />
                    <Route path="cursos/pastas/:key" element={<CourseFolderPage />} />
                    <Route path="cursos/:id" element={<CoursePage />} />
                    <Route path="cursos/:id/pdf/:itemId" element={<CoursePdfReaderPage />} />
                    <Route path="audios" element={<AudiosPage />} />
                    <Route path="videos" element={<VideosPage />} />

                    {/* Cadernos */}
                    <Route path="cadernos" element={<NotebooksHomePage />} />
                    <Route path="cadernos/favoritos" element={<NotebooksFavoritesPage />} />
                    <Route path="cadernos/recentes" element={<NotebooksRecentPage />} />
                    <Route path="cadernos/conexoes" element={<NotebooksConnectionsPage />} />
                    <Route path="cadernos/lixeira" element={<NotebooksTrashPage />} />
                    <Route path="cadernos/:notebookId" element={<NotebookWorkspacePage />} />
                    <Route path="cadernos/:notebookId/pagina/:pageId" element={<NotebookWorkspacePage />} />

                    {/* Sala e evolução */}
                    <Route path="sala" element={<StudyRoomPage />} />
                    <Route path="sala/historico" element={<SessionHistoryPage />} />
                    <Route path="cronometro" element={<Redirect to="/sala" />} />

                    <Route path="metas" element={<GoalsPage />} />
                    <Route path="evolucao" element={<EvolutionPage />} />
                    <Route path="relatorio-semanal" element={<WeeklyReportPage />} />
                    <Route path="relatorios" element={<Navigate to="/evolucao" replace />} />

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
