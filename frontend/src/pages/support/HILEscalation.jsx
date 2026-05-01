import { useEffect, useState } from 'react'
import client from '../../api/client'
import { useRole } from '../../hooks/useRole'
import { DonutChart, BarChart, BRAND } from '../../components/charts/Charts'
import Icon from '../../components/ui/Icons'
import DashboardHero from '../../components/ui/DashboardHero'

export default function HILEscalation() {
  const { role } = useRole()
  const canTakeAction = ['Admin', 'Manager', 'VP Customer Success', 'Legal'].includes(role)

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

  // Insights from escalated set
  const byPriority = escalated.reduce((acc, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc }, {})
  const byCategory = escalated.reduce((acc, t) => { acc[t.category || 'Uncategorized'] = (acc[t.category || 'Uncategorized'] || 0) + 1; return acc }, {})

  const priorityChart = ['P1','P2','P3','P4'].map(p => ({
    label: p, value: byPriority[p] || 0,
    color: p === 'P1' ? BRAND.error : p === 'P2' ? BRAND.warning : p === 'P3' ? BRAND.primary : BRAND.cyan,
  })).filter(x => x.value > 0)

  const categoryChart = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v], i) => ({
      label: k, value: v,
      color: [BRAND.pink, BRAND.primary, BRAND.warning, BRAND.cyan, BRAND.success][i],
    }))

  const p1Esc = byPriority.P1 || 0
  const p2Esc = byPriority.P2 || 0
  const queueAges = escalated
    .filter(t => t.created_at)
    .map(t => (Date.now() - new Date(t.created_at).getTime()) / 3600000)
  const oldestHours = queueAges.reduce((m, h) => Math.max(m, h), 0)
  const avgHours    = queueAges.length ? queueAges.reduce((a, b) => a + b, 0) / queueAges.length : 0
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]
  const formatHours = (h) => h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}m`

  const heroKpis = [
    {
      label: 'Queue',
      value: escalated.length,
      foot: avgHours > 0 ? `avg wait ${formatHours(avgHours)}` : 'awaiting human',
      tone: escalated.length > 5 ? 'pink' : null,
    },
    {
      label: 'P1',
      value: p1Esc,
      foot: '15-min SLA',
      tone: p1Esc > 0 ? 'down' : null,
    },
    {
      label: 'P2',
      value: p2Esc,
      foot: '1-hr SLA',
      tone: p2Esc > 2 ? 'warn' : null,
    },
    {
      label: 'Oldest',
      value: oldestHours > 0 ? formatHours(oldestHours) : '—',
      foot: 'in queue',
      tone: oldestHours > 4 ? 'down' : oldestHours > 1 ? 'warn' : null,
    },
    {
      label: 'Top Category',
      value: topCategory ? topCategory[1] : 0,
      foot: topCategory ? topCategory[0] : 'no items',
    },
  ]

  return (
    <div>
      <DashboardHero
        live="Human-In-The-Loop · Live"
        title="HIL Escalation Review Board"
        subtitle="Tickets the AI handed off for human judgment. Review and decide."
        meta="Triggers: Billing/Legal/VIP/Angry · P1·P2 close override · KB publish gate"
        kpis={heroKpis}
      />

      {/* Insight charts */}
      {escalated.length > 0 && (
        <div className="dash-grid-2">
          <div className="chart-card">
            <div className="chart-card-head">
              <div className="chart-card-title">
                <span className="chart-card-title-icon"><Icon.alert /></span>
                Priority Mix in Queue
              </div>
              <span className="badge badge-error">Triage</span>
            </div>
            <div className="chart-card-body">
              <DonutChart data={priorityChart} size={170} centerLabel="QUEUE" />
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-card-head">
              <div className="chart-card-title">
                <span className="chart-card-title-icon"><Icon.fire /></span>
                Top Categories
              </div>
              <span className="badge badge-warning">Pattern</span>
            </div>
            <div className="chart-card-body">
              <BarChart data={categoryChart} horizontal height={200} />
            </div>
          </div>
        </div>
      )}

      {/* Escalation queue */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Pending Human Review ({escalated.length})</span>
          <button id="hil-refresh" className="btn btn-secondary btn-sm" onClick={fetchEscalated}>
            <Icon.refresh /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--neutral-4)' }}>Loading escalations…</div>
        ) : escalated.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'var(--success-light)', color: 'var(--success)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon.check width="32" height="32" />
            </div>
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
                {canTakeAction ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button id={`hil-assign-${t.id}`} className="btn btn-secondary btn-sm" onClick={() => handleApprove(t.id, 'assign')}>
                      Assign
                    </button>
                    <button id={`hil-resolve-${t.id}`} className="btn btn-primary btn-sm" onClick={() => handleApprove(t.id, 'resolve')}>
                      Resolve
                    </button>
                    <button id={`hil-close-${t.id}`} className="btn btn-ghost btn-sm" onClick={() => handleApprove(t.id, 'close')}>
                      Close
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--neutral-4)', fontStyle: 'italic', padding: '6px 10px', background: 'var(--neutral-8)', borderRadius: 'var(--radius-sm)' }}>
                    View only
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
