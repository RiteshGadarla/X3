import { useState, useEffect } from 'react'
import client from '../../api/client'
import {
  DonutChart, BarChart, LineChart, Gauge, Heatmap, BRAND
} from '../../components/charts/Charts'
import Icon from '../../components/ui/Icons'
import DashboardHero from '../../components/ui/DashboardHero'

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

  useEffect(() => { fetchAnalytics() }, [])

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
    setSweeping(true); setSweepMessage('')
    try {
      const res = await client.post('/analytics/sweep')
      setSweepMessage(`Sweep complete: ${res.data.details.deleted_records} records deleted (Older than ${res.data.details.cutoff_date.substring(0, 10)})`)
    } catch (err) {
      setSweepMessage(`Sweep failed: ${err.message}`)
    } finally {
      setSweeping(false)
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading analytics...</div>

  const totalSentiments = Object.values(data.sentiment_distribution).reduce((a, b) => a + b, 0) || 1
  const resolvedRate    = data.total_tickets ? Math.round((data.resolved_tickets / data.total_tickets) * 100) : 0
  const breachRate      = data.total_tickets ? Math.round((data.sla_breached_active / data.total_tickets) * 100) : 0
  const slaHealth       = Math.max(0, 100 - breachRate)

  const sentimentDist = Object.entries(data.sentiment_distribution).map(([k, v]) => ({
    label: k,
    value: v,
    color: k === 'positive' ? BRAND.success
          : k === 'angry'    ? BRAND.error
          : k === 'negative' ? BRAND.warning
          : BRAND.primary,
  }))

  const heatRows = (data.voc_heatmap || []).map(r => r.day)
  const heatVals = (data.voc_heatmap || []).map(r => [r.positive, r.neutral, r.negative, r.angry])
  const heatCols = [
    { key: 'positive', label: 'Positive', color: BRAND.success },
    { key: 'neutral',  label: 'Neutral',  color: BRAND.primary },
    { key: 'negative', label: 'Negative', color: BRAND.warning },
    { key: 'angry',    label: 'Angry',    color: BRAND.error   },
  ]

  // Real weekly volume series derived from heatmap totals
  const volumeSeries = (data.voc_heatmap || []).map(r => ({
    label: r.day,
    value: (r.positive || 0) + (r.neutral || 0) + (r.negative || 0) + (r.angry || 0),
  }))

  // Sentiment shape — bar split
  const sentimentBar = sentimentDist.map(s => ({
    label: s.label.charAt(0).toUpperCase() + s.label.slice(1),
    value: s.value,
    color: s.color,
  }))

  const positiveShare = Math.round(((data.sentiment_distribution.positive || 0) / totalSentiments) * 100)
  const angryCount    = data.sentiment_distribution.angry || 0
  const volumeTotal   = volumeSeries.reduce((s, v) => s + v.value, 0)

  const heroKpis = [
    {
      label: 'Resolution',
      value: `${resolvedRate}%`,
      foot: `${data.resolved_tickets}/${data.total_tickets}`,
      tone: resolvedRate >= 80 ? 'up' : resolvedRate >= 60 ? 'warn' : 'down',
    },
    {
      label: 'SLA Health',
      value: `${slaHealth}%`,
      foot: `${breachRate}% breached · target ≥ 95%`,
      tone: slaHealth >= 95 ? 'up' : slaHealth >= 80 ? 'warn' : 'down',
    },
    {
      label: 'Active Breaches',
      value: data.sla_breached_active || 0,
      foot: 'open SLA misses',
      tone: (data.sla_breached_active || 0) > 0 ? 'down' : 'up',
    },
    {
      label: 'Positive Voices',
      value: `${positiveShare}%`,
      foot: angryCount > 0 ? `${angryCount} angry flagged` : 'sentiment share',
      tone: angryCount > 2 ? 'down' : positiveShare >= 60 ? 'up' : null,
    },
    {
      label: 'Volume 7d',
      value: volumeTotal,
      foot: 'inbound trend',
      sparkline: volumeSeries.length > 0 ? volumeSeries.map(v => v.value) : null,
    },
  ]

  return (
    <div>
      <DashboardHero
        live="Analytics · Live"
        title="Analytics & Compliance"
        subtitle="Operational telemetry: SLA compliance, sentiment radar and 7-day pulse."
        meta={`${data.total_tickets} tickets observed · ${data.resolved_tickets} resolved`}
        kpis={heroKpis}
      />

      {/* ── Row: Sentiment Mix + SLA Gauge (compact) + 7-Day Volume ── */}
      <div className="dash-grid-3">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.sparkle /></span>
              Sentiment Mix
            </div>
            <span className="badge badge-pink">Live</span>
          </div>
          <div className="chart-card-body">
            {sentimentDist.length > 0
              ? <DonutChart data={sentimentDist} size={150} centerLabel="VOICES" />
              : <div style={{ fontSize: 13, color: 'var(--neutral-4)' }}>No sentiment data.</div>}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.shield /></span>
              SLA Compliance
            </div>
            <span className={`badge ${slaHealth >= 90 ? 'badge-success' : slaHealth >= 75 ? 'badge-warning' : 'badge-error'}`}>
              {slaHealth >= 90 ? 'Healthy' : slaHealth >= 75 ? 'At Risk' : 'Critical'}
            </span>
          </div>
          <div className="chart-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Gauge value={slaHealth} max={100} size={120} label="Health Index" color={slaHealth >= 90 ? BRAND.success : slaHealth >= 75 ? BRAND.warning : BRAND.error} />
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--neutral-4)', textAlign: 'center' }}>
              Target ≥ 95% · {data.sla_breached_active} active breach{data.sla_breached_active === 1 ? '' : 'es'}
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.trend /></span>
              7-Day Volume
            </div>
            <span className="badge badge-primary">Inbound</span>
          </div>
          <div className="chart-card-body">
            {volumeSeries.length > 0 ? (
              <LineChart data={volumeSeries} color={BRAND.primary} label="anvol" height={150} />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--neutral-4)', padding: '30px 0', textAlign: 'center' }}>
                No volume data yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row: Sentiment bars + VoC Heatmap (compact, side-by-side) ── */}
      <div className="dash-grid-2">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.chart /></span>
              Sentiment Distribution
            </div>
            <span className="badge badge-cyan">Snapshot</span>
          </div>
          <div className="chart-card-body">
            {sentimentBar.length > 0
              ? <BarChart data={sentimentBar} horizontal height={180} />
              : <div style={{ fontSize: 13, color: 'var(--neutral-4)' }}>No data yet.</div>}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.beaker /></span>
              Voice of Customer — Heatmap
            </div>
            <span className="badge badge-pink">Weekly</span>
          </div>
          <div className="chart-card-body heatmap-compact">
            {heatRows.length > 0
              ? <Heatmap rows={heatRows} columns={heatCols} values={heatVals} />
              : <div style={{ fontSize: 13, color: 'var(--neutral-4)' }}>No data yet.</div>}
          </div>
        </div>
      </div>

      {/* ── Last: 7-Year Data Retention (compliance, low-priority) ── */}
      <div className="chart-card" style={{ marginTop: 6 }}>
        <div className="chart-card-head">
          <div className="chart-card-title">
            <span className="chart-card-title-icon"><Icon.scale /></span>
            7-Year Data Retention
          </div>
          <span className="badge badge-warning">Compliance</span>
        </div>
        <div className="chart-card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <p style={{ fontSize: '12.5px', color: 'var(--neutral-4)', flex: '1 1 320px', margin: 0 }}>
            Enterprise compliance requires support records older than 7 years to be archived & purged. Run a manual sweep on demand.
          </p>
          <button
            id="analytics-sweep"
            onClick={triggerSweep}
            disabled={sweeping}
            className="btn btn-primary btn-sm"
            style={{ padding: '8px 16px', fontSize: '13px', flex: '0 0 auto' }}>
            {sweeping ? 'Sweeping database…' : 'Trigger Data Consent Sweep'}
          </button>
          {sweepMessage && (
            <div style={{
              flex: '1 1 100%',
              marginTop: 4, padding: '10px 12px',
              borderRadius: 'var(--radius-sm)', fontSize: '12.5px',
              background: sweepMessage.startsWith('Sweep complete') ? 'var(--success-light)' : 'var(--error-light)',
              color: sweepMessage.startsWith('Sweep complete') ? 'var(--success)' : 'var(--error)',
              border: `1px solid ${sweepMessage.startsWith('Sweep complete') ? 'var(--success)' : 'var(--error)'}`
            }}>
              {sweepMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
