// Shared visual tokens for charts and components. Colours resolve to CSS
// custom properties in index.css so light/dark themes swap in one place.

// Cluster identity colours, fixed order (validated for colour-blind separation
// on adjacent slots). Deliberately excludes red so a cluster never reads as
// "High Risk".
export const CLUSTER_COUNT = 7
export const clusterColor = id => `var(--cluster-${(id % CLUSTER_COUNT) + 1})`

export const RISK = {
  3: { label: 'High Risk',   color: 'var(--high)', badge: 'badge-high' },
  2: { label: 'Medium Risk', color: 'var(--med)',  badge: 'badge-med'  },
  1: { label: 'Low Risk',    color: 'var(--low)',  badge: 'badge-low'  },
}
export const riskOf = level => RISK[level] || RISK[2]

export const axisTick = { fill: 'var(--text2)', fontSize: 12, fontWeight: 600 }
export const axisLabel = { fill: 'var(--text3)', fontSize: 11, fontWeight: 700 }

export const tooltipStyle = {
  background: 'var(--bg2)',
  border: '2px solid var(--border-strong)',
  borderRadius: 0,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text)',
  boxShadow: 'var(--shadow-sm)',
}
export const tooltipLabelStyle = { color: 'var(--text)', fontWeight: 800, marginBottom: 4 }
export const tooltipItemStyle = { color: 'var(--text2)', padding: 0 }

export const errorMessage = (e, fallback) => e?.response?.data?.detail || fallback
