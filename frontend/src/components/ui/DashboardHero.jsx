import { Sparkline } from '../charts/Charts'

/**
 * DashboardHero — compact, insight-dense banner.
 *
 * Goals: every metric appears once; up to 6 KPI tiles in one row;
 * subtitle is one short line; live indicator is inline (no chip duplication
 * of KPI numbers).
 *
 * kpis[] item shape:
 *   { label, value, foot?, tone?: 'up'|'down'|'warn'|'pink'|'cyan', sparkline?: number[] }
 */
export default function DashboardHero({ title, subtitle, live, kpis = [], meta }) {
  return (
    <div className="insight-hero compact">
      <div className="insight-hero-grid compact">
        <div className="insight-hero-lead">
          {live && (
            <div className="insight-hero-chips" style={{ marginBottom: 8 }}>
              <span className="insight-chip">
                <span className="insight-chip-dot" /> {live}
              </span>
            </div>
          )}
          <h1 className="insight-hero-title compact">{title}</h1>
          {subtitle && <p className="insight-hero-sub compact">{subtitle}</p>}
          {meta && <div className="insight-hero-meta">{meta}</div>}
        </div>

        {kpis.length > 0 && (
          <div className="hero-kpis compact">
            {kpis.map((k, i) => (
              <div
                key={k.label + i}
                className={`hero-kpi compact ${k.tone ? `tone-${k.tone}` : ''}`}
              >
                <div className="hero-kpi-label">{k.label}</div>
                <div className="hero-kpi-value">{k.value}</div>
                {(k.foot || k.sparkline) && (
                  <div className="hero-kpi-foot">
                    {k.sparkline && k.sparkline.length > 0 && (
                      <Sparkline data={k.sparkline} width={56} height={16} color="#fff" fill={false} />
                    )}
                    {k.foot && <span>{k.foot}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
