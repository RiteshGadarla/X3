import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { useRole } from '../../hooks/useRole'

const PB = { P1: 'badge-error', P2: 'badge-warning', P3: 'badge-primary', P4: 'badge-neutral' }
const SB = { new: 'badge-cyan', triaged: 'badge-primary', in_progress: 'badge-warning', escalated: 'badge-error', pending_hil: 'badge-pink', resolved: 'badge-success', closed: 'badge-neutral' }
const SENB = { positive: 'badge-success', neutral: 'badge-neutral', negative: 'badge-warning', angry: 'badge-error' }

export default function TicketDetail() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { basePath } = useRole()
  const [ticket, setTicket] = useState(null)
  const [children, setChildren] = useState([])
  const [linked, setLinked] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [t, c, l] = await Promise.all([
        client.get(`/tickets/${ticketId}`),
        client.get(`/tickets/${ticketId}/children`),
        client.get(`/tickets/${ticketId}/linked`),
      ])
      setTicket(t.data); setChildren(c.data); setLinked(l.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [ticketId])

  const changeStatus = async (s) => {
    setBusy(true)
    try { await client.patch(`/tickets/${ticketId}`, { status: s }); load() }
    catch (e) { console.error(e) }
    finally { setBusy(false) }
  }

  const sdlcApprove = async (src) => {
    setBusy(true)
    try {
      await client.post('/actions/execute', { action: 'approve_sdlc', params: { ticket_ref: ticket.ticket_ref, source: src } })
      load()
    } catch (e) { console.error(e) }
    finally { setBusy(false) }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}><div className="animate-pulse" style={{ color: 'var(--neutral-4)' }}>Loading…</div></div>
  if (!ticket) return <div style={{ textAlign: 'center', padding: '80px 0' }}><h2>Ticket Not Found</h2><button id="ticket-not-found-back" className="btn btn-primary mt-4" onClick={() => navigate(`${basePath}/queue`)}>← Back</button></div>

  const slaMin = ticket.sla_deadline ? Math.max(0, Math.round((new Date(ticket.sla_deadline) - new Date()) / 60000)) : null
  const isEng = ['SRE-Team', 'DevOps-Team', 'Engineering-Team'].includes(ticket.routing_target)
  const gateOk = ticket.sdlc_devops_ok && ticket.sdlc_qa_ok

  const slaColor = slaMin === null ? 'var(--neutral-4)' : slaMin <= 15 ? 'var(--error)' : slaMin <= 60 ? 'var(--warning)' : 'var(--success)'

  return (
    <div className="ticket-detail-compact">
      {/* Back link */}
      <button
        id="ticket-back-to-queue"
        onClick={() => navigate(`${basePath}/queue`)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--neutral-4)', fontSize: '12px', fontWeight: 600,
          padding: '0 0 8px', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        ← Back to Queue
      </button>

      {/* ── Compact banner ──────────────────────────────────────────── */}
      <div className="ticket-banner-compact">
        <div className="ticket-banner-row">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="ticket-ref-badge">{ticket.ticket_ref}</span>
              <span className={`badge ${PB[ticket.priority]}`}>{ticket.priority}</span>
              <span className={`badge ${SB[ticket.status]}`}>{ticket.status.replace(/_/g, ' ')}</span>
              <span className={`badge ${SENB[ticket.sentiment]}`}>{ticket.sentiment}</span>
              {ticket.pii_redacted && <span className="badge badge-pink">PII</span>}
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ticket.subject}
            </h1>
          </div>
          <div className="ticket-banner-meta">
            <span title="Customer">{ticket.customer_name}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span title="Email">{ticket.customer_email}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span title="Category">{ticket.category}</span>
            {ticket.routing_target && <>
              <span style={{ opacity: 0.5 }}>·</span>
              <span title="Routing target">→ {ticket.routing_target}</span>
            </>}
          </div>
        </div>
      </div>

      {/* ── 2-column dense grid ─────────────────────────────────────── */}
      <div className="ticket-detail-grid-compact">
        {/* Left main column */}
        <div className="ticket-main-col">
          <div className="card">
            <div className="card-header" style={{ padding: '10px 16px' }}>
              <span className="card-title">Description</span>
              <span style={{ fontSize: 11, color: 'var(--neutral-5)' }}>
                {new Date(ticket.created_at).toLocaleString()}
              </span>
            </div>
            <div className="card-body" style={{ padding: '14px 18px', maxHeight: '38vh', overflowY: 'auto' }}>
              <p style={{ fontSize: '13.5px', lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--neutral-1)' }}>
                {ticket.description}
              </p>
            </div>
          </div>

          {children.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-header" style={{ padding: '10px 16px' }}>
                <span className="card-title">Child Tickets</span>
                <span className="badge badge-pink">{children.length}</span>
              </div>
              <div className="table-wrap" style={{ maxHeight: '24vh', overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Ref</th><th>Subject</th><th>Pri</th><th>Status</th><th></th></tr></thead>
                  <tbody>{children.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--primary)' }}>{c.ticket_ref}</td>
                      <td>{c.subject}</td>
                      <td><span className={`badge ${PB[c.priority]}`}>{c.priority}</span></td>
                      <td><span className={`badge ${SB[c.status]}`}>{c.status.replace(/_/g,' ')}</span></td>
                      <td><button id={`ticket-child-view-${c.id}`} className="btn btn-secondary btn-sm" onClick={() => navigate(`${basePath}/ticket/${c.id}`)}>View</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {linked.length > 0 && (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-header" style={{ padding: '10px 16px' }}>
                <span className="card-title">Linked Tickets</span>
                <span className="badge badge-cyan">{linked.length}</span>
              </div>
              <div className="table-wrap" style={{ maxHeight: '20vh', overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Ref</th><th>Subject</th><th>Status</th><th></th></tr></thead>
                  <tbody>{linked.map(l => (
                    <tr key={l.id}>
                      <td style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--cyan)' }}>{l.ticket_ref}</td>
                      <td>{l.subject}</td>
                      <td><span className={`badge ${SB[l.status]}`}>{l.status.replace(/_/g,' ')}</span></td>
                      <td><button id={`ticket-linked-view-${l.id}`} className="btn btn-secondary btn-sm" onClick={() => navigate(`${basePath}/ticket/${l.id}`)}>View</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="ticket-side-col">
          {/* SLA */}
          <div className="card">
            <div className="card-body" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>SLA</span>
                {slaMin !== null && (
                  <span style={{ fontSize: 22, fontWeight: 800, color: slaColor, lineHeight: 1 }}>
                    {slaMin >= 60 ? `${Math.floor(slaMin/60)}h ${slaMin%60}m` : `${slaMin}m`}
                  </span>
                )}
                {slaMin === null && <span style={{ fontSize: 12, color: 'var(--neutral-4)' }}>Not set</span>}
              </div>
              {slaMin !== null && (
                <div className="sla-bar">
                  <div className="sla-bar-fill" style={{ width: `${Math.min(100, Math.max(5, 100 - (slaMin / 480 * 100)))}%`, background: slaColor }} />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <div className="card-body" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-4)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Actions</span>
              {!['in_progress','resolved','closed'].includes(ticket.status) && (
                <button id="ticket-action-start" className="btn btn-primary btn-sm w-full" disabled={busy} onClick={() => changeStatus('in_progress')}>Start Working</button>
              )}
              {ticket.status === 'in_progress' && (
                <button id="ticket-action-resolve" className="btn btn-primary btn-sm w-full" disabled={busy} onClick={() => changeStatus('resolved')}>Resolve</button>
              )}
              {ticket.status === 'resolved' && (
                <button id="ticket-action-close" className="btn btn-ghost btn-sm w-full" disabled={busy} onClick={() => changeStatus('closed')}>Close</button>
              )}
              {['escalated','pending_hil'].includes(ticket.status) && (
                <button id="ticket-action-accept" className="btn btn-secondary btn-sm w-full" disabled={busy} onClick={() => changeStatus('in_progress')}>Accept</button>
              )}
            </div>
          </div>

          {/* SDLC Gate */}
          {isEng && (
            <div className="card">
              <div className="card-body" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>SDLC Gate</span>
                  {gateOk && <span className="badge badge-success">Passed</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="sdlc-check-row" style={{ padding: '6px 10px' }}>
                    <div className={`sdlc-check ${ticket.sdlc_devops_ok ? 'confirmed' : 'pending'}`}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: ticket.sdlc_devops_ok ? 'var(--success)' : 'var(--neutral-6)',
                        display: 'inline-block',
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>DevOps</span>
                      <span style={{ fontSize: 10, color: 'var(--neutral-4)' }}>{ticket.sdlc_devops_ok ? 'Confirmed' : 'Awaiting'}</span>
                    </div>
                    {!ticket.sdlc_devops_ok && <button id="ticket-sdlc-approve-devops" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => sdlcApprove('devops')}>Approve</button>}
                  </div>
                  <div className="sdlc-check-row" style={{ padding: '6px 10px' }}>
                    <div className={`sdlc-check ${ticket.sdlc_qa_ok ? 'confirmed' : 'pending'}`}>
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: ticket.sdlc_qa_ok ? 'var(--success)' : 'var(--neutral-6)',
                        display: 'inline-block',
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>QA Tests</span>
                      <span style={{ fontSize: 10, color: 'var(--neutral-4)' }}>{ticket.sdlc_qa_ok ? 'Confirmed' : 'Awaiting'}</span>
                    </div>
                    {!ticket.sdlc_qa_ok && <button id="ticket-sdlc-approve-qa" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => sdlcApprove('qa')}>Approve</button>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Routing */}
          {ticket.routing_target && (
            <div className="card">
              <div className="card-body" style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Routing</span>
                  <span style={{ fontSize: 11, color: 'var(--neutral-4)' }}>Loops: {ticket.loop_count}</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: 'var(--neutral-0)' }}>{ticket.routing_target}</div>
              </div>
            </div>
          )}

          {ticket.parent_id && (
            <div className="card">
              <div className="card-body" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--neutral-4)' }}>Split from parent</span>
                <button id="ticket-parent-link" className="btn btn-secondary btn-sm" onClick={() => navigate(`${basePath}/ticket/${ticket.parent_id}`)}>↑ Parent</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
