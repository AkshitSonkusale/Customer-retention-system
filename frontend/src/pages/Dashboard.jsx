import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, BarChart, Bar, LabelList, ReferenceDot,
} from 'recharts'
import { FileDown, RotateCcw } from 'lucide-react'
import { clusterColor, riskOf, axisTick, axisLabel, tooltipStyle, tooltipLabelStyle, tooltipItemStyle, errorMessage } from '../theme'
import { Loading, Alert } from '../components/States'
import ThemeToggle from '../components/ThemeToggle'

const MODELS = [
  { key: 'randomForest', label: 'Random Forest', color: 'var(--cluster-1)' },
  { key: 'xgboost',      label: 'XGBoost',       color: 'var(--cluster-2)' },
]
const METRICS = [['accuracy', 'Accuracy'], ['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1']]

const silhouetteQuality = s => (s >= 0.5 ? 'Strong separation' : s >= 0.25 ? 'Moderate separation' : 'Weak separation')
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)

function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{ ...tooltipStyle, padding: '8px 12px' }}>
      <div style={{ ...tooltipLabelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="swatch" style={{ background: clusterColor(p.cluster) }} /> Cluster {p.cluster}
      </div>
      <div style={tooltipItemStyle}>Income: <strong style={{ color: 'var(--text)' }}>${p.x}k</strong></div>
      <div style={tooltipItemStyle}>Spending score: <strong style={{ color: 'var(--text)' }}>{p.y}</strong></div>
    </div>
  )
}

export default function Dashboard({ k, setK, kOptions, isMobile, dataset, isDefault, onResetDataset }) {
  const [summary,     setSummary]     = useState(null)
  const [scatter,     setScatter]     = useState([])
  const [elbow,       setElbow]       = useState([])
  const [comparison,  setComparison]  = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [reportError, setReportError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [reloadKey,   setReloadKey]   = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([api.summary(k), api.cluster(k), api.elbow(10), api.modelComparison()])
      .then(([sum, clust, elb, cmp]) => {
        if (!active) return
        setSummary(sum)
        setScatter(clust.scatterData)
        setElbow(elb.data)
        setComparison(cmp)
      })
      .catch(e => { if (active) setError(errorMessage(e, 'Could not load the analysis. The server may be waking up — try again in a few seconds.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [k, reloadKey])

  const byCluster = useMemo(() => {
    const groups = new Map()
    scatter.forEach(p => {
      if (!groups.has(p.cluster)) groups.set(p.cluster, [])
      groups.get(p.cluster).push(p)
    })
    return [...groups.entries()].sort((a, b) => a[0] - b[0])
  }, [scatter])

  const downloadReport = async () => {
    setDownloading(true)
    setReportError('')
    try {
      const blob = await api.report(k)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `churn_report_k${k}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setReportError('Could not generate the PDF report. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (!summary) {
    if (loading) return <Loading label="Running K-Means..." />
    return (
      <div className="fade-in">
        <div className="page-header"><h2>Churn Overview</h2></div>
        <Alert onRetry={() => setReloadKey(n => n + 1)}>{error || 'No data available.'}</Alert>
      </div>
    )
  }

  const { riskBreakdown, clusters, silhouetteScore, totalCustomers } = summary
  const currentElbow = elbow.find(e => e.k === k)

  const kpis = [
    { key: 'high',   level: 3, value: riskBreakdown.high,   sub: <><strong>{pct(riskBreakdown.high, totalCustomers)}%</strong> of customers · likely to churn</> },
    { key: 'medium', level: 2, value: riskBreakdown.medium, sub: <><strong>{pct(riskBreakdown.medium, totalCustomers)}%</strong> of customers · needs attention</> },
    { key: 'low',    level: 1, value: riskBreakdown.low,    sub: <><strong>{pct(riskBreakdown.low, totalCustomers)}%</strong> of customers · loyal</> },
  ]

  const modelChartData = comparison?.available
    ? METRICS.map(([key, label]) => ({
        metric: label,
        randomForest: comparison.models.randomForest[key],
        xgboost: comparison.models.xgboost[key],
      }))
    : []
  const modelMin = modelChartData.length
    ? Math.max(0, Math.floor(Math.min(...modelChartData.flatMap(d => [d.randomForest, d.xgboost])) / 10) * 10 - 10)
    : 0

  return (
    <div className={`fade-in dash-body ${loading ? 'is-refreshing' : ''}`}>
      <div className="page-header page-header-row">
        <div>
          <h2>Churn Overview</h2>
          <p>K-Means with k={k} · {totalCustomers.toLocaleString()} customers analysed</p>
        </div>
        <button className="btn btn-auto" onClick={downloadReport} disabled={downloading}>
          {downloading ? <><div className="spinner spinner-sm" /> Preparing PDF</> : <><FileDown size={16} /> Download report</>}
        </button>
      </div>

      {(error || reportError) && (
        <Alert style={{ marginBottom: 16 }} onRetry={error ? () => setReloadKey(n => n + 1) : undefined}>
          {error || reportError}
        </Alert>
      )}

      {/* Mobile-only cluster/dataset controls */}
      {isMobile && (
        <div className="card section">
          <div className="eyebrow" style={{ marginBottom: 8 }}>Clusters (k)</div>
          <div className="k-group" role="group" aria-label="Number of clusters">
            {kOptions.map(n => (
              <button key={n} className={`k-btn ${k === n ? 'active' : ''}`} aria-pressed={k === n}
                style={{ padding: '10px 16px', fontSize: 14 }} onClick={() => setK(n)}>{n}</button>
            ))}
          </div>
          <div className="eyebrow" style={{ marginTop: 16 }}>Active dataset</div>
          <div className="dataset-name" style={{ marginTop: 2 }}>
            {dataset ? `${dataset.filename} · ${Number(dataset.rows).toLocaleString()} rows` : '—'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {!isDefault && (
              <button className="btn btn-sm btn-secondary btn-auto" onClick={onResetDataset}>
                <RotateCcw size={13} /> Use default
              </button>
            )}
            <ThemeToggle className="btn btn-sm btn-secondary btn-auto" />
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid-4 section">
        {kpis.map(({ key, level, value, sub }) => {
          const risk = riskOf(level)
          return (
            <div key={key} className="card kpi" style={{ borderLeftColor: risk.color }}>
              <div className="eyebrow">{risk.label}</div>
              <div className="stat-value">{value.toLocaleString()}</div>
              <div className="stat-label">{sub}</div>
            </div>
          )
        })}
        <div className="card kpi" style={{ borderLeftColor: 'var(--accent)' }}>
          <div className="eyebrow">Silhouette score</div>
          <div className="stat-value">{Number(silhouetteScore).toFixed(2)}</div>
          <div className="stat-label">{silhouetteQuality(silhouetteScore)} · range −1 to 1</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2 section">
        <div className="card">
          <div className="card-title">Customer segments</div>
          <p className="card-sub">Annual income vs spending score, coloured by cluster</p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis type="number" dataKey="x" name="Income" tick={axisTick} stroke="var(--border-strong)"
                label={{ value: 'Annual income (k$)', position: 'insideBottom', offset: -10, ...axisLabel }} />
              <YAxis type="number" dataKey="y" name="Spending" tick={axisTick} stroke="var(--border-strong)" width={56}
                domain={[0, 100]}
                label={{ value: 'Spending score', angle: -90, position: 'insideLeft', offset: 4, style: { textAnchor: 'middle' }, ...axisLabel }} />
              <Tooltip content={<ScatterTip />} cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }} />
              {byCluster.map(([id, points]) => (
                <Scatter key={id} name={`Cluster ${id}`} data={points} fill={clusterColor(id)}
                  stroke="var(--bg2)" strokeWidth={1.5} isAnimationActive={false} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
          <div className="chart-legend">
            {byCluster.map(([id]) => (
              <span key={id} className="legend-item">
                <span className="swatch" style={{ background: clusterColor(id), borderRadius: '50%' }} /> Cluster {id}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Elbow method</div>
          <p className="card-sub">Within-cluster sum of squares (WCSS) by number of clusters — look for the bend</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={elbow} margin={{ top: 8, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis dataKey="k" tick={axisTick} stroke="var(--border-strong)"
                label={{ value: 'Number of clusters (k)', position: 'insideBottom', offset: -10, ...axisLabel }} />
              <YAxis tick={axisTick} stroke="var(--border-strong)" width={56}
                tickFormatter={v => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                labelFormatter={v => `k = ${v}`} formatter={v => [Math.round(v).toLocaleString(), 'WCSS']} />
              <Line type="monotone" dataKey="wcss" stroke="var(--accent)" strokeWidth={2.5}
                dot={{ fill: 'var(--bg2)', stroke: 'var(--accent)', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--bg2)', strokeWidth: 2 }} name="WCSS" />
              {currentElbow && (
                <ReferenceDot x={k} y={currentElbow.wcss} r={8} fill="var(--accent)" stroke="var(--text)" strokeWidth={2}
                  label={{ value: `k=${k}`, position: 'top', offset: 12, fill: 'var(--text)', fontSize: 12, fontWeight: 800 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
          <div className="chart-note">Highlighted point is the k currently selected.</div>
        </div>
      </div>

      {/* Cluster Summary */}
      <div className="card section">
        <div className="card-title">Cluster summary</div>
        <p className="card-sub">Averages per cluster, ordered from highest to lowest churn risk</p>
        <div className="cluster-cards">
          {clusters.map(c => {
            const color = clusterColor(c.id)
            const risk  = riskOf(c.riskLevel)
            return (
              <div className="cluster-card" key={c.id} style={{ borderLeftColor: color }}>
                <div className="cluster-card-header">
                  <span className="cluster-num">
                    <span className="swatch" style={{ background: color, borderRadius: '50%' }} />
                    Cluster {c.id}
                  </span>
                  <span className={`badge ${risk.badge}`}>{c.churnRisk}</span>
                </div>
                <div className="cluster-stats">
                  {[
                    ['Customers', `${c.count}`, `${pct(c.count, totalCustomers)}%`],
                    ['Spend', c.avgSpending],
                    ['Income', `$${c.avgIncome}k`],
                    ['Age', c.avgAge],
                  ].map(([lbl, val, extra]) => (
                    <div className="cluster-stat" key={lbl}>
                      <div className="cluster-stat-label">{lbl}</div>
                      <div className="cluster-stat-val">
                        {val}
                        {extra && <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginLeft: 6 }}>{extra}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Model comparison */}
      {comparison && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Model comparison</div>
            {comparison.available && (
              <span className="badge badge-neutral">In use: {MODELS.find(m => m.key === comparison.best)?.label}</span>
            )}
          </div>
          {comparison.available ? (
            <>
              <p className="card-sub" style={{ marginTop: 0 }}>
                Both models train on the same 80% split and are scored on the same 20% test set.
                The one with the higher weighted F1 makes predictions.
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={modelChartData} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="metric" tick={axisTick} stroke="var(--border-strong)" />
                  <YAxis domain={[modelMin, 100]} tick={axisTick} stroke="var(--border-strong)" width={44} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                    cursor={{ fill: 'var(--accent-wash)' }} formatter={v => `${Number(v).toFixed(2)}%`} />
                  {MODELS.map(m => (
                    <Bar key={m.key} dataKey={m.key} name={m.label} fill={m.color} isAnimationActive={false}>
                      <LabelList dataKey={m.key} position="top" formatter={v => Number(v).toFixed(1)}
                        style={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                {MODELS.map(m => (
                  <span key={m.key} className="legend-item"><span className="swatch" style={{ background: m.color }} /> {m.label}</span>
                ))}
                {modelMin > 0 && <span style={{ color: 'var(--text3)', marginLeft: 'auto' }}>Y-axis starts at {modelMin}%</span>}
              </div>
            </>
          ) : (
            <p className="muted">
              Random Forest and XGBoost are trained only on datasets that include the churn columns.
              Missing here: <strong style={{ color: 'var(--text)' }}>{comparison.missing.join(', ')}</strong>.
              Upload a dataset with these columns to compare models.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
