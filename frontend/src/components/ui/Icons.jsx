/* ───────────────────────────────────────────────────────────────
   Inline SVG icon set. Stroke-based, 24x24 viewBox, currentColor.
─────────────────────────────────────────────────────────────── */

const base = {
  width: 20, height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const Icon = {
  queue: (p) => (
    <svg {...base} {...p}>
      <path d="M3 7h18M3 12h18M3 17h12" />
      <circle cx="20" cy="17" r="2" />
    </svg>
  ),
  alert: (p) => (
    <svg {...base} {...p}>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  ),
  build: (p) => (
    <svg {...base} {...p}>
      <path d="M3 21V8l9-5 9 5v13" />
      <path d="M9 21v-7h6v7" />
      <path d="M3 13h18" />
    </svg>
  ),
  book: (p) => (
    <svg {...base} {...p}>
      <path d="M4 4h11a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
      <path d="M4 4v15" />
      <path d="M8 8h6M8 12h6" />
    </svg>
  ),
  zap: (p) => (
    <svg {...base} {...p}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  ),
  users: (p) => (
    <svg {...base} {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M22 19c0-2.6-2-4.5-5-4.5" />
    </svg>
  ),
  clock: (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  monitor: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M7 12l3-3 2 2 4-5" />
    </svg>
  ),
  chart: (p) => (
    <svg {...base} {...p}>
      <path d="M3 21h18" />
      <rect x="5"  y="11" width="3" height="8" rx="1" />
      <rect x="10" y="7"  width="3" height="12" rx="1" />
      <rect x="15" y="14" width="3" height="5" rx="1" />
    </svg>
  ),
  trophy: (p) => (
    <svg {...base} {...p}>
      <path d="M8 3h8v6a4 4 0 0 1-8 0V3z" />
      <path d="M5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3" />
      <path d="M9 14h6l-1 5h-4l-1-5z" />
      <path d="M7 21h10" />
    </svg>
  ),
  bell: (p) => (
    <svg {...base} {...p}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  swap: (p) => (
    <svg {...base} {...p}>
      <path d="M7 4 3 8l4 4M3 8h14" />
      <path d="m17 12 4 4-4 4M21 16H7" />
    </svg>
  ),
  search: (p) => (
    <svg {...base} {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  refresh: (p) => (
    <svg {...base} {...p}>
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  check: (p) => (
    <svg {...base} {...p}>
      <path d="M5 13l4 4L19 7" />
    </svg>
  ),
  x: (p) => (
    <svg {...base} {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  fire: (p) => (
    <svg {...base} {...p}>
      <path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-2-3-2-5 3 1 5 4 5 8a6 6 0 0 1-12 0c0-5 4-7 6-12z" />
    </svg>
  ),
  sparkle: (p) => (
    <svg {...base} {...p}>
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      <path d="M5.5 5.5l3 3M15.5 15.5l3 3M18.5 5.5l-3 3M8.5 15.5l-3 3" strokeWidth="1.2" />
    </svg>
  ),
  trend: (p) => (
    <svg {...base} {...p}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  shield: (p) => (
    <svg {...base} {...p}>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  inbox: (p) => (
    <svg {...base} {...p}>
      <path d="M3 13l3-8h12l3 8" />
      <path d="M3 13v6h18v-6" />
      <path d="M3 13h5l1 3h6l1-3h5" />
    </svg>
  ),
  beaker: (p) => (
    <svg {...base} {...p}>
      <path d="M9 3h6v5l5 10a2 2 0 0 1-2 3H6a2 2 0 0 1-2-3l5-10V3z" />
      <path d="M7 14h10" />
    </svg>
  ),
  scale: (p) => (
    <svg {...base} {...p}>
      <path d="M12 3v18M5 21h14" />
      <path d="m6 8 6-2 6 2" />
      <path d="M3 14a3 3 0 0 0 6 0L6 8 3 14zM15 14a3 3 0 0 0 6 0l-3-6-3 6z" />
    </svg>
  ),
}

export default Icon
