import { useEffect, useState } from 'react'
import client from '../../api/client'

const PRIORITY_INFO = {
  P1: { label: 'P1 — Critical', color: 'var(--error)', bg: 'var(--error-light)', desc: 'Server outages, security incidents' },
  P2: { label: 'P2 — High',     color: 'var(--warning)', bg: 'var(--warning-light)', desc: 'Major feature failures' },
  P3: { label: 'P3 — Medium',   color: 'var(--primary)', bg: 'var(--primary-light)', desc: 'Degraded performance' },
  P4: { label: 'P4 — Low',      color: 'var(--success)', bg: 'var(--success-light)', desc: 'Questions, feature requests' },
}

export default function SLAConfig() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [editing, setEditing] = useState({})
  const [message, setMessage] = useState('')

  const fetchConfigs = async () => {
    setLoading(true)
    try {
      const { data } = await client.get('/sla')
      setConfigs(data)
      const init = {}
      data.forEach(c => { init[c.priority] = { response_time_minutes: c.response_time_minutes, resolution_time_minutes: c.resolution_time_minutes } })
      setEditing(init)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchConfigs() }, [])

  const handleSave = async (priority) => {
    setSaving(s => ({ ...s, [priority]: 'saving' }))
    try {
      await client.patch(`/sla/${priority}`, editing[priority])
      setMessage(`✅ ${priority} SLA updated. Admin approval required before AI agents use it.`)
      fetchConfigs()
    } catch (err) {
      setMessage(`❌ Failed to update ${priority}: ${err.response?.data?.detail || err.message}`)
    } finally {
      setSaving(s => ({ ...s, [priority]: null }))
    }
  }

  const handleApprove = async (priority, approved) => {
    setSaving(s => ({ ...s, [`${priority}_approve`]: true }))
    try {
      await client.post(`/sla/${priority}/approve`, { approved })
      setMessage(approved ? `✅ ${priority} SLA approved — AI agents can now use it.` : `⚠️ ${priority} SLA approval revoked.`)
      fetchConfigs()
    } catch (err) { console.error(err) }
    finally { setSaving(s => ({ ...s, [`${priority}_approve`]: false })) }
  }

  const minsToLabel = (m) => {
    if (m < 60) return `${m} min`
    if (m < 1440) return `${m / 60} hr`
    return `${m / 1440} day`
  }

  return (
    <div>
      <div className="page-banner" style={{ marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
        <h1>SLA Configuration (HIL-1)</h1>
        <p>Configure response and resolution time targets per priority level. All changes require Admin approval before AI agents use them.</p>
      </div>

      {/* HIL-1 callout */}
      <div style={{ background: 'var(--warning-light)', border: '1px solid var(--warning)', borderRadius: 'var(--radius-md)', padding: '14px 18px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '20px' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#92400E', marginBottom: '3px' }}>HIL-1 Checkpoint Active</div>
          <div style={{ fontSize: '12px', color: '#92400E' }}>
            AI agents will not apply SLA rules until an Admin explicitly approves them. Any edit resets approval status and requires re-approval.
          </div>
        </div>
      </div>

      {message && (
        <div style={{ background: 'var(--primary-light)', border: '1px solid var(--primary-border)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', marginBottom: '20px', fontSize: '13px', color: 'var(--primary)' }}>
          {message}
          <button onClick={() => setMessage('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neutral-4)' }}>×</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {loading ? <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '60px', color: 'var(--neutral-4)' }}>Loading SLA configs…</div> :
          configs.map((config) => {
            const info = PRIORITY_INFO[config.priority] || {}
            const edit = editing[config.priority] || {}
            return (
              <div key={config.priority} className="card" style={{ borderTop: `3px solid ${info.color}` }}>
                <div className="card-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 800, fontSize: '15px', color: info.color }}>{config.priority}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--neutral-0)' }}>{info.label?.split('—')[1]?.trim()}</span>
                      {config.approved_by_admin
                        ? <span className="badge badge-success" style={{ fontSize: '10px' }}>✓ Approved</span>
                        : <span className="badge badge-warning" style={{ fontSize: '10px' }}>Pending Approval</span>
                      }
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>{info.desc}</div>
                  </div>
                </div>

                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Response Time</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          value={edit.response_time_minutes || ''}
                          onChange={e => setEditing(prev => ({ ...prev, [config.priority]: { ...prev[config.priority], response_time_minutes: parseInt(e.target.value) } }))}
                          style={{ width: '90px' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--neutral-4)' }}>min → {minsToLabel(edit.response_time_minutes)}</span>
                      </div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Resolution Time</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          className="form-input"
                          min={1}
                          value={edit.resolution_time_minutes || ''}
                          onChange={e => setEditing(prev => ({ ...prev, [config.priority]: { ...prev[config.priority], resolution_time_minutes: parseInt(e.target.value) } }))}
                          style={{ width: '90px' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--neutral-4)' }}>min → {minsToLabel(edit.resolution_time_minutes)}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleSave(config.priority)}
                      disabled={saving[config.priority] === 'saving'}
                    >
                      {saving[config.priority] === 'saving' ? 'Saving…' : '💾 Save Changes'}
                    </button>
                    {!config.approved_by_admin ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleApprove(config.priority, true)}
                        disabled={saving[`${config.priority}_approve`]}
                      >
                        ✅ Approve for AI
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleApprove(config.priority, false)}
                      >
                        Revoke Approval
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
