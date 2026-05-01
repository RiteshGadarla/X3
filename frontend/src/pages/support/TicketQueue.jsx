import { useEffect, useState, useCallback } from 'react'
import client from '../../api/client'
import { Card } from '../../components/ui/Card'
import TicketTable from '../../components/tickets/TicketTable'
import { DonutChart, BarChart, BRAND } from '../../components/charts/Charts'
import Icon from '../../components/ui/Icons'
import DashboardHero from '../../components/ui/DashboardHero'

// SLA targets in minutes for time-to-breach calculations
const SLA_MINUTES = { P1: 15, P2: 60, P3: 240, P4: 1440 }

export default function TicketQueue() {
  const [tickets, setTickets] = useState([])
  const [allSnapshot, setAllSnapshot] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const pageSize = 15

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: pageSize }
      if (filterStatus) params.status = filterStatus
      if (filterPriority) params.priority = filterPriority
      const { data } = await client.get('/tickets', { params })
      setTickets(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterPriority])

  // Wide snapshot for charts (independent of pagination/filters)
  const fetchSnapshot = useCallback(async () => {
    try {
      const { data } = await client.get('/tickets', { params: { page: 1, page_size: 200 } })
      setAllSnapshot(data.items || [])
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])
  useEffect(() => { fetchSnapshot() }, [fetchSnapshot])

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { fetchTickets(); fetchSnapshot() }, 30000)
    return () => clearInterval(id)
  }, [fetchTickets, fetchSnapshot])

  // Insights from snapshot
  const counts = (key) => allSnapshot.reduce((acc, t) => {
    acc[t[key]] = (acc[t[key]] || 0) + 1
    return acc
  }, {})

  const byStatus   = counts('status')
  const byPriority = counts('priority')

  const priorityChart = ['P1','P2','P3','P4'].map(p => ({
    label: p,
    value: byPriority[p] || 0,
    color: p === 'P1' ? BRAND.error : p === 'P2' ? BRAND.warning : p === 'P3' ? BRAND.primary : BRAND.cyan,
  }))

  const statusChart = [
    { label: 'New',         value: byStatus.new          || 0, color: BRAND.cyan },
    { label: 'Triaged',     value: byStatus.triaged      || 0, color: BRAND.primary },
    { label: 'In Progress', value: byStatus.in_progress  || 0, color: BRAND.warning },
    { label: 'Escalated',   value: byStatus.escalated    || 0, color: BRAND.error },
    { label: 'HIL',         value: byStatus.pending_hil  || 0, color: BRAND.pink },
    { label: 'Resolved',    value: byStatus.resolved     || 0, color: BRAND.success },
  ].filter(s => s.value > 0)

  // Real arrivals in last 24h grouped into 2-hour buckets from snapshot
  const arrivalBuckets = Array(12).fill(0)
  const cutoff = Date.now() - 24 * 3600 * 1000
  allSnapshot.forEach(t => {
    if (!t.created_at) return
    const ts = new Date(t.created_at).getTime()
    if (ts < cutoff) return
    const hoursAgo = (Date.now() - ts) / 3600000
    const bucket = 11 - Math.floor(hoursAgo / 2)
    if (bucket >= 0 && bucket < 12) arrivalBuckets[bucket]++
  })
  const arrivalTotal = arrivalBuckets.reduce((a, b) => a + b, 0)

  const p1Count        = byPriority.P1 || 0
  const escalatedCount = byStatus.escalated || 0
  const newCount       = byStatus.new || 0
  const slaAtRisk      = allSnapshot.filter(t => t.sla_breached || (t.priority === 'P1' && t.status !== 'resolved')).length

  // Oldest unresolved P1 — the most actionable urgency signal
  const openP1s = allSnapshot.filter(t => t.priority === 'P1' && t.status !== 'resolved' && t.status !== 'closed' && t.created_at)
  const oldestP1Min = openP1s.reduce((max, t) => {
    const m = (Date.now() - new Date(t.created_at).getTime()) / 60000
    return Math.max(max, m)
  }, 0)
  const formatWait = (m) => m >= 60 ? `${(m / 60).toFixed(1)}h` : `${Math.round(m)}m`

  // Time until next SLA breach across all open tickets
  const nextBreachMin = allSnapshot.reduce((min, t) => {
    if (t.status === 'resolved' || t.status === 'closed' || !t.created_at) return min
    const ageMin = (Date.now() - new Date(t.created_at).getTime()) / 60000
    const target = SLA_MINUTES[t.priority] || 240
    const remaining = target - ageMin
    if (remaining <= 0) return min
    return Math.min(min, remaining)
  }, Infinity)

  const heroKpis = [
    {
      label: 'Total in Scope',
      value: total,
      foot: arrivalTotal > 0 ? `+${arrivalTotal} in 24h` : 'no recent arrivals',
      sparkline: arrivalTotal > 0 ? arrivalBuckets : null,
    },
    {
      label: 'New',
      value: newCount,
      foot: 'awaiting triage',
      tone: newCount > 5 ? 'cyan' : null,
    },
    {
      label: 'P1 Critical',
      value: p1Count,
      foot: oldestP1Min > 0 ? `oldest ${formatWait(oldestP1Min)}` : '15-min SLA',
      tone: oldestP1Min > 10 ? 'down' : p1Count > 0 ? 'warn' : null,
    },
    {
      label: 'Escalated',
      value: escalatedCount,
      foot: 'human review',
      tone: escalatedCount > 0 ? 'pink' : null,
    },
    {
      label: 'SLA at Risk',
      value: slaAtRisk,
      foot: nextBreachMin !== Infinity ? `next breach ${formatWait(nextBreachMin)}` : 'all healthy',
      tone: slaAtRisk > 0 ? 'down' : 'up',
    },
  ]

  return (
    <div>
      <DashboardHero
        live="Live · auto-refresh 30s"
        title="Live Ticket Queue"
        subtitle="All inbound, triaged and escalated tickets. Take action straight from the row."
        kpis={heroKpis}
      />

      {/* ── Insight cards strip ───────────────────────────────────── */}
      <div className="dash-grid-3">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.fire /></span>
              Priority Mix
            </div>
            <span className="badge badge-primary">P1–P4</span>
          </div>
          <div className="chart-card-body">
            <DonutChart data={priorityChart.filter(p => p.value > 0)} size={160} centerLabel="OPEN" />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.inbox /></span>
              Status Distribution
            </div>
            <span className="badge badge-cyan">Workflow</span>
          </div>
          <div className="chart-card-body">
            {statusChart.length > 0
              ? <BarChart data={statusChart} horizontal height={200} />
              : <div style={{ fontSize: 13, color: 'var(--neutral-4)' }}>No tickets yet.</div>}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.shield /></span>
              At-risk Snapshot
            </div>
            <span className={`badge ${slaAtRisk > 0 ? 'badge-error' : 'badge-success'}`}>
              {slaAtRisk > 0 ? `${slaAtRisk} risk` : 'Healthy'}
            </span>
          </div>
          <div className="chart-card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { lbl: 'P1 unresolved',         val: p1Count,        c: BRAND.error },
                { lbl: 'Escalated',             val: escalatedCount, c: BRAND.pink },
                { lbl: 'Awaiting triage',       val: newCount,       c: BRAND.cyan },
                { lbl: 'SLA-at-risk',           val: slaAtRisk,      c: BRAND.warning },
              ].map(r => (
                <div key={r.lbl} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 38, borderRadius: 3, background: r.c }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--neutral-4)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 700 }}>{r.lbl}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: r.c, lineHeight: 1 }}>{r.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--neutral-3)' }}>Filters</span>
          <select className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }} value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {['new','triaged','in_progress','escalated','pending_hil','resolved','closed'].map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
          <select className="form-select" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }} value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}>
            <option value="">All Priorities</option>
            {['P1','P2','P3','P4'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button id="queue-filter-clear" className="btn btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterPriority(''); setPage(1); }}>
            Clear
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--neutral-4)' }}>
            <span className="live-pulse" />
            Auto-refresh 30s
          </div>
          <button id="queue-refresh" className="btn btn-secondary btn-sm" onClick={() => { fetchTickets(); fetchSnapshot() }}>
            <Icon.refresh /> Refresh
          </button>
        </div>
      </Card>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Tickets ({total})</span>
        </div>

        <TicketTable tickets={tickets} loading={loading} />

        {/* Pagination */}
        {total > pageSize && (
          <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--neutral-7)' }}>
            <span style={{ fontSize: '12px', color: 'var(--neutral-4)' }}>
              Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button id="queue-pagination-prev" className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button id="queue-pagination-next" className="btn btn-ghost btn-sm" disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
