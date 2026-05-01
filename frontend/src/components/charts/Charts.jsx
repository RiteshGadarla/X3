/* ───────────────────────────────────────────────────────────────
   Reusable SVG charts — no external dependencies.
   Themed to CentificAI aegis.ai brand tokens.
─────────────────────────────────────────────────────────────── */

const BRAND = {
  primary:  '#5929d0',
  pink:     '#CF008B',
  cyan:     '#22D3EE',
  success:  '#16A34A',
  warning:  '#E4902E',
  error:    '#DC2626',
  navyDark: '#0E2E89',
  blue:     '#6B8EF0',
  purple:   '#A855F7',
  teal:     '#01CAB8',
  neutral7: '#E2E8F0',
  neutral5: '#94A3B8',
  neutral4: '#64748B',
}

export const PALETTE = [
  BRAND.primary, BRAND.cyan, BRAND.pink, BRAND.warning,
  BRAND.success, BRAND.blue, BRAND.purple, BRAND.error,
]

/* ─── Donut / Pie Chart ───────────────────────────────────── */
export function DonutChart({ data = [], size = 180, thickness = 26, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1
  const r  = (size - thickness) / 2
  const cx = size / 2
  const cy = size / 2
  const C  = 2 * Math.PI * r
  let offset = 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={BRAND.neutral7} strokeWidth={thickness} />
        {data.map((d, i) => {
          const frac   = (d.value || 0) / total
          const length = frac * C
          const dash   = `${length} ${C - length}`
          const dashOffset = -offset
          offset += length
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={d.color || PALETTE[i % PALETTE.length]}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
              style={{ transition: 'stroke-dasharray .6s ease' }}
            />
          )
        })}
        {(centerLabel !== undefined || centerValue !== undefined) && (
          <>
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="22" fontWeight="800" fill={BRAND.navyDark}>
              {centerValue ?? total}
            </text>
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fontWeight="600" fill={BRAND.neutral4} letterSpacing=".06em">
              {centerLabel ?? 'TOTAL'}
            </text>
          </>
        )}
      </svg>
      <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {data.map((d, i) => {
          const pct = Math.round(((d.value || 0) / total) * 100)
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color || PALETTE[i % PALETTE.length], flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--neutral-2)', fontWeight: 500, textTransform: 'capitalize' }}>{d.label}</span>
              <span style={{ color: 'var(--neutral-4)', fontFamily: 'var(--font-code)' }}>{d.value}</span>
              <span style={{ color: 'var(--neutral-5)', fontSize: '11px', minWidth: '34px', textAlign: 'right' }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Horizontal Bar Chart ────────────────────────────────── */
export function BarChart({ data = [], height = 200, horizontal = false }) {
  if (horizontal) {
    const max = Math.max(...data.map(d => d.value || 0), 1)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {data.map((d, i) => {
          const pct = Math.round(((d.value || 0) / max) * 100)
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--neutral-2)', fontWeight: 600 }}>{d.label}</span>
                <span style={{ color: 'var(--neutral-4)', fontFamily: 'var(--font-code)' }}>{d.value}</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: BRAND.neutral7, borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`, height: '100%',
                  background: d.color || PALETTE[i % PALETTE.length],
                  borderRadius: '999px',
                  transition: 'width .6s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Vertical bars
  const W = 480
  const H = height
  const padX = 36
  const padBottom = 28
  const padTop = 18
  const innerW = W - padX * 2
  const innerH = H - padBottom - padTop
  const max = Math.max(...data.map(d => d.value || 0), 1)
  const step = innerW / Math.max(data.length, 1)
  const barW = Math.min(38, step * 0.6)

  // Y gridlines
  const ticks = 4
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max * i) / ticks))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
      {tickVals.map((v, i) => {
        const y = padTop + innerH - (v / max) * innerH
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke={BRAND.neutral7} strokeDasharray="2 4" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="9" fill={BRAND.neutral5}>{v}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const v = d.value || 0
        const h = (v / max) * innerH
        const x = padX + i * step + (step - barW) / 2
        const y = padTop + innerH - h
        const color = d.color || PALETTE[i % PALETTE.length]
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx="4" fill={color} opacity="0.9">
              <title>{`${d.label}: ${v}`}</title>
            </rect>
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill={BRAND.navyDark}>{v}</text>
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="10" fill={BRAND.neutral4}>{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/* ─── Line / Area Chart ───────────────────────────────────── */
export function LineChart({ data = [], height = 180, color = BRAND.primary, fill = true, label = '' }) {
  const W = 480
  const H = height
  const padX = 36
  const padBottom = 26
  const padTop = 12
  const innerW = W - padX * 2
  const innerH = H - padBottom - padTop
  const max = Math.max(...data.map(d => d.value || 0), 1)
  const min = 0
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW

  const points = data.map((d, i) => {
    const x = padX + i * step
    const y = padTop + innerH - ((d.value - min) / (max - min || 1)) * innerH
    return { x, y, ...d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${padX + (data.length - 1) * step} ${padTop + innerH} L ${padX} ${padTop + innerH} Z`

  const ticks = 4
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((max * i) / ticks))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {tickVals.map((v, i) => {
        const y = padTop + innerH - (v / max) * innerH
        return (
          <g key={i}>
            <line x1={padX} y1={y} x2={W - padX} y2={y} stroke={BRAND.neutral7} strokeDasharray="2 4" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="9" fill={BRAND.neutral5}>{v}</text>
          </g>
        )
      })}
      {fill && <path d={areaPath} fill={`url(#g-${label})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
          <text x={p.x} y={H - 8} textAnchor="middle" fontSize="10" fill={BRAND.neutral4}>{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

/* ─── Inline Sparkline (for KPI cards) ────────────────────── */
export function Sparkline({ data = [], width = 120, height = 36, color = BRAND.primary, fill = true }) {
  if (!data.length) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = data.length > 1 ? width / (data.length - 1) : width

  const points = data.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * (height - 4) - 2
    return [x, y]
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const areaPath = `${linePath} L ${(data.length - 1) * step} ${height} L 0 ${height} Z`
  const gid = `sp-${color.replace('#', '')}-${data.length}`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={areaPath} fill={`url(#${gid})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/* ─── Radial Gauge ────────────────────────────────────────── */
export function Gauge({ value = 0, max = 100, size = 140, label = '', color = BRAND.primary, suffix = '%' }) {
  const pct = Math.min(Math.max(value / max, 0), 1)
  const r = (size - 18) / 2
  const cx = size / 2
  const cy = size / 2
  const startAngle = -210 * (Math.PI / 180)
  const endAngle   = 30   * (Math.PI / 180)
  const totalArc = endAngle - startAngle
  const valueAngle = startAngle + totalArc * pct

  const arc = (a1, a2) => {
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    const large = (a2 - a1) > Math.PI ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.78}`}>
        <path d={arc(startAngle, endAngle)} fill="none" stroke={BRAND.neutral7} strokeWidth="12" strokeLinecap="round" />
        <path d={arc(startAngle, valueAngle)} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset .6s ease' }} />
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="22" fontWeight="800" fill={BRAND.navyDark}>
          {`${Math.round(Number(value) || 0)}${suffix}`}
        </text>
      </svg>
      {label && <div style={{ fontSize: '11px', fontWeight: 600, color: BRAND.neutral4, letterSpacing: '.05em', textTransform: 'uppercase', marginTop: '-4px' }}>{label}</div>}
    </div>
  )
}

/* ─── Heatmap (intensity grid) ────────────────────────────── */
export function Heatmap({ rows = [], columns = [], values = [], colors = {} }) {
  // values: 2D array [row][col] = number
  const flat = values.flat()
  const max = Math.max(...flat, 1)
  return (
    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '4px', fontSize: '11.5px' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--neutral-4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.05em' }}></th>
          {columns.map(c => (
            <th key={c.key} style={{ padding: '4px', color: c.color || 'var(--neutral-4)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '.05em' }}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--neutral-2)' }}>{row}</td>
            {columns.map((c, ci) => {
              const v = (values[ri] || [])[ci] || 0
              const alpha = Math.max(0.08, v / max)
              const base = colors[c.key] || c.color || BRAND.primary
              return (
                <td key={ci} style={{
                  padding: '8px',
                  textAlign: 'center',
                  background: `${base}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`,
                  color: alpha > 0.55 ? '#fff' : 'var(--neutral-1)',
                  fontWeight: 600,
                  borderRadius: '4px',
                  minWidth: '48px',
                  fontFamily: 'var(--font-code)',
                  fontSize: '12px',
                }}>
                  {v}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ─── Stat with sparkline ─────────────────────────────────── */
export function StatTile({ label, value, delta, deltaTone = 'neutral', color = BRAND.primary, spark, icon }) {
  const toneColor = {
    up:      'var(--success)',
    down:    'var(--error)',
    neutral: 'var(--neutral-4)',
  }[deltaTone]
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--neutral-7)',
      borderRadius: 'var(--radius-md)',
      padding: '16px 18px',
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            {icon && <span style={{ color, display: 'flex' }}>{icon}</span>}
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--neutral-4)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--neutral-0)', lineHeight: 1 }}>{value}</div>
          {delta && <div style={{ fontSize: '11px', fontWeight: 600, color: toneColor, marginTop: '4px' }}>{delta}</div>}
        </div>
        {spark && (
          <div style={{ flexShrink: 0, alignSelf: 'flex-end' }}>
            <Sparkline data={spark} width={86} height={36} color={color} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Stacked progress bar (composition) ──────────────────── */
export function StackedBar({ data = [], height = 14, showLabels = true }) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', height, borderRadius: '999px', overflow: 'hidden', background: BRAND.neutral7 }}>
        {data.map((d, i) => (
          <div key={i}
               style={{
                 width: `${((d.value || 0) / total) * 100}%`,
                 background: d.color || PALETTE[i % PALETTE.length],
                 transition: 'width .6s ease',
               }}
               title={`${d.label}: ${d.value}`} />
        ))}
      </div>
      {showLabels && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
          {data.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color || PALETTE[i % PALETTE.length] }} />
              <span style={{ color: 'var(--neutral-2)', fontWeight: 500 }}>{d.label}</span>
              <span style={{ color: 'var(--neutral-4)', fontFamily: 'var(--font-code)' }}>{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { BRAND }
