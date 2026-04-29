import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import client from '../../api/client'

const PB = { P1: 'badge-error', P2: 'badge-warning', P3: 'badge-primary', P4: 'badge-neutral' }
const SB = { new: 'badge-cyan', triaged: 'badge-primary', in_progress: 'badge-warning', escalated: 'badge-error', pending_hil: 'badge-pink', resolved: 'badge-success', closed: 'badge-neutral' }
const SENB = { positive: 'badge-success', neutral: 'badge-neutral', negative: 'badge-warning', angry: 'badge-error' }

export default function TicketDetail() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
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
  if (!ticket) return <div style={{ textAlign: 'center', padding: '80px 0' }}><div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div><h2>Ticket Not Found</h2><button className="btn btn-primary mt-4" onClick={() => navigate('/support/queue')}>← Back</button></div>

  const slaMin = ticket.sla_deadline ? Math.max(0, Math.round((new Date(ticket.sla_deadline) - new Date()) / 60000)) : null
  const isEng = ['SRE-Team', 'DevOps-Team', 'Engineering-Team'].includes(ticket.routing_target)
  const gateOk = ticket.sdlc_devops_ok && ticket.sdlc_qa_ok

  const steps = [
    { l: 'Config (AG-16)', i: '⚙️' }, { l: 'PII (AG-13)', i: '🔒' }, { l: 'Intake (AG-01)', i: '📥' },
    { l: 'Triage (AG-02)', i: '🎯' }, { l: 'SLA (AG-06)', i: '⏱️' }, { l: 'Escalate (AG-08)', i: '🚨' },
    { l: 'Split (AG-11)', i: '✂️' }, { l: 'Dedup (AG-03)', i: '🔗' }, { l: 'Route (AG-04)', i: '🗺️' },
    { l: 'Loop (AG-14)', i: '🔄' }, { l: 'SDLC (AG-09)', i: '🏗️' },
  ]

  const doneIdx = ticket.status === 'new' ? 0 : ticket.status === 'triaged' ? 5 : ticket.status === 'pending_hil' || ticket.status === 'escalated' ? 6 : ticket.status === 'in_progress' ? 10 : 11

  return (
    <div>
      <button className="btn btn-ghost btn-sm mb-4" onClick={() => navigate('/support/queue')}>← Back to Queue</button>

      {/* Banner */}
      <div className="ticket-detail-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="ticket-ref-badge">{ticket.ticket_ref}</span>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '6px 0 0' }}>{ticket.subject}</h1>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span className={`badge ${PB[ticket.priority]}`}>{ticket.priority}</span>
            <span className={`badge ${SB[ticket.status]}`}>{ticket.status.replace(/_/g, ' ')}</span>
            <span className={`badge ${SENB[ticket.sentiment]}`}>{ticket.sentiment}</span>
            {ticket.pii_redacted && <span className="badge badge-pink">🔒 PII</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px', fontSize: '12px', opacity: 0.85 }}>
          <span>👤 {ticket.customer_name}</span>
          <span>✉️ {ticket.customer_email}</span>
          <span>📂 {ticket.category}</span>
          {ticket.routing_target && <span>🎯 {ticket.routing_target}</span>}
          <span>📅 {new Date(ticket.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card mb-4">
        <div className="card-header"><span className="card-title">🔄 Agent Pipeline</span></div>
        <div className="card-body">
          <div className="pipeline-timeline">
            {steps.map((s, idx) => (
              <div key={s.l} className={`timeline-step ${idx < doneIdx ? 'done' : ''} ${idx === doneIdx ? 'active' : ''}`}>
                <div className="timeline-icon">{s.i}</div>
                <span className="timeline-label">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ticket-detail-grid">
        {/* Left */}
        <div>
          {/* Description */}
          <div className="card mb-4">
            <div className="card-header"><span className="card-title">📝 Description</span></div>
            <div className="card-body"><p style={{ fontSize: '14px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{ticket.description}</p></div>
          </div>

          {/* Children AG-11 */}
          {children.length > 0 && (
            <div className="card mb-4">
              <div className="card-header"><span className="card-title">✂️ Child Tickets (AG-11)</span><span className="badge badge-pink">{children.length}</span></div>
              <div className="table-wrap"><table><thead><tr><th>Ref</th><th>Subject</th><th>Priority</th><th>Status</th><th></th></tr></thead>
              <tbody>{children.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--primary)' }}>{c.ticket_ref}</td>
                  <td>{c.subject}</td>
                  <td><span className={`badge ${PB[c.priority]}`}>{c.priority}</span></td>
                  <td><span className={`badge ${SB[c.status]}`}>{c.status.replace(/_/g,' ')}</span></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => navigate(`/support/ticket/${c.id}`)}>View</button></td>
                </tr>
              ))}</tbody></table></div>
            </div>
          )}

          {/* Linked AG-03 */}
          {linked.length > 0 && (
            <div className="card mb-4">
              <div className="card-header"><span className="card-title">🔗 Linked Tickets (AG-03)</span><span className="badge badge-cyan">{linked.length}</span></div>
              <div className="table-wrap"><table><thead><tr><th>Ref</th><th>Subject</th><th>Status</th><th></th></tr></thead>
              <tbody>{linked.map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: 'var(--font-code)', fontWeight: 700, color: 'var(--cyan)' }}>{l.ticket_ref}</td>
                  <td>{l.subject}</td>
                  <td><span className={`badge ${SB[l.status]}`}>{l.status.replace(/_/g,' ')}</span></td>
                  <td><button className="btn btn-secondary btn-sm" onClick={() => navigate(`/support/ticket/${l.id}`)}>View</button></td>
                </tr>
              ))}</tbody></table></div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div>
          {/* SLA */}
          <div className="card mb-4">
            <div className="card-header"><span className="card-title">⏱️ SLA</span></div>
            <div className="card-body" style={{ textAlign: 'center' }}>
              {slaMin !== null ? (<>
                <div style={{ fontSize: '36px', fontWeight: 800, lineHeight: 1, color: slaMin <= 15 ? 'var(--error)' : slaMin <= 60 ? 'var(--warning)' : 'var(--success)', marginBottom: '6px' }}>
                  {slaMin >= 60 ? `${Math.floor(slaMin/60)}h ${slaMin%60}m` : `${slaMin}m`}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--neutral-4)' }}>remaining</div>
                <div className="sla-bar" style={{ marginTop: '12px' }}><div className="sla-bar-fill" style={{ width: `${Math.min(100, Math.max(5, 100 - (slaMin / 480 * 100)))}%`, background: slaMin <= 15 ? 'var(--error)' : slaMin <= 60 ? 'var(--warning)' : 'var(--success)' }} /></div>
              </>) : <span style={{ color: 'var(--neutral-4)', fontSize: '13px' }}>No SLA set</span>}
            </div>
          </div>

          {/* SDLC Gate AG-09 */}
          {isEng && (
            <div className="card mb-4">
              <div className="card-header"><span className="card-title">🏗️ SDLC Gate</span>{gateOk && <span className="badge badge-success">✅ Passed</span>}</div>
              <div className="card-body">
                <div className="sdlc-check-row">
                  <div className={`sdlc-check ${ticket.sdlc_devops_ok ? 'confirmed' : 'pending'}`}>
                    <span>{ticket.sdlc_devops_ok ? '✅' : '⏳'}</span>
                    <div><div style={{ fontWeight: 600, fontSize: '13px' }}>DevOps</div><div style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>{ticket.sdlc_devops_ok ? 'Confirmed' : 'Awaiting'}</div></div>
                  </div>
                  {!ticket.sdlc_devops_ok && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => sdlcApprove('devops')}>Approve</button>}
                </div>
                <div className="sdlc-check-row" style={{ marginTop: '12px' }}>
                  <div className={`sdlc-check ${ticket.sdlc_qa_ok ? 'confirmed' : 'pending'}`}>
                    <span>{ticket.sdlc_qa_ok ? '✅' : '⏳'}</span>
                    <div><div style={{ fontWeight: 600, fontSize: '13px' }}>QA Tests</div><div style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>{ticket.sdlc_qa_ok ? 'Confirmed' : 'Awaiting'}</div></div>
                  </div>
                  {!ticket.sdlc_qa_ok && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => sdlcApprove('qa')}>Approve</button>}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="card mb-4">
            <div className="card-header"><span className="card-title">⚡ Actions</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!['in_progress','resolved','closed'].includes(ticket.status) && <button className="btn btn-primary w-full" disabled={busy} onClick={() => changeStatus('in_progress')}>▶ Start Working</button>}
              {ticket.status === 'in_progress' && <button className="btn btn-primary w-full" disabled={busy} onClick={() => changeStatus('resolved')}>✅ Resolve</button>}
              {ticket.status === 'resolved' && <button className="btn btn-ghost w-full" disabled={busy} onClick={() => changeStatus('closed')}>🔒 Close</button>}
              {['escalated','pending_hil'].includes(ticket.status) && <button className="btn btn-secondary w-full" disabled={busy} onClick={() => changeStatus('in_progress')}>👤 Accept</button>}
            </div>
          </div>

          {/* Routing */}
          {ticket.routing_target && (
            <div className="card mb-4">
              <div className="card-header"><span className="card-title">🗺️ Routing</span></div>
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px' }}>{ticket.routing_target === 'SRE-Team' ? '🔧' : ticket.routing_target === 'DevOps-Team' ? '🚀' : ticket.routing_target === 'Engineering-Team' ? '💻' : '📋'}</div>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{ticket.routing_target}</div>
                <div style={{ fontSize: '11px', color: 'var(--neutral-4)', marginTop: '4px' }}>Loop count: {ticket.loop_count}</div>
              </div>
            </div>
          )}

          {ticket.parent_id && (
            <div className="card mb-4">
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--neutral-4)', marginBottom: '6px' }}>Split from parent</div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/support/ticket/${ticket.parent_id}`)}>↑ Parent Ticket</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
