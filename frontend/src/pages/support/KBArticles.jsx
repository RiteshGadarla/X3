import { useState, useEffect } from 'react'
import client from '../../api/client'
import { useRole } from '../../hooks/useRole'
import { DonutChart, BarChart, Sparkline, BRAND } from '../../components/charts/Charts'
import Icon from '../../components/ui/Icons'

export default function KBArticles() {
  const { role } = useRole()
  const canManageKB   = ['Admin', 'Manager'].includes(role)
  const canViewDrafts = ['Admin', 'Manager', 'Legal'].includes(role)

  const [drafts, setDrafts]       = useState([])
  const [published, setPublished] = useState([])
  const [activeTab, setActiveTab] = useState(canViewDrafts ? 'drafts' : 'published')
  const [loading, setLoading]     = useState(true)
  const [actionMsg, setActionMsg] = useState('')
  const [expanded, setExpanded]   = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const requests = [client.get('/kb/articles')]
      if (canViewDrafts) requests.unshift(client.get('/kb/drafts'))

      const results = await Promise.all(requests)
      if (canViewDrafts) {
        setDrafts(results[0].data.data)
        setPublished(results[1].data.data)
      } else {
        setPublished(results[0].data.data)
      }
    } catch (err) {
      console.error('KB fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const doAction = async (id, action) => {
    setActionMsg('')
    try {
      const res = await client.post(`/kb/drafts/${id}/${action}`)
      setActionMsg(`OK · ${res.data.message}`)
      fetchData()
    } catch (err) {
      setActionMsg(`ERROR · ${err.response?.data?.detail || err.message}`)
    }
  }

  const tabStyle = active => ({
    padding: '8px 20px',
    borderRadius: 'var(--radius-pill)',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    border: 'none',
    background: active ? 'var(--primary)' : 'var(--neutral-7)',
    color: active ? '#fff' : 'var(--neutral-2)',
    transition: 'all .15s',
  })

  const totalArticles = drafts.length + published.length
  const publishRatio  = totalArticles ? Math.round((published.length / totalArticles) * 100) : 0

  // Real per-day publishing trend over the last 7 days from `published_at`
  const dayKeys = []
  const dayLabels = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dayKeys.push(d.toISOString().slice(0, 10))
    dayLabels.push(d.toLocaleDateString(undefined, { weekday: 'short' }))
  }
  const publishedByDay = dayKeys.map(k =>
    published.filter(a => a.published_at && a.published_at.slice(0, 10) === k).length
  )
  const draftsByDay = dayKeys.map(k =>
    drafts.filter(a => a.created_at && a.created_at.slice(0, 10) === k).length
  )
  const trendTotal = publishedByDay.reduce((a, b) => a + b, 0)

  // Charts data
  const stateMix = [
    { label: 'Drafts',    value: drafts.length,    color: BRAND.warning },
    { label: 'Published', value: published.length, color: BRAND.success },
  ]

  return (
    <div>
      {/* ── Insight Hero ──────────────────────────────────────────── */}
      <div className="insight-hero">
        <div className="insight-hero-grid">
          <div>
            <div className="insight-hero-chips" style={{ marginBottom: 12 }}>
              <span className="insight-chip"><span className="insight-chip-dot" /> Knowledge Hub</span>
            </div>
            <h1 className="insight-hero-title">Knowledge Base Articles</h1>
            <p className="insight-hero-sub">
              {canManageKB
                ? 'AI drafts new KB articles from resolved tickets. Review, refine and publish — published articles are indexed into RAG for the agents.'
                : role === 'Legal'
                  ? 'Compliance & legal review queue. Vet AI-generated drafts before they reach customers and the agent corpus.'
                  : 'Browse the canonical knowledge base. Articles here power the AI assistant.'}
            </p>
            <div className="insight-hero-chips">
              <span className="insight-chip">{totalArticles} articles total</span>
              <span className="insight-chip">{published.length} live in RAG</span>
              {drafts.length > 0 && <span className="insight-chip" style={{ background: 'rgba(228,144,46,.35)' }}>{drafts.length} pending review</span>}
            </div>
          </div>

          <div className="hero-kpis">
            <div className="hero-kpi">
              <div className="hero-kpi-label">Published</div>
              <div className="hero-kpi-value">{published.length}</div>
              <div className="hero-kpi-foot">live in RAG</div>
            </div>
            <div className="hero-kpi">
              <div className="hero-kpi-label">Drafts</div>
              <div className="hero-kpi-value">{drafts.length}</div>
              <div className="hero-kpi-foot">awaiting review</div>
            </div>
            <div className="hero-kpi">
              <div className="hero-kpi-label">Publish Ratio</div>
              <div className="hero-kpi-value">{publishRatio}%</div>
              <div className="hero-kpi-foot">of total corpus</div>
            </div>
            {trendTotal > 0 && (
              <div className="hero-kpi">
                <div className="hero-kpi-label">Published 7d</div>
                <div className="hero-kpi-value">{trendTotal}</div>
                <div className="hero-kpi-foot">
                  <Sparkline data={publishedByDay} width={80} height={20} color="#fff" fill={false} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Charts row ────────────────────────────────────────────── */}
      <div className="dash-grid-2">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.book /></span>
              Article Lifecycle
            </div>
            <span className="badge badge-primary">Drafts vs Live</span>
          </div>
          <div className="chart-card-body">
            {totalArticles > 0
              ? <DonutChart data={stateMix} size={170} centerLabel="ARTICLES" />
              : <div style={{ fontSize: 13, color: 'var(--neutral-4)' }}>No articles yet.</div>}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.trend /></span>
              7-Day Publishing Pace
            </div>
            <span className="badge badge-cyan">Drafts vs Published</span>
          </div>
          <div className="chart-card-body">
            {(trendTotal + draftsByDay.reduce((a, b) => a + b, 0)) > 0 ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Published per day</div>
                  <BarChart
                    data={dayLabels.map((d, i) => ({ label: d, value: publishedByDay[i], color: BRAND.success }))}
                    height={120}
                  />
                </div>
                {drafts.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--neutral-4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Drafts created per day</div>
                    <BarChart
                      data={dayLabels.map((d, i) => ({ label: d, value: draftsByDay[i], color: BRAND.warning }))}
                      height={120}
                    />
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--neutral-4)', padding: '30px 0', textAlign: 'center' }}>
                No publishing activity in the last 7 days.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {canViewDrafts && (
          <button id="kb-tab-drafts" style={tabStyle(activeTab === 'drafts')} onClick={() => setActiveTab('drafts')}>
            Pending Review ({drafts.length})
          </button>
        )}
        <button id="kb-tab-published" style={tabStyle(activeTab === 'published')} onClick={() => setActiveTab('published')}>
          Published ({published.length})
        </button>
      </div>

      {actionMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontSize: '13px',
          background: actionMsg.startsWith('OK') ? 'var(--success-light)' : 'var(--error-light)',
          color: actionMsg.startsWith('OK') ? 'var(--success)' : 'var(--error)',
          border: `1px solid ${actionMsg.startsWith('OK') ? 'var(--success)' : 'var(--error)'}`,
        }}>
          {actionMsg}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '20px', color: 'var(--neutral-4)' }}>Loading KB articles...</div>
      ) : activeTab === 'drafts' ? (
        drafts.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '40px', color: 'var(--neutral-4)' }}>
              No pending KB drafts. New ones are generated when tickets are resolved.
            </div>
          </div>
        ) : (
          drafts.map(draft => (
            <div key={draft.id} className="card" style={{ marginBottom: '16px', borderLeft: '4px solid var(--warning)' }}>
              <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === draft.id ? null : draft.id)}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--neutral-0)' }}>{draft.title}</h3>
                  {draft.source_ticket_ref && (
                    <span style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>
                      Source: {draft.source_ticket_ref} · {new Date(draft.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <span style={{ color: 'var(--neutral-4)', fontSize: '18px' }}>{expanded === draft.id ? '▲' : '▼'}</span>
              </div>

              {expanded === draft.id && (
                <div className="card-body" style={{ borderTop: '1px solid var(--neutral-7)' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: 'var(--neutral-2)', fontFamily: 'inherit', margin: '0 0 20px' }}>
                    {draft.content}
                  </pre>
                  {canManageKB ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        id={`kb-publish-${draft.id}`}
                        className="btn btn-primary"
                        style={{ padding: '8px 20px', fontSize: '13px' }}
                        onClick={() => doAction(draft.id, 'publish')}
                      >
                        Publish to KB
                      </button>
                      <button
                        id={`kb-reject-${draft.id}`}
                        className="btn"
                        style={{ padding: '8px 20px', fontSize: '13px', background: 'var(--error-light)', color: 'var(--error)', border: '1px solid var(--error)' }}
                        onClick={() => doAction(draft.id, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--neutral-4)', fontStyle: 'italic' }}>
                      View only — publication requires Manager or Admin role
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )
      ) : (
        published.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '40px', color: 'var(--neutral-4)' }}>
              No published KB articles yet.
            </div>
          </div>
        ) : (
          published.map(article => (
            <div key={article.id} className="card" style={{ marginBottom: '16px', borderLeft: '4px solid var(--success)' }}>
              <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === article.id ? null : article.id)}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--neutral-0)' }}>{article.title}</h3>
                  <span style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>
                    Published {article.published_at ? new Date(article.published_at).toLocaleDateString() : '—'}
                    {article.source_ticket_ref && ` · Source: ${article.source_ticket_ref}`}
                  </span>
                </div>
                <span className="badge badge-success">Live in RAG</span>
              </div>
              {expanded === article.id && (
                <div className="card-body" style={{ borderTop: '1px solid var(--neutral-7)' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: 'var(--neutral-2)', fontFamily: 'inherit', margin: 0 }}>
                    {article.content}
                  </pre>
                </div>
              )}
            </div>
          ))
        )
      )}
    </div>
  )
}
