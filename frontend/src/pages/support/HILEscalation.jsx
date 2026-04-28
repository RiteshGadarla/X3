import { useEffect, useState } from 'react'
import client from '../../api/client'

export default function HILEscalation() {
  const [escalated, setEscalated] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEscalated = async () => {
    setLoading(true)
    try {
      const { data } = await client.get('/tickets', { params: { status: 'escalated', page_size: 50 } })
      const pending = await client.get('/tickets', { params: { status: 'pending_hil', page_size: 50 } })
      setEscalated([...data.items, ...pending.data.items])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEscalated() }, [])

  const handleApprove = async (ticketId, action) => {
    try {
      await client.patch(`/tickets/${ticketId}`, {
        status: action === 'resolve' ? 'resolved' : action === 'close' ? 'closed' : 'in_progress',
      })
      fetchEscalated()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <div className="page-banner" style={{ marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
        <h1>HIL Escalation Review Board</h1>
        <p>Human-In-The-Loop checkpoints. Review and approve escalated tickets that AI cannot handle autonomously.</p>
      </div>

      {/* HIL Rules summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { id: 'HIL-3', label: 'Critical Escalation', desc: 'Billing, Legal, VIP, Angry customers', color: 'var(--error)', bg: 'var(--error-light)' },
          { id: 'HIL-4', label: 'P1/P2 Override', desc: 'Cannot close without human confirmation', color: 'var(--warning)', bg: 'var(--warning-light)' },
          { id: 'HIL-5', label: 'KB Publication', desc: 'AI drafts, human must click Publish', color: 'var(--primary)', bg: 'var(--primary-light)' },
        ].map((hil) => (
          <div key={hil.id} className="card" style={{ borderLeft: `4px solid ${hil.color}` }}>
            <div className="card-body" style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ background: hil.bg, color: hil.color, borderRadius: 'var(--radius-pill)', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>{hil.id}</span>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{hil.label}</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--neutral-4)' }}>{hil.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Escalation queue */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🚨 Pending Human Review ({escalated.length})</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchEscalated}>↻ Refresh</button>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--neutral-4)' }}>Loading escalations…</div>
        ) : escalated.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <div style={{ fontWeight: 600, color: 'var(--neutral-0)', marginBottom: '4px' }}>No Pending Escalations</div>
            <div style={{ fontSize: '13px', color: 'var(--neutral-4)' }}>All tickets are being handled autonomously.</div>
          </div>
        ) : (
          <div>
            {escalated.map((t) => (
              <div key={t.id} style={{
                borderBottom: '1px solid var(--neutral-7)',
                padding: '18px 20px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '16px',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '13px' }}>{t.ticket_ref}</span>
                    <span className={`badge ${t.priority === 'P1' ? 'badge-error' : t.priority === 'P2' ? 'badge-warning' : 'badge-primary'}`}>{t.priority}</span>
                    <span className={`badge ${t.status === 'escalated' ? 'badge-error' : 'badge-pink'}`}>{t.status.replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--neutral-0)', marginBottom: '3px' }}>{t.subject}</div>
                  <div style={{ fontSize: '12px', color: 'var(--neutral-4)' }}>
                    {t.customer_name} · {t.customer_email} · {t.category}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--neutral-5)', marginTop: '4px' }}>
                    Submitted: {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleApprove(t.id, 'assign')}>
                    👤 Assign
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApprove(t.id, 'resolve')}>
                    ✅ Resolve
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleApprove(t.id, 'close')}>
                    ✗ Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
