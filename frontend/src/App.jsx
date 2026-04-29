import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/auth/Login'
import TicketQueue from './pages/support/TicketQueue'
import TicketDetail from './pages/support/TicketDetail'
import HILEscalation from './pages/support/HILEscalation'
import SDLCTracker from './pages/support/SDLCTracker'
import CommandCenter from './pages/support/CommandCenter'
import RBACDashboard from './pages/admin/RBACDashboard'
import SLAConfig from './pages/admin/SLAConfig'
import ProjectMonitor from './pages/admin/ProjectMonitor'
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard'
import CustomerPortal from './pages/portal/CustomerPortal'
import useAuthStore from './store/authStore'

function PrivateRoute({ children, requireAdmin = false }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (requireAdmin && user?.role !== 'Admin') return <Navigate to="/support/queue" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"  element={<Login />} />
        <Route path="/portal" element={<CustomerPortal />} />

        {/* Authenticated shell */}
        <Route
          path="/support"
          element={
            <PrivateRoute>
              <AppLayout title="Support Operations" />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="queue" replace />} />
          <Route path="queue"        element={<TicketQueue />} />
          <Route path="ticket/:ticketId" element={<TicketDetail />} />
          <Route path="escalation"   element={<HILEscalation />} />
          <Route path="sdlc"         element={<SDLCTracker />} />
          <Route path="commands"     element={<CommandCenter />} />
        </Route>

        <Route
          path="/admin"
          element={
            <PrivateRoute requireAdmin>
              <AppLayout title="Admin Control" />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="rbac" replace />} />
          <Route path="rbac" element={<RBACDashboard />} />
          <Route path="sla"  element={<SLAConfig />} />
          <Route path="monitor" element={<ProjectMonitor />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/support/queue" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
