import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { DonutChart, BarChart, Gauge, BRAND } from '../../components/charts/Charts'
import Icon from '../../components/ui/Icons'
import { useRole } from '../../hooks/useRole'

const PB = { P1: 'badge-error', P2: 'badge-warning', P3: 'badge-primary', P4: 'badge-neutral' }
const SB = { new: 'badge-cyan', triaged: 'badge-primary', in_progress: 'badge-warning', escalated: 'badge-error', pending_hil: 'badge-pink', resolved: 'badge-success', closed: 'badge-neutral' }

export default function SDLCTracker() {
  const navigate = useNavigate()
  const { basePath } = useRole()
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

  const passed   = items.filter(i => i.devops_ok && i.qa_ok)
  const pending  = items.filter(i => !i.devops_ok || !i.qa_ok)
  const devopsOk = items.filter(i => i.devops_ok).length
  const qaOk     = items.filter(i => i.qa_ok).length
  const passRate = items.length ? Math.round((passed.length / items.length) * 100) : 100

  // Real routing-target distribution from items
  const routingCounts = pending.reduce((acc, t) => {
    const k = t.routing_target || 'Unrouted'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const routingBars = Object.entries(routingCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v], i) => ({
      label: k,
      value: v,
      color: [BRAND.primary, BRAND.cyan, BRAND.pink, BRAND.warning][i] || BRAND.neutral4,
    }))

  // SLA-at-risk items (deadline already passed but gate not yet through)
  const now = Date.now()
  const slaAtRisk = pending.filter(t => t.sla_deadline && new Date(t.sla_deadline).getTime() < now).length

  return (
    <div>
      {/* ── Insight Hero ──────────────────────────────────────────── */}
      <div className="insight-hero">
        <div className="insight-hero-grid">
          <div>
            <div className="insight-hero-chips" style={{ marginBottom: 12 }}>
              <span className="insight-chip"><span className="insight-chip-dot" /> Dual Confirmation</span>
              <span className="insight-chip">DevOps · QA · 2-key gate</span>
            </div>
            <h1 className="insight-hero-title">SDLC Deployment Gate</h1>
            <p className="insight-hero-sub">
              Engineering tickets cannot be resolved until both DevOps confirms deployment and QA confirms tests. This board is the single source of truth.
            </p>
            <div className="insight-hero-chips">
              <span className="insight-chip">{items.length} tracked</span>
              <span className="insight-chip" style={{ background: 'rgba(22,163,74,.35)' }}>{passed.length} passed</span>
              {pending.length > 0 && <span className="insight-chip" style={{ background: 'rgba(228,144,46,.35)' }}>{pending.length} pending</span>}
            </div>
          </div>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <div className="hero-kpi-label">Pass Rate</div>
              <div className="hero-kpi-value">{passRate}%</div>
              <div className="hero-kpi-foot">{passed.length}/{items.length}</div>
            </div>
            <div className="hero-kpi">
              <div className="hero-kpi-label">DevOps OK</div>
              <div className="hero-kpi-value">{devopsOk}</div>
              <div className="hero-kpi-foot">deploy gate</div>
            </div>
            <div className="hero-kpi">
              <div className="hero-kpi-label">QA OK</div>
              <div className="hero-kpi-value">{qaOk}</div>
              <div className="hero-kpi-foot">test gate</div>
            </div>
            <div className="hero-kpi">
              <div className="hero-kpi-label">SLA at Risk</div>
              <div className="hero-kpi-value">{slaAtRisk}</div>
              <div className="hero-kpi-foot">deadline passed</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts row ────────────────────────────────────────────── */}
      <div className="dash-grid-3">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.shield /></span>
              Gate Pass Rate
            </div>
            <span className={`badge ${passRate >= 80 ? 'badge-success' : passRate >= 50 ? 'badge-warning' : 'badge-error'}`}>
              {passRate >= 80 ? 'Healthy' : passRate >= 50 ? 'Slow' : 'Blocked'}
            </span>
          </div>
          <div className="chart-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Gauge value={passRate} max={100} size={170} label="Both Gates Passed" color={passRate >= 80 ? BRAND.success : passRate >= 50 ? BRAND.warning : BRAND.error} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.build /></span>
              Gate Mix
            </div>
            <span className="badge badge-primary">DevOps · QA</span>
          </div>
          <div className="chart-card-body">
            <DonutChart
              data={[
                { label: 'Both passed',    value: passed.length, color: BRAND.success },
                { label: 'DevOps only',    value: items.filter(i => i.devops_ok && !i.qa_ok).length, color: BRAND.cyan },
                { label: 'QA only',        value: items.filter(i => !i.devops_ok && i.qa_ok).length, color: BRAND.primary },
                { label: 'Neither',        value: items.filter(i => !i.devops_ok && !i.qa_ok).length, color: BRAND.error },
              ]}
              size={170}
              centerLabel="ITEMS"
            />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.fire /></span>
              Pending by Team
            </div>
            <span className="badge badge-cyan">Routing</span>
          </div>
          <div className="chart-card-body">
            {routingBars.length > 0 ? (
              <BarChart data={routingBars} horizontal height={200} />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--neutral-4)', padding: '30px 0', textAlign: 'center' }}>
                No pending engineering tickets.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">Awaiting Dual Confirmation ({pending.length})</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="live-pulse" />
            <span style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>Auto-refresh 30s</span>
            <button id="sdlc-refresh" className="btn btn-secondary btn-sm" onClick={load}>
              <Icon.refresh /> Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--neutral-4)' }}>Loading…</div>
        ) : pending.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', width: 64, height: 64, borderRadius: '50%', background: 'var(--success-light)', color: 'var(--success)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Icon.check width="32" height="32" />
            </div>
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
                        if (tid) navigate(`${basePath}/ticket/${tid}`)
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
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: t.devops_ok ? 'var(--success-light)' : 'var(--neutral-7)',
                      color: t.devops_ok ? 'var(--success)' : 'var(--neutral-4)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {t.devops_ok ? <Icon.check width="14" height="14" /> : <Icon.clock width="14" height="14" />}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>DevOps</div>
                      <div style={{ fontSize: '10px', color: 'var(--neutral-4)' }}>{t.devops_ok ? 'Passed' : 'Pending'}</div>
                    </div>
                    {!t.devops_ok && (
                      <button
                        id={`sdlc-confirm-devops-${t.ticket_ref}`}
                        className="btn btn-primary btn-sm"
                        disabled={busy === `${t.ticket_ref}-devops`}
                        onClick={() => approve(t.ticket_ref, 'devops')}
                      >
                        Confirm
                      </button>
                    )}
                  </div>
                  <div className="sdlc-gate-pill">
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: t.qa_ok ? 'var(--success-light)' : 'var(--neutral-7)',
                      color: t.qa_ok ? 'var(--success)' : 'var(--neutral-4)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {t.qa_ok ? <Icon.check width="14" height="14" /> : <Icon.clock width="14" height="14" />}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '12px' }}>QA Tests</div>
                      <div style={{ fontSize: '10px', color: 'var(--neutral-4)' }}>{t.qa_ok ? 'Passed' : 'Pending'}</div>
                    </div>
                    {!t.qa_ok && (
                      <button
                        id={`sdlc-confirm-qa-${t.ticket_ref}`}
                        className="btn btn-primary btn-sm"
                        disabled={busy === `${t.ticket_ref}-qa`}
                        onClick={() => approve(t.ticket_ref, 'qa')}
                      >
                        Confirm
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
