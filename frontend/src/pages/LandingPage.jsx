import { useNavigate } from 'react-router-dom'

const ROLES = [
  {
    path:        '/admin',
    title:       'System Administrator',
    role:        'Admin',
    description: 'Full system access — RBAC, SLA config, command centre, analytics, and all operations.',
    icon:        '🛡️',
    accent:      '#6366f1',
    features:    ['RBAC Dashboard', 'SLA Config', 'Command Centre', 'Analytics', 'Ticket Queue'],
  },
  {
    path:        '/manager',
    title:       'Customer Success Manager',
    role:        'Manager',
    description: 'Team oversight, analytics dashboards, SLA monitoring, and ticket management.',
    icon:        '📊',
    accent:      '#0ea5e9',
    features:    ['Analytics', 'SLA Config', 'Project Monitor', 'Ticket Queue', 'KB Articles'],
  },
  {
    path:        '/agent',
    title:       'Support Agent',
    role:        'Support Agent',
    description: 'Ticket queue, HIL escalation monitoring, SDLC tracker, and knowledge base.',
    icon:        '🎫',
    accent:      '#10b981',
    features:    ['Ticket Queue', 'HIL Escalation', 'SDLC Tracker', 'KB Articles'],
  },
  {
    path:        '/vp',
    title:       'VP Customer Success',
    role:        'VP Customer Success',
    description: 'Executive KPIs, SLA burn rate, top sentiment trends, and recurring issue heatmap.',
    icon:        '🏆',
    accent:      '#f59e0b',
    features:    ['VP Dashboard', 'Analytics', 'Ticket Queue (view)'],
  },
  {
    path:        '/legal',
    title:       'Legal Team',
    role:        'Legal',
    description: 'KB article review, compliance audit trail, and read-only ticket access.',
    icon:        '⚖️',
    accent:      '#8b5cf6',
    features:    ['KB Article Review', 'Ticket Queue (view)'],
  },
  {
    path:        '/customerportal',
    title:       'Customer Portal',
    role:        'Customer',
    description: 'Submit a support ticket and track your request status — no account needed.',
    icon:        '🌐',
    accent:      '#ec4899',
    features:    ['Submit Ticket', 'Check Status'],
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight:       '100vh',
      background:      'var(--gradient-hero)',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      padding:         '48px 24px 64px',
      fontFamily:      'var(--font-body)',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '48px', maxWidth: '640px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '20px' }}>
          <div style={{
            width: '48px', height: '48px',
            background: 'var(--primary)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 16px rgba(89,41,208,0.35)',
          }}>C</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--neutral-0)', letterSpacing: '-0.5px' }}>centific</div>
            <div style={{ fontSize: '12px', color: 'var(--neutral-4)', fontWeight: 500 }}>aegis.ai · CSAgent</div>
          </div>
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--neutral-0)', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
          Select your role to continue
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--neutral-3)', margin: 0, lineHeight: 1.6 }}>
          This is a role-based demo environment. Click your role card to access your dedicated workspace.
          No login required.
        </p>
      </div>

      {/* Role grid */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap:                 '20px',
        width:               '100%',
        maxWidth:            '1000px',
      }}>
        {ROLES.map((r) => (
          <button
            key={r.path}
            id={`landing-role-${r.role.replace(/\s+/g, '-').toLowerCase()}`}
            onClick={() => navigate(r.path)}
            style={{
              background:    '#fff',
              border:        `2px solid transparent`,
              borderRadius:  'var(--radius-md)',
              padding:       '28px 24px',
              cursor:        'pointer',
              textAlign:     'left',
              boxShadow:     'var(--shadow-sm)',
              transition:    'all .18s ease',
              position:      'relative',
              overflow:      'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor  = r.accent
              e.currentTarget.style.boxShadow    = `0 8px 28px rgba(0,0,0,0.12)`
              e.currentTarget.style.transform    = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor  = 'transparent'
              e.currentTarget.style.boxShadow    = 'var(--shadow-sm)'
              e.currentTarget.style.transform    = 'translateY(0)'
            }}
          >
            {/* Accent bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: '4px', background: r.accent,
            }} />

            {/* Icon + title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
              <div style={{
                width: '44px', height: '44px', flexShrink: 0,
                background: `${r.accent}18`,
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px',
              }}>
                {r.icon}
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--neutral-0)', lineHeight: 1.3 }}>
                  {r.title}
                </div>
                <div style={{
                  display: 'inline-block', marginTop: '4px',
                  fontSize: '10px', fontWeight: 600, letterSpacing: '0.5px',
                  background: `${r.accent}18`, color: r.accent,
                  padding: '2px 8px', borderRadius: '999px',
                }}>
                  {r.role}
                </div>
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: '13px', color: 'var(--neutral-3)', margin: '0 0 16px', lineHeight: 1.6 }}>
              {r.description}
            </p>

            {/* Feature pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
              {r.features.map((f) => (
                <span key={f} style={{
                  fontSize: '11px', fontWeight: 500,
                  background: 'var(--neutral-8)', color: 'var(--neutral-3)',
                  padding: '3px 10px', borderRadius: '999px',
                  border: '1px solid var(--neutral-7)',
                }}>
                  {f}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--neutral-4)', fontFamily: 'var(--font-code)' }}>
                {r.path}
              </span>
              <span style={{
                fontSize: '12px', fontWeight: 600, color: r.accent,
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                Enter workspace →
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer note */}
      <p style={{ marginTop: '40px', fontSize: '12px', color: 'var(--neutral-4)', textAlign: 'center' }}>
        centific aegis.ai · CSAgent · Phase 3 · Role-based demo environment
      </p>
    </div>
  )
}
