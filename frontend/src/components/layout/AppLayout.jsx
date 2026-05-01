import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppLayout({ title = 'CSAgent' }) {
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
