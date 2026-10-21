import { lazy, useState, type ReactNode } from 'react'
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
const TrailsPage = lazy(() => import('@/pages/trails/TrailsPage'))
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
              <Routes>
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
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </ToastProvider>
      </DataProvider>
    </AuthProvider>
  )
}
