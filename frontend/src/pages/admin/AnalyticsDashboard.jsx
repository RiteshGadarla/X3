import { useState, useEffect } from 'react'
import client from '../../api/client'

export default function AnalyticsDashboard() {
  const [data, setData] = useState({
    total_tickets: 0,
    resolved_tickets: 0,
    sla_breached_active: 0,
    sentiment_distribution: {},
    voc_heatmap: []
  })
  const [loading, setLoading] = useState(true)
  const [sweepMessage, setSweepMessage] = useState('')
  const [sweeping, setSweeping] = useState(false)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const res = await client.get('/analytics/reports')
      setData(res.data.data)
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const triggerSweep = async () => {
    setSweeping(true)
    setSweepMessage('')
    try {
      const res = await client.post('/analytics/sweep')
      setSweepMessage(`✅ Sweep complete: ${res.data.details.deleted_records} records deleted (Older than ${res.data.details.cutoff_date.substring(0, 10)})`)
    } catch (err) {
      setSweepMessage(`❌ Sweep failed: ${err.message}`)
    } finally {
      setSweeping(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading analytics...</div>
  }

  // Calculate sentiment percentages
  const totalSentiments = Object.values(data.sentiment_distribution).reduce((a, b) => a + b, 0) || 1
  
  return (
    <div>
      <div className="page-banner" style={{ marginBottom: '24px', borderRadius: 'var(--radius-md)', background: 'var(--gradient-banner)' }}>
        <h1 style={{ color: '#fff' }}>Analytics & Compliance</h1>
        <p style={{ color: 'rgba(255,255,255,0.85)' }}>SLA Compliance, Voice of Customer, and Data Privacy controls.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="card-body">
            <div style={{ fontSize: '13px', color: 'var(--neutral-4)', fontWeight: 600 }}>TOTAL TICKETS</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--neutral-0)' }}>{data.total_tickets}</div>
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="card-body">
            <div style={{ fontSize: '13px', color: 'var(--neutral-4)', fontWeight: 600 }}>RESOLVED (FCR & STANDARD)</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--success)' }}>{data.resolved_tickets}</div>
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--error)' }}>
          <div className="card-body">
            <div style={{ fontSize: '13px', color: 'var(--neutral-4)', fontWeight: 600 }}>ACTIVE SLA BREACHES</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--error)' }}>{data.sla_breached_active}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--neutral-0)' }}>Customer Sentiment</h3>
            <span className="badge badge-primary">UI-03</span>
          </div>
          <div className="card-body">
            {Object.entries(data.sentiment_distribution).map(([sentiment, count]) => {
              const percent = Math.round((count / totalSentiments) * 100)
              let color = 'var(--neutral-4)'
              if (sentiment === 'positive') color = 'var(--success)'
              if (sentiment === 'angry') color = 'var(--error)'
              if (sentiment === 'negative') color = 'var(--warning)'
              if (sentiment === 'neutral') color = 'var(--primary)'

              return (
                <div key={sentiment} style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--neutral-1)' }}>
                    <span style={{ textTransform: 'uppercase' }}>{sentiment}</span>
                    <span>{count} ({percent}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--neutral-7)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'width 0.5s' }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--neutral-0)' }}>7-Year Data Retention Policy</h3>
            <span className="badge badge-warning">AG-17</span>
          </div>
          <div className="card-body">
            <p style={{ fontSize: '13px', color: 'var(--neutral-4)', marginBottom: '20px' }}>
              Enterprise compliance requires all support records older than 7 years to be automatically archived and deleted. You can trigger the manual sweep below.
            </p>
            <button 
              onClick={triggerSweep} 
              disabled={sweeping}
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
              {sweeping ? '⏳ Sweeping Database...' : '🧹 Trigger Data Consent Sweep'}
            </button>
            
            {sweepMessage && (
              <div style={{ 
                marginTop: '16px', 
                padding: '12px', 
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                background: sweepMessage.startsWith('✅') ? 'var(--success-light)' : 'var(--error-light)',
                color: sweepMessage.startsWith('✅') ? 'var(--success)' : 'var(--error)',
                border: `1px solid ${sweepMessage.startsWith('✅') ? 'var(--success)' : 'var(--error)'}`
              }}>
                {sweepMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--neutral-0)' }}>Voice of Customer Heatmap (Mock Data)</h3>
          <span className="badge badge-pink">UI-08</span>
        </div>
        <div className="card-body">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px', borderBottom: '2px solid var(--neutral-7)', color: 'var(--neutral-4)' }}>Day</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid var(--neutral-7)', color: 'var(--success)' }}>Positive</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid var(--neutral-7)', color: 'var(--primary)' }}>Neutral</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid var(--neutral-7)', color: 'var(--warning)' }}>Negative</th>
                  <th style={{ padding: '12px', borderBottom: '2px solid var(--neutral-7)', color: 'var(--error)' }}>Angry</th>
                </tr>
              </thead>
              <tbody>
                {data.voc_heatmap.map((row, idx) => {
                  // Normalize alpha based on max value per row (~100)
                  const getAlpha = (val) => Math.min(val / 80, 1).toFixed(2);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--neutral-8)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{row.day}</td>
                      <td style={{ padding: '12px', background: `rgba(22, 163, 74, ${getAlpha(row.positive)})` }}>{row.positive}</td>
                      <td style={{ padding: '12px', background: `rgba(89, 41, 208, ${getAlpha(row.neutral)})` }}>{row.neutral}</td>
                      <td style={{ padding: '12px', background: `rgba(228, 144, 46, ${getAlpha(row.negative)})` }}>{row.negative}</td>
                      <td style={{ padding: '12px', background: `rgba(220, 38, 38, ${getAlpha(row.angry)})` }}>{row.angry}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
