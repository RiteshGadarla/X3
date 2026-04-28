import { useEffect, useState, useCallback } from 'react'
import client from '../../api/client'
import { Card } from '../../components/ui/Card'
import TicketTable from '../../components/tickets/TicketTable'

export default function TicketQueue() {
  const [tickets, setTickets] = useState([])
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

  useEffect(() => { fetchTickets() }, [fetchTickets])

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(fetchTickets, 30000)
    return () => clearInterval(id)
  }, [fetchTickets])

  const statCounts = {
    total: total,
    new: tickets.filter(t => t.status === 'new').length,
    p1: tickets.filter(t => t.priority === 'P1').length,
    escalated: tickets.filter(t => t.status === 'escalated').length,
  }

  return (
    <div>
      {/* Banner */}
      <div className="page-banner" style={{ marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
        <h1>Live Ticket Queue</h1>
        <p>Real-time view of all support tickets. Auto-refreshes every 30 seconds.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Total Tickets', value: statCounts.total, delta: 'All priorities' },
          { label: 'New / Unread', value: statCounts.new, delta: 'Awaiting triage', cls: 'up' },
          { label: 'P1 Critical', value: statCounts.p1, delta: '≤15 min SLA', cls: 'down' },
          { label: 'Escalated', value: statCounts.escalated, delta: 'Needs human review', cls: statCounts.escalated > 0 ? 'down' : '' },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{loading ? '—' : s.value}</div>
            <div className={`stat-delta ${s.cls || ''}`}>{s.delta}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--neutral-3)' }}>Filters:</span>
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
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStatus(''); setFilterPriority(''); setPage(1); }}>
            Clear
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--neutral-4)' }}>
            <span className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
            Auto-refresh: 30s
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchTickets}>↻ Refresh</button>
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
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

