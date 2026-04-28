import useAuthStore from '../../store/authStore'

export default function TopBar({ title }) {
  const { user, getInitials } = useAuthStore()

  return (
    <header className="topbar">
      <h1 className="topbar-title">{title}</h1>
      <div className="topbar-right">
        {/* Live indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--success)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Live
        </div>

        {/* Notification bell */}
        <div style={{
          width: '32px', height: '32px',
          background: 'var(--neutral-8)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', cursor: 'pointer',
          border: '1px solid var(--neutral-7)',
          transition: 'background .15s',
        }}>
          🔔
        </div>

        {/* Avatar */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--neutral-0)' }}>{user?.full_name}</div>
          <div style={{ fontSize: '10px', color: 'var(--neutral-4)' }}>{user?.role}</div>
        </div>
        <div className="topbar-avatar">{getInitials()}</div>
      </div>
    </header>
  )
}
