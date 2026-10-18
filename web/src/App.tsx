import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider, RequireAdmin, RequireAuth, RequireFreshPassword } from './auth'
import { AppShell } from './components/AppShell'
import { TooltipProvider } from './components/ui/tooltip'
import { ConfirmProvider } from './hooks/useConfirm'
import { FavoritesPage, MyWorkPage, OverduePage } from './pages/HomePages'
import { OverviewPage } from './pages/OverviewPage'
import { BrandPage } from './pages/BrandPage'
import { BrandsPage } from './pages/BrandsPage'
import { HostEntityPage } from './pages/HostEntityPage'
import { InboxPage } from './pages/InboxPage'
import { ListPage } from './pages/ListPage'
import { BoardsPage } from './pages/boards/BoardsPage'
import { BoardPage } from './pages/boards/BoardPage'
import { BoardSettingsPage } from './pages/boards/BoardSettingsPage'
import { BoardBacklogPage } from './pages/boards/BoardBacklogPage'
import { BoardReportsPage } from './pages/boards/BoardReportsPage'
import { BrowsePage } from './pages/BrowsePage'
import { LoginPage } from './pages/LoginPage'
import { ForcePasswordChangePage } from './pages/ForcePasswordChangePage'
import { MePage } from './pages/MePage'
import { PeoplePage } from './pages/PeoplePage'
import { SpacePage } from './pages/SpacePage'
import { TaskPage } from './pages/TaskPage'
import { UserPage } from './pages/UserPage'
import { StoreProvider } from './store'

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <TooltipProvider delayDuration={300}>
          <ConfirmProvider>
            <HashRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/change-password"
                  element={
                    <RequireAuth>
                      <ForcePasswordChangePage />
                    </RequireAuth>
                  }
                />
                <Route
                  element={
                    <RequireAuth>
                      <RequireFreshPassword>
                        <AppShell />
                      </RequireFreshPassword>
                    </RequireAuth>
                  }
                >
                  <Route path="/" element={<MyWorkPage />} />
                  <Route path="/me" element={<MePage />} />
                  <Route path="/overview" element={<OverviewPage />} />
                  <Route path="/week" element={<Navigate to="/overview" replace />} />
                  <Route
                    path="/people"
                    element={
                      <RequireAdmin>
                        <PeoplePage />
                      </RequireAdmin>
                    }
                  />
                  <Route path="/brands" element={<BrandsPage />} />
                  <Route path="/brands/:brandId" element={<BrandPage />} />
                  <Route path="/users/:userId" element={<UserPage />} />
                  <Route path="/overdue" element={<OverduePage />} />
                  <Route path="/inbox" element={<InboxPage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/spaces/:spaceId" element={<SpacePage />} />
                  <Route path="/lists/:listId" element={<ListPage />} />
                  <Route path="/boards" element={<BoardsPage />} />
                  <Route path="/boards/:boardId" element={<BoardPage />} />
                  <Route path="/boards/:boardId/settings" element={<BoardSettingsPage />} />
                  <Route path="/boards/:boardId/backlog" element={<BoardBacklogPage />} />
                  <Route path="/boards/:boardId/reports" element={<BoardReportsPage />} />
                  <Route path="/browse/:key" element={<BrowsePage />} />
                  <Route path="/tasks/:taskId" element={<TaskPage />} />
                  <Route path="/host/:entityType/:entityId" element={<HostEntityPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </HashRouter>
            <Toaster position="top-right" gap={12} offset={16} />
          </ConfirmProvider>
        </TooltipProvider>
      </StoreProvider>
    </AuthProvider>
  )
}
