import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { FavoritesPage, MyWorkPage, OverduePage, WeekPage } from './pages/HomePages'
import { InboxPage } from './pages/InboxPage'
import { ListPage } from './pages/ListPage'
import { SpacePage } from './pages/SpacePage'
import { TaskPage } from './pages/TaskPage'
import { StoreProvider } from './store'

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<MyWorkPage />} />
            <Route path="/week" element={<WeekPage />} />
            <Route path="/overdue" element={<OverduePage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/spaces/:spaceId" element={<SpacePage />} />
            <Route path="/lists/:listId" element={<ListPage />} />
            <Route path="/tasks/:taskId" element={<TaskPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
