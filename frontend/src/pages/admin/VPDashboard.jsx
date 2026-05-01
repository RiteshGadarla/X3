import { useState, useEffect } from 'react'
import client from '../../api/client'
import {
  DonutChart, BarChart, LineChart, Gauge, Heatmap, StackedBar, BRAND
} from '../../components/charts/Charts'
import Icon from '../../components/ui/Icons'
import DashboardHero from '../../components/ui/DashboardHero'

export default function VPDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    client.get('/analytics/executive')
      .then(res => setData(res.data.data))
      .catch(() => setError('Failed to load executive dashboard. Check your role permissions.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '20px' }}>Loading executive dashboard...</div>
  if (error)   return <div style={{ padding: '20px', color: 'var(--error)' }}>{error}</div>

  // Derived insights
  const fcrRate    = data.fcr_rate_percent || 0
  const slaBreach  = data.sla_breach_rate_percent || 0
  const slaHealth  = Math.max(0, Math.round(100 - slaBreach))
  const totalP12   = (data.p1_open || 0) + (data.p2_open || 0)
  const resolution = data.total_tickets ? Math.round((data.resolved_tickets / data.total_tickets) * 100) : 0

  // Real per-day volume series derived from VoC heatmap
  const dailyVolume = (data.voc_heatmap || []).map(r =>
    (r.positive || 0) + (r.neutral || 0) + (r.negative || 0) + (r.angry || 0)
  )
  const dailyVolumeTotal = dailyVolume.reduce((a, b) => a + b, 0)

  const priorityDist = [
    { label: 'P1', value: data.p1_open || 0,           color: BRAND.error },
    { label: 'P2', value: data.p2_open || 0,           color: BRAND.warning },
    { label: 'Escalated', value: data.escalated_pending || 0, color: BRAND.pink },
    { label: 'Resolved', value: data.resolved_tickets || 0, color: BRAND.success },
  ]

  const sentimentDist = data.sentiment_distribution
    ? Object.entries(data.sentiment_distribution).map(([k, v]) => ({
        label: k,
        value: v,
        color: k === 'positive' ? BRAND.success
              : k === 'angry'    ? BRAND.error
              : k === 'negative' ? BRAND.warning
              : BRAND.primary,
      }))
    : []

  const recurringBars = (data.top_recurring_issues || []).slice(0, 6).map((r, i) => ({
    label: r.category,
    value: r.count,
    color: i === 0 ? BRAND.error : i === 1 ? BRAND.warning : BRAND.primary,
  }))

  const heatRows = (data.voc_heatmap || []).map(r => r.day)
  const heatVals = (data.voc_heatmap || []).map(r => [r.positive, r.neutral, r.negative, r.angry])
  const heatCols = [
    { key: 'positive', label: 'Positive', color: BRAND.success },
    { key: 'neutral',  label: 'Neutral',  color: BRAND.primary },
    { key: 'negative', label: 'Negative', color: BRAND.warning },
    { key: 'angry',    label: 'Angry',    color: BRAND.error   },
  ]

  // Top recurring issue — surface the #1 hotspot in the hero so it's visible at a glance
  const topIssue = (data.top_recurring_issues || [])[0]

  const heroKpis = [
    {
      label: 'SLA Health',
      value: `${slaHealth}%`,
      foot: `${data.sla_breached_active || 0} active breaches · target ≥ 95%`,
      tone: slaHealth >= 95 ? 'up' : slaHealth >= 80 ? 'warn' : 'down',
    },
    {
      label: 'P1 Open',
      value: data.p1_open || 0,
      foot: '15-min SLA',
      tone: (data.p1_open || 0) > 0 ? 'down' : 'up',
    },
    {
      label: 'P2 Open',
      value: data.p2_open || 0,
      foot: '1-hr SLA',
      tone: (data.p2_open || 0) > 2 ? 'warn' : 'up',
    },
    {
      label: 'HIL Pending',
      value: data.escalated_pending || 0,
      foot: 'awaiting human',
      tone: (data.escalated_pending || 0) > 3 ? 'pink' : null,
    },
    {
      label: 'Angry Voices',
      value: data.angry_customers || 0,
      foot: 'sentiment risk',
      tone: (data.angry_customers || 0) > 2 ? 'down' : null,
    },
    {
      label: 'FCR Rate',
      value: `${fcrRate}%`,
      foot: `${dailyVolumeTotal} tickets · 7d`,
      sparkline: dailyVolume,
    },
  ]

  const metaLine = (
    <>
      {data.total_tickets} tickets · {data.resolved_tickets} resolved ({resolution}%) · {totalP12} P1+P2 open
      {topIssue ? ` · top issue: ${topIssue.category} (${topIssue.count})` : ''}
    </>
  )

  return (
    <div>
      <DashboardHero
        live="Executive View · Live"
        title="VP Customer Success — Command View"
        subtitle="Real-time pulse: SLA health, P1/P2 backlog, HIL queue, sentiment risk and recurring hotspots — all in one screen."
        meta={metaLine}
        kpis={heroKpis}
      />

      {/* ── Row: Donut + Gauge + Stacked ──────────────────────────── */}
      <div className="dash-grid-3">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.chart /></span>
              Open Workload Mix
            </div>
            <span className="badge badge-primary">Live</span>
          </div>
          <div className="chart-card-body">
            <DonutChart data={priorityDist} size={170} centerLabel="OPEN" centerValue={priorityDist.reduce((s,d)=>s+d.value,0)} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.shield /></span>
              SLA Health Index
            </div>
            <span className={`badge ${slaHealth >= 90 ? 'badge-success' : slaHealth >= 75 ? 'badge-warning' : 'badge-error'}`}>
              {slaHealth >= 90 ? 'Excellent' : slaHealth >= 75 ? 'At Risk' : 'Critical'}
            </span>
          </div>
          <div className="chart-card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Gauge value={slaHealth} max={100} size={170} label="Compliance" color={slaHealth >= 90 ? BRAND.success : slaHealth >= 75 ? BRAND.warning : BRAND.error} />
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--neutral-4)', textAlign: 'center' }}>
              {data.sla_breached_active} active breaches · target ≥ 95%
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.sparkle /></span>
              Customer Sentiment
            </div>
            <span className="badge badge-pink">Live</span>
          </div>
          <div className="chart-card-body">
            {sentimentDist.length > 0 ? (
              <DonutChart data={sentimentDist} size={170} centerLabel="VOICES" />
            ) : (
              <div style={{ fontSize: 12, color: 'var(--neutral-4)' }}>No sentiment data yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row: Trends + Recurring ───────────────────────────────── */}
      <div className="dash-grid-2">
        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.trend /></span>
              7-Day Ticket Velocity
            </div>
            <span className="badge badge-cyan">Resolved vs Inbound</span>
          </div>
          <div className="chart-card-body">
            {dailyVolumeTotal > 0 ? (
              <LineChart
                data={(data.voc_heatmap || []).map((r, i) => ({ label: r.day, value: dailyVolume[i] }))}
                color={BRAND.primary}
                label="vol"
                height={200}
              />
            ) : (
              <div style={{ fontSize: 13, color: 'var(--neutral-4)', padding: '40px 0', textAlign: 'center' }}>
                No volume data yet.
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <StackedBar data={[
                { label: 'Resolved',  value: data.resolved_tickets || 0, color: BRAND.success },
                { label: 'In flight', value: (data.total_tickets || 0) - (data.resolved_tickets || 0), color: BRAND.warning },
              ]} />
            </div>
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-head">
            <div className="chart-card-title">
              <span className="chart-card-title-icon"><Icon.fire /></span>
              Top Recurring Issues (30d)
            </div>
            <span className="badge badge-warning">Pattern</span>
          </div>
          <div className="chart-card-body">
            {recurringBars.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--neutral-4)', padding: '20px 0' }}>
                No recurring issues flagged in the last 30 days.
              </div>
            ) : (
              <BarChart data={recurringBars} horizontal height={220} />
            )}
          </div>
        </div>
      </div>

      {/* ── Row: VoC Heatmap full width ───────────────────────────── */}
      <div className="chart-card">
        <div className="chart-card-head">
          <div className="chart-card-title">
            <span className="chart-card-title-icon"><Icon.beaker /></span>
            Voice of Customer — Weekly Sentiment Heatmap
          </div>
          <span className="badge badge-pink">Weekly</span>
        </div>
        <div className="chart-card-body">
          {heatRows.length > 0 ? (
            <Heatmap rows={heatRows} columns={heatCols} values={heatVals} />
          ) : (
            <div style={{ fontSize: 13, color: 'var(--neutral-4)' }}>No sentiment data available.</div>
          )}
        </div>
      </div>
    </div>
  )
}
