import { Suspense, lazy, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { DataProvider, makeQueryClient } from './data'
import { AppShell } from './AppShell'
import { ConfirmProvider, Spinner, ToastProvider } from '@/components/ui/feedback'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignUpPage } from '@/pages/auth/AuthPages'

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const WorkspacePage = lazy(() => import('@/pages/workspace/WorkspacePage'))
const ExplorerPage = lazy(() => import('@/features/explorer/ExplorerPage'))
const TimerPage = lazy(() => import('@/pages/timer/TimerPage'))
const SchedulePage = lazy(() => import('@/pages/schedule/SchedulePage'))
const CyclesPage = lazy(() => import('@/pages/cycles/CyclesPage'))
const CalendarPage = lazy(() => import('@/pages/calendar/CalendarPage'))
const DecksPage = lazy(() => import('@/pages/flashcards/DecksPage'))
const DeckDetailPage = lazy(() => import('@/pages/flashcards/DeckDetailPage'))
const StudyCardsPage = lazy(() => import('@/pages/flashcards/StudyCardsPage'))
const MindMapsPage = lazy(() => import('@/pages/mindmaps/MindMapsPage'))
const MindMapEditorPage = lazy(() => import('@/pages/mindmaps/MindMapEditorPage'))
const ReviewsPage = lazy(() => import('@/pages/reviews/ReviewsPage'))
const QuestionsPage = lazy(() => import('@/pages/questions/QuestionsPage'))
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage'))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'))
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'))
const TrailsPage = lazy(() => import('@/pages/trails/TrailsPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const EvoQuestHome = lazy(() => import('@/pages/evoquest/EvoQuestHome'))
const WorldPage = lazy(() => import('@/features/evoquest/WorldPage'))
const EvoSubjectPage = lazy(() => import('@/pages/evoquest/SubjectPage'))
const EvoLessonPage = lazy(() => import('@/pages/evoquest/LessonPage'))
const EvoPlayPage = lazy(() => import('@/pages/evoquest/PlayPage'))
const EvoModePickPage = lazy(() => import('@/pages/evoquest/ModePickPage'))
const EvoLabPage = lazy(() => import('@/pages/evoquest/LabPage'))
const EvoLabListPage = lazy(() => import('@/pages/evoquest/LabPage').then((m) => ({ default: m.LabListPage })))
const EvoMissionsPage = lazy(() => import('@/pages/evoquest/MissionsPage'))
const EvoProfilePage = lazy(() => import('@/pages/evoquest/ProfilePage'))
const EvoHistoryPage = lazy(() => import('@/pages/evoquest/HistoryPage'))
const EvoCardsPage = lazy(() => import('@/pages/evoquest/CardsPage'))

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading) return <Spinner label="Verificando sessão…" className="min-h-screen" />
  if (auth.mode === 'supabase' && auth.recovering) return <Navigate to="/redefinir-senha" replace />
  if (!auth.user) return <Navigate to="/inicio" replace state={{ from: location.pathname }} />
  return <>{children}</>
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
                <Route path="/inicio" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/cadastro" element={<SignUpPage />} />
                <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
                <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
                {/* O mundo do EvoQuest ocupa a tela toda, fora do layout do Control. */}
                <Route
                  path="/evoquest"
                  element={
                    <RequireAuth>
                      <WorldPage />
                    </RequireAuth>
                  }
                />
                <Route
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="espaco" element={<WorkspacePage />} />
                  <Route path="materias" element={<ExplorerPage />} />
                  <Route path="materias/pasta/:folderId" element={<ExplorerPage />} />
                  <Route path="materias/:subjectId" element={<ExplorerPage />} />
                  <Route path="materias/:subjectId/topico/:topicId" element={<ExplorerPage />} />
                  <Route path="trilhas" element={<TrailsPage />} />
                  <Route path="cronometro" element={<TimerPage />} />
                  <Route path="cronograma" element={<SchedulePage />} />
                  <Route path="ciclos" element={<CyclesPage />} />
                  <Route path="calendario" element={<CalendarPage />} />
                  <Route path="flashcards" element={<DecksPage />} />
                  <Route path="flashcards/revisar" element={<StudyCardsPage />} />
                  <Route path="flashcards/:id" element={<DeckDetailPage />} />
                  <Route path="mapas" element={<MindMapsPage />} />
                  <Route path="mapas/:id" element={<MindMapEditorPage />} />
                  <Route path="revisoes" element={<ReviewsPage />} />
                  <Route path="questoes" element={<QuestionsPage />} />
                  <Route path="metas" element={<GoalsPage />} />
                  <Route path="relatorios" element={<ReportsPage />} />
                  <Route path="configuracoes" element={<SettingsPage />} />
                  <Route path="evoquest/treino" element={<EvoQuestHome />} />
                  <Route path="evoquest/jogar" element={<EvoPlayPage />} />
                  <Route path="evoquest/revisao" element={<EvoModePickPage mode="review" />} />
                  <Route path="evoquest/relogio" element={<EvoModePickPage mode="time_attack" />} />
                  <Route path="evoquest/laboratorio" element={<EvoLabListPage />} />
                  <Route path="evoquest/laboratorio/:id" element={<EvoLabPage />} />
                  <Route path="evoquest/missoes" element={<EvoMissionsPage />} />
                  <Route path="evoquest/perfil" element={<EvoProfilePage />} />
                  <Route path="evoquest/historico" element={<EvoHistoryPage />} />
                  <Route path="evoquest/cartoes" element={<EvoCardsPage />} />
                  <Route path="evoquest/:subject" element={<EvoSubjectPage />} />
                  <Route path="evoquest/:subject/licao/:unit" element={<EvoLessonPage />} />
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
