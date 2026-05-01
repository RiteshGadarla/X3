import { useRole } from '../../hooks/useRole'
import Icon from '../ui/Icons'

export default function TopBar({ title }) {
  const { role, title: roleTitle, initials, color } = useRole()

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
          <span className="live-pulse" />
          Live
        </div>

        {/* Notification bell */}
        <button
          aria-label="Notifications"
          title="Notifications"
          style={{
            width: '34px', height: '34px',
            background: 'var(--neutral-8)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            border: '1px solid var(--neutral-7)',
            color: 'var(--neutral-3)',
            transition: 'all .15s',
          }}
        >
          <Icon.bell />
        </button>

        {/* Role label */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--neutral-0)' }}>{roleTitle}</div>
          <div style={{ fontSize: '10px', color: 'var(--neutral-4)' }}>{role}</div>
        </div>
        <div className="topbar-avatar" style={{ background: color }}>{initials}</div>
      </div>
    </header>
  )
}
