import { Suspense, lazy, useState, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { DataProvider, makeQueryClient } from './data'
import { AppShell } from './AppShell'
import { ConfirmProvider, Spinner, ToastProvider } from '@/components/ui/feedback'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignUpPage } from '@/pages/auth/AuthPages'

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const WorkspacePage = lazy(() => import('@/pages/workspace/WorkspacePage'))
const SubjectsPage = lazy(() => import('@/pages/subjects/SubjectsPage'))
const SubjectDetailPage = lazy(() => import('@/pages/subjects/SubjectDetailPage'))
const TimerPage = lazy(() => import('@/pages/timer/TimerPage'))
const CalendarPage = lazy(() => import('@/pages/calendar/CalendarPage'))
const DecksPage = lazy(() => import('@/pages/flashcards/DecksPage'))
const DeckDetailPage = lazy(() => import('@/pages/flashcards/DeckDetailPage'))
const StudyCardsPage = lazy(() => import('@/pages/flashcards/StudyCardsPage'))
const ReviewsPage = lazy(() => import('@/pages/reviews/ReviewsPage'))
const QuestionsPage = lazy(() => import('@/pages/questions/QuestionsPage'))
const QuestionBankPage = lazy(() => import('@/pages/questions/QuestionBankPage'))
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage'))
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'))
const TrailsPage = lazy(() => import('@/pages/trails/TrailsPage'))
const RoutinesPage = lazy(() => import('@/pages/routines/RoutinesPage'))
const EnglishPage = lazy(() => import('@/pages/english/EnglishPage'))
const AudiosPage = lazy(() => import('@/pages/audios/AudiosPage'))
const LibraryPage = lazy(() => import('@/pages/library/LibraryPage'))
const ReaderPage = lazy(() => import('@/pages/library/ReaderPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()
  if (auth.loading) return <Spinner label="Verificando sessão…" className="min-h-screen" />
  if (auth.mode === 'supabase' && auth.recovering) return <Navigate to="/redefinir-senha" replace />
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
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
                  <Route index element={<DashboardPage />} />
                  <Route path="espaco" element={<WorkspacePage />} />
                  <Route path="materias" element={<SubjectsPage />} />
                  <Route path="materias/:id" element={<SubjectDetailPage />} />
                  <Route path="trilhas" element={<TrailsPage />} />
                  <Route path="rotinas" element={<RoutinesPage />} />
                  <Route path="cronometro"element={<TimerPage />} />
                  <Route path="cronograma" element={<Navigate to="/calendario?modo=cronograma" replace />} />
                  <Route path="ciclos" element={<Navigate to="/calendario?modo=ciclo" replace />} />
                  <Route path="calendario" element={<CalendarPage />} />
                  <Route path="ingles" element={<EnglishPage />} />
                  <Route path="audios" element={<AudiosPage />} />
                  <Route path="biblioteca" element={<LibraryPage />} />
                  <Route path="biblioteca/:id" element={<ReaderPage />} />
                  <Route path="flashcards" element={<DecksPage />} />
                  <Route path="flashcards/revisar" element={<StudyCardsPage />} />
                  <Route path="flashcards/:id" element={<DeckDetailPage />} />
                  <Route path="revisoes" element={<ReviewsPage />} />
                  <Route path="questoes" element={<QuestionsPage />} />
                  <Route path="banco-de-questoes" element={<QuestionBankPage />} />
                  <Route path="metas" element={<GoalsPage />} />
                  <Route path="relatorios" element={<ReportsPage />} />
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
