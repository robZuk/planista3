import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CurriculumPage } from '@/pages/CurriculumPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { GroupsPage } from '@/pages/GroupsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/curriculum"
              element={
                <ProtectedRoute roles={['ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR']}>
                  <CurriculumPage />
                </ProtectedRoute>
              }
            />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route
              path="/groups"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <GroupsPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
