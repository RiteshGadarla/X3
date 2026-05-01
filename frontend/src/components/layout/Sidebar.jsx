import { NavLink, useNavigate } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import Icon from '../ui/Icons'

// Icon-only nav. Labels live in `title` for tooltip.
const ROLE_NAV = {
  Admin: [
    {
      section: 'OPS',
      links: [
        { label: 'Ticket Queue',   icon: <Icon.queue />,   path: 'queue' },
        { label: 'HIL Escalation', icon: <Icon.alert />,   path: 'escalation' },
        { label: 'SDLC Tracker',   icon: <Icon.build />,   path: 'sdlc' },
        { label: 'KB Articles',    icon: <Icon.book />,    path: 'kb' },
        { label: 'Command Centre', icon: <Icon.zap />,     path: 'commands' },
      ],
    },
    {
      section: 'ADMIN',
      links: [
        { label: 'RBAC Dashboard',  icon: <Icon.users />,   path: 'rbac' },
        { label: 'SLA Config',      icon: <Icon.clock />,   path: 'sla' },
        { label: 'Project Monitor', icon: <Icon.monitor />, path: 'monitor' },
        { label: 'Analytics',       icon: <Icon.chart />,   path: 'analytics' },
        { label: 'VP Dashboard',    icon: <Icon.trophy />,  path: 'vp-view' },
      ],
    },
  ],
  Manager: [
    {
      section: 'OPS',
      links: [
        { label: 'Ticket Queue',   icon: <Icon.queue />, path: 'queue' },
        { label: 'HIL Escalation', icon: <Icon.alert />, path: 'escalation' },
        { label: 'SDLC Tracker',   icon: <Icon.build />, path: 'sdlc' },
        { label: 'KB Articles',    icon: <Icon.book />,  path: 'kb' },
      ],
    },
    {
      section: 'MGR',
      links: [
        { label: 'Analytics',       icon: <Icon.chart />,   path: 'analytics' },
        { label: 'SLA Config',      icon: <Icon.clock />,   path: 'sla' },
        { label: 'Project Monitor', icon: <Icon.monitor />, path: 'monitor' },
      ],
    },
  ],
  'Support Agent': [
    {
      section: 'SUP',
      links: [
        { label: 'Ticket Queue',   icon: <Icon.queue />, path: 'queue' },
        { label: 'HIL Escalation', icon: <Icon.alert />, path: 'escalation' },
        { label: 'SDLC Tracker',   icon: <Icon.build />, path: 'sdlc' },
        { label: 'KB Articles',    icon: <Icon.book />,  path: 'kb' },
      ],
    },
  ],
  'VP Customer Success': [
    {
      section: 'EXEC',
      links: [
        { label: 'VP Dashboard', icon: <Icon.trophy />, path: 'dashboard' },
        { label: 'Analytics',    icon: <Icon.chart />,  path: 'analytics' },
        { label: 'Ticket Queue', icon: <Icon.queue />,  path: 'queue' },
      ],
    },
  ],
  Legal: [
    {
      section: 'LGL',
      links: [
        { label: 'KB Articles',  icon: <Icon.book />,  path: 'kb' },
        { label: 'Ticket Queue', icon: <Icon.queue />, path: 'queue' },
      ],
    },
  ],
}

export default function Sidebar() {
  const { role, title, initials, color, basePath } = useRole()
  const navigate = useNavigate()
  const groups = ROLE_NAV[role] || []

  return (
    <aside className="sidebar sidebar--icons">
      {/* Logo mark only */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">C</div>
      </div>

      {/* Navigation — icons only */}
      <nav className="sidebar-nav">
        {groups.map((group, gi) => (
          <div key={group.section}>
            {gi > 0 && <div className="sidebar-divider" />}
            {group.links.map((link) => (
              <NavLink
                key={link.path}
                to={`${basePath}/${link.path}`}
                title={link.label}
                aria-label={link.label}
                className={({ isActive }) => `sidebar-icon-link${isActive ? ' active' : ''}`}
              >
                {link.icon}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Avatar + role switch */}
      <div className="sidebar-footer">
        <div className="topbar-avatar" style={{ background: color }} title={`${title} · ${role}`}>
          {initials}
        </div>
        <button
          id="sidebar-role-switch"
          onClick={() => navigate('/')}
          className="sidebar-icon-link"
          title="Switch role"
          aria-label="Switch role"
          style={{ marginTop: '8px' }}
        >
          <Icon.swap />
        </button>
      </div>
    </aside>
  )
}
