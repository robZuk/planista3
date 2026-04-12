import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { CurriculumPage } from '@/pages/CurriculumPage'
import { SchedulePage } from '@/pages/SchedulePage'
import { GroupsPage } from '@/pages/GroupsPage'
import { InstructorsPage } from '@/pages/InstructorsPage'
import { BuildingsPage } from '@/pages/BuildingsPage'
import { FacultiesPage } from '@/pages/FacultiesPage'

// Inicjalizuj motyw przed pierwszym renderem — zapobiega miganiu
const stored = localStorage.getItem('theme')
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
if (stored === 'dark' || (!stored && prefersDark)) {
  document.documentElement.classList.add('dark')
}

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
      <Toaster richColors position="top-right" />
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
            <Route
              path="/instructors"
              element={
                <ProtectedRoute roles={['ADMIN', 'DEAN_OFFICE', 'INSTRUCTOR']}>
                  <InstructorsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/buildings"
              element={
                <ProtectedRoute roles={['ADMIN', 'DEAN_OFFICE']}>
                  <BuildingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/faculties"
              element={
                <ProtectedRoute roles={['ADMIN', 'DEAN_OFFICE']}>
                  <FacultiesPage />
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
