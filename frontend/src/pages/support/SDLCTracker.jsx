import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'

const PB = { P1: 'badge-error', P2: 'badge-warning', P3: 'badge-primary', P4: 'badge-neutral' }
const SB = { new: 'badge-cyan', triaged: 'badge-primary', in_progress: 'badge-warning', escalated: 'badge-error', pending_hil: 'badge-pink', resolved: 'badge-success', closed: 'badge-neutral' }

export default function SDLCTracker() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await client.get('/sdlc/pending')
      setItems(data.items || [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const id = setInterval(load, 30000); return () => clearInterval(id) }, [])

  const approve = async (ref, src) => {
    setBusy(`${ref}-${src}`)
    try {
      await client.post('/actions/execute', { action: 'approve_sdlc', params: { ticket_ref: ref, source: src } })
      load()
    } catch (e) { console.error(e) }
    finally { setBusy(null) }
  }

  const passed = items.filter(i => i.devops_ok && i.qa_ok)
  const pending = items.filter(i => !i.devops_ok || !i.qa_ok)

  return (
    <div>
      <div className="page-banner" style={{ marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
        <h1>SDLC Deployment Gate</h1>
        <p>Dual-confirmation tracker. Tickets routed to engineering require both DevOps deploy ✓ and QA tests ✓ before resolution.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { label: 'Pending Gate', value: pending.length, delta: 'Awaiting confirmation', cls: pending.length > 0 ? 'down' : '' },
          { label: 'Gate Passed', value: passed.length, delta: 'Both confirmed', cls: 'up' },
          { label: 'Total Tracked', value: items.length, delta: 'Engineering tickets' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{loading ? '—' : s.value}</div>
            <div className={`stat-delta ${s.cls || ''}`}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Pending */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">⏳ Awaiting Dual Confirmation ({pending.length})</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            <span style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>Auto-refresh 30s</span>
            <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--neutral-4)' }}>Loading…</div>
        ) : pending.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>All Gates Passed</div>
            <div style={{ fontSize: '13px', color: 'var(--neutral-4)' }}>No tickets awaiting SDLC confirmation.</div>
          </div>
        ) : (
          <div>
            {pending.map(t => (
              <div key={t.ticket_ref} className="sdlc-row">
                <div className="sdlc-row-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span
                      style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', fontSize: '13px' }}
                      onClick={() => {
                        const tid = t.id
                        if (tid) navigate(`/support/ticket/${tid}`)
                      }}
                    >
                      {t.ticket_ref}
                    </span>
                    <span className={`badge ${PB[t.priority]}`}>{t.priority}</span>
                    <span className={`badge ${SB[t.status]}`}>{t.status.replace(/_/g, ' ')}</span>
                    {t.routing_target && <span className="badge badge-cyan">{t.routing_target}</span>}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{t.subject}</div>
                  {t.sla_deadline && (
                    <div style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>
                      SLA: {new Date(t.sla_deadline).toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="sdlc-row-gates">
                  <div className="sdlc-gate-pill">
                    <span style={{ fontSize: '16px' }}>{t.devops_ok ? '✅' : '⏳'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>DevOps</div>
                      <div style={{ fontSize: '10px', color: 'var(--neutral-4)' }}>{t.devops_ok ? 'Passed' : 'Pending'}</div>
                    </div>
                    {!t.devops_ok && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy === `${t.ticket_ref}-devops`}
                        onClick={() => approve(t.ticket_ref, 'devops')}
                      >
                        ✓ Confirm
                      </button>
                    )}
                  </div>
                  <div className="sdlc-gate-pill">
                    <span style={{ fontSize: '16px' }}>{t.qa_ok ? '✅' : '⏳'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>QA Tests</div>
                      <div style={{ fontSize: '10px', color: 'var(--neutral-4)' }}>{t.qa_ok ? 'Passed' : 'Pending'}</div>
                    </div>
                    {!t.qa_ok && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy === `${t.ticket_ref}-qa`}
                        onClick={() => approve(t.ticket_ref, 'qa')}
                      >
                        ✓ Confirm
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
