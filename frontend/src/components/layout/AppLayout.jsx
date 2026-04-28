import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import useAuthStore from '../../store/authStore'

export default function AppLayout({ title = 'CSAgent', requireAdmin = false }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (requireAdmin && user?.role !== 'Admin') return <Navigate to="/support/queue" replace />

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <TopBar title={title} />
        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
