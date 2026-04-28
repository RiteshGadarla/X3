import { NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

const NAV_ITEMS = [
  {
    section: 'Support',
    links: [
      { to: '/support/queue',      label: 'Ticket Queue',     icon: '🎫' },
      { to: '/support/escalation', label: 'HIL Escalation',   icon: '🚨' },
    ],
  },
  {
    section: 'Admin',
    links: [
      { to: '/admin/rbac', label: 'RBAC Dashboard', icon: '👥' },
      { to: '/admin/sla',  label: 'SLA Config',     icon: '⏱️' },
    ],
  },
  {
    section: 'Portal',
    links: [
      { to: '/portal', label: 'Customer Portal', icon: '🌐' },
    ],
  },
]

export default function Sidebar() {
  const { user, logout, getInitials } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">C</div>
        <div>
          <div className="sidebar-logo-text">centific</div>
          <div className="sidebar-logo-sub">aegis.ai · CSAgent</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((group) => (
          <div key={group.section}>
            <div className="sidebar-section-label">{group.section}</div>
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => isActive ? 'active' : ''}
              >
                <span>{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--neutral-7)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div className="topbar-avatar" style={{ flexShrink: 0 }}>
          {getInitials()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--neutral-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.full_name}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--neutral-4)' }}>{user?.role}</div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            color: 'var(--neutral-4)',
            padding: '4px',
            borderRadius: '4px',
            transition: 'color .15s',
          }}
          title="Logout"
        >
          ↩
        </button>
      </div>
    </aside>
  )
}
