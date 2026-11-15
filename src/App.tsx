import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppShell } from '@/layout/AppShell'
import { ClubCourtsPage } from '@/pages/admin/ClubCourtsPage'
import { ClubOverviewPage } from '@/pages/admin/ClubOverviewPage'
import { DayTemplatesPage } from '@/pages/admin/DayTemplatesPage'
import { BookingHistoryPage } from '@/pages/BookingHistoryPage'
import { ClubsPage } from '@/pages/ClubsPage'
import { CourtsPage } from '@/pages/CourtsPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { PlayersPage } from '@/pages/PlayersPage'
import { StartPage } from '@/pages/StartPage'
import {
  RequireClubWorkspace,
  RequirePlayerWorkspace,
  RequireScheduleRole,
  RequireWorkspace,
} from '@/workspace/guards'
import { WorkspaceProvider } from '@/workspace/WorkspaceProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

/** Every route, with the guards (exported so tests can mount it in a memory router). */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        {/* After signing in: act as a player, or with a club role (one club at a time). */}
        <Route path="/start" element={<StartPage />} />
        <Route element={<RequireWorkspace />}>
          <Route element={<AppShell />}>
            <Route element={<RequirePlayerWorkspace />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/clubs" element={<ClubsPage />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/courts" element={<CourtsPage />} />
              <Route path="/bookings" element={<BookingHistoryPage />} />
            </Route>
            <Route element={<RequireClubWorkspace />}>
              <Route path="/manage" element={<ClubOverviewPage />} />
              <Route element={<RequireScheduleRole />}>
                <Route path="/manage/courts" element={<ClubCourtsPage />} />
                <Route path="/manage/day-templates" element={<DayTemplatesPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
