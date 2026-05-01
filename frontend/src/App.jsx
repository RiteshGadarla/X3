import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import TicketQueue from './pages/support/TicketQueue'
import TicketDetail from './pages/support/TicketDetail'
import HILEscalation from './pages/support/HILEscalation'
import SDLCTracker from './pages/support/SDLCTracker'
import CommandCenter from './pages/support/CommandCenter'
import KBArticles from './pages/support/KBArticles'
import RBACDashboard from './pages/admin/RBACDashboard'
import SLAConfig from './pages/admin/SLAConfig'
import ProjectMonitor from './pages/admin/ProjectMonitor'
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard'
import VPDashboard from './pages/admin/VPDashboard'
import CustomerPortal from './pages/portal/CustomerPortal'

export default function App() {
  return (
    <BrowserRouter basename="/luka-aegis-fe">
      <Routes>

        {/* ── Landing — role selector ─────────────────────── */}
        <Route path="/" element={<LandingPage />} />

        {/* ── Customer Portal ─────────────────────────────── */}
        <Route path="/customerportal" element={<CustomerPortal />} />

        {/* ── Admin (full access) ─────────────────────────── */}
        <Route path="/admin" element={<AppLayout title="Admin — CSAgent" />}>
          <Route index element={<Navigate to="queue" replace />} />
          <Route path="queue"      element={<TicketQueue />} />
          <Route path="ticket/:ticketId" element={<TicketDetail />} />
          <Route path="escalation" element={<HILEscalation />} />
          <Route path="sdlc"       element={<SDLCTracker />} />
          <Route path="kb"         element={<KBArticles />} />
          <Route path="commands"   element={<CommandCenter />} />
          <Route path="rbac"       element={<RBACDashboard />} />
          <Route path="sla"        element={<SLAConfig />} />
          <Route path="monitor"    element={<ProjectMonitor />} />
          <Route path="analytics"  element={<AnalyticsDashboard />} />
          <Route path="vp-view"    element={<VPDashboard />} />
        </Route>

        {/* ── Manager ─────────────────────────────────────── */}
        <Route path="/manager" element={<AppLayout title="Manager — CSAgent" />}>
          <Route index element={<Navigate to="analytics" replace />} />
          <Route path="queue"      element={<TicketQueue />} />
          <Route path="ticket/:ticketId" element={<TicketDetail />} />
          <Route path="escalation" element={<HILEscalation />} />
          <Route path="sdlc"       element={<SDLCTracker />} />
          <Route path="kb"         element={<KBArticles />} />
          <Route path="sla"        element={<SLAConfig />} />
          <Route path="monitor"    element={<ProjectMonitor />} />
          <Route path="analytics"  element={<AnalyticsDashboard />} />
        </Route>

        {/* ── Support Agent ───────────────────────────────── */}
        <Route path="/agent" element={<AppLayout title="Support — CSAgent" />}>
          <Route index element={<Navigate to="queue" replace />} />
          <Route path="queue"      element={<TicketQueue />} />
          <Route path="ticket/:ticketId" element={<TicketDetail />} />
          <Route path="escalation" element={<HILEscalation />} />
          <Route path="sdlc"       element={<SDLCTracker />} />
          <Route path="kb"         element={<KBArticles />} />
        </Route>

        {/* ── VP Customer Success ─────────────────────────── */}
        <Route path="/vp" element={<AppLayout title="Executive — CSAgent" />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard"  element={<VPDashboard />} />
          <Route path="analytics"  element={<AnalyticsDashboard />} />
          <Route path="queue"      element={<TicketQueue />} />
          <Route path="ticket/:ticketId" element={<TicketDetail />} />
        </Route>

        {/* ── Legal ───────────────────────────────────────── */}
        <Route path="/legal" element={<AppLayout title="Legal — CSAgent" />}>
          <Route index element={<Navigate to="kb" replace />} />
          <Route path="kb"         element={<KBArticles />} />
          <Route path="queue"      element={<TicketQueue />} />
          <Route path="ticket/:ticketId" element={<TicketDetail />} />
        </Route>

        {/* ── Fallback ─────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}
