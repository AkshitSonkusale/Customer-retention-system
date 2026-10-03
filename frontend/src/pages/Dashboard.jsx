import { useEffect, useState } from 'react'
import { api } from '../api'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LineChart, Line, BarChart, Bar, Legend } from 'recharts'

const CLUSTER_COLORS = ['#7c6ff7', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']
const MODEL_LABELS = { randomForest: 'Random Forest', xgboost: 'XGBoost' }
const MODEL_COLORS = { randomForest: '#7c6ff7', xgboost: '#10b981' }
const METRICS = [['accuracy', 'Accuracy'], ['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1']]

const CustomDot = ({ cx, cy, payload }) => {
  const color = CLUSTER_COLORS[payload.cluster % CLUSTER_COLORS.length]
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="rgba(0,0,0,0.8)" strokeWidth={1.5} />
}

const KPI_CONFIG = [
  { key: 'high',   label: 'High Risk',        sub: 'Likely to churn',    color: 'var(--high)',   border: '#ef4444' },
  { key: 'medium', label: 'Medium Risk',       sub: 'Needs attention',    color: 'var(--med)',    border: '#f59e0b' },
  { key: 'low',    label: 'Low Risk',          sub: 'Loyal customers',    color: 'var(--low)',    border: '#10b981' },
  { key: 'sil',    label: 'Silhouette Score',  sub: 'Cluster quality',    color: 'var(--accent2)',border: '#7c6ff7' },
]

export default function Dashboard({ k, setK, isMobile, dataset, isDefault, onResetDataset }) {
  const [summary,     setSummary]     = useState(null)
  const [scatter,     setScatter]     = useState([])
  const [elbow,       setElbow]       = useState([])
  const [comparison,  setComparison]  = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([api.summary(k), api.cluster(k), api.elbow(10), api.modelComparison()])
      .then(([sum, clust, elb, cmp]) => {
        if (!active) return
        setSummary(sum)
        setScatter(clust.scatterData)
        setElbow(elb.data)
        setComparison(cmp)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [k])

  const downloadReport = async () => {
    setDownloading(true)
    try {
      const blob = await api.report(k)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `churn_report_k${k}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.alert('Could not generate the report. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (!summary) return loading ? <div className="loading"><div className="spinner" /><span>Running K-Means...</span></div> : null

  const { riskBreakdown, clusters, silhouetteScore } = summary

  const kpiValues = {
    high:   riskBreakdown.high,
    medium: riskBreakdown.medium,
    low:    riskBreakdown.low,
    sil:    silhouetteScore,
  }

  const tooltipStyle = {
    background: 'var(--bg2)',
    border: '2px solid rgba(255,255,255,0.55)',
    borderRadius: 0,
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text)',
    boxShadow: '3px 3px 0px rgba(0,0,0,0.8)',
  }

  const modelChartData = comparison?.available
    ? METRICS.map(([key, label]) => ({
        metric: label,
        randomForest: comparison.models.randomForest[key],
        xgboost: comparison.models.xgboost[key],
      }))
    : []

  return (
    <div className={`fade-in dash-body ${loading ? 'is-refreshing' : ''}`}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Churn Overview</h2>
          <p>K-Means · k={k} · {summary.totalCustomers.toLocaleString()} customers analysed</p>
        </div>
        <button className="btn" onClick={downloadReport} disabled={downloading}>
          {downloading ? 'Preparing PDF...' : 'Download PDF report'}
        </button>
      </div>

      {/* Mobile-only cluster/dataset controls */}
      {isMobile && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Clusters (k)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {[3,4,5,6,7].map(n => (
              <button key={n} className={`k-btn ${k === n ? 'active' : ''}`}
                style={{ padding: '10px 18px', fontSize: 14 }}
                onClick={() => setK(n)}>{n}</button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12 }}>
            Active Dataset
          </div>
          <div style={{ fontSize: 13, color: isDefault ? 'var(--text2)' : 'var(--accent2)', fontWeight: 700, marginTop: 2 }}>
            {dataset ? dataset.filename : '—'}
            {dataset ? ` · ${Number(dataset.rows).toLocaleString()} rows` : ''}
          </div>
          {!isDefault && (
            <button className="btn" style={{ marginTop: 12 }} onClick={onResetDataset}>
              ↩ Reset to Default Dataset
            </button>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {KPI_CONFIG.map(({ key, label, sub, color, border }) => (
          <div key={key} className="card" style={{ borderLeft: `6px solid ${border}` }}>
            <div className="card-title">{label}</div>
            <div className="stat-value" style={{ color }}>{kpiValues[key]}</div>
            <div className="stat-label">{sub}</div>
          </div>
        ))}
      </div>

      {/* Model comparison */}
      {comparison && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Model Comparison</div>
            {comparison.available && (
              <span className="badge badge-low">Selected: {MODEL_LABELS[comparison.best]}</span>
            )}
          </div>
          {comparison.available ? (
            <>
              <div className="stat-label" style={{ marginBottom: 12 }}>
                Both models are trained on the same 80% split and scored on the same 20% test set.
                The model with the higher weighted F1 is used for predictions.
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={modelChartData} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="0" />
                  <XAxis dataKey="metric" tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => `${Number(v).toFixed(2)}%`} />
                  <Legend />
                  <Bar dataKey="randomForest" name={MODEL_LABELS.randomForest} fill={MODEL_COLORS.randomForest} />
                  <Bar dataKey="xgboost" name={MODEL_LABELS.xgboost} fill={MODEL_COLORS.xgboost} />
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div className="stat-label">
              Random Forest and XGBoost are trained only on datasets that include the churn columns.
              Missing here: {comparison.missing.join(', ')}. Upload a dataset with these columns to compare models.
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Income vs Spending Score</div>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="0" />
              <XAxis dataKey="x" name="Income"   tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
              <YAxis dataKey="y" name="Spending" tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
              <Tooltip cursor={{ stroke: 'var(--accent)', strokeWidth: 1 }} contentStyle={tooltipStyle}
                formatter={(val, name) => [val, name === 'x' ? 'Income (k$)' : 'Spending Score']} />
              <Scatter data={scatter} shape={<CustomDot />}>
                {scatter.map((e, i) => <Cell key={i} fill={CLUSTER_COLORS[e.cluster % CLUSTER_COLORS.length]} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">Elbow Method — WCSS</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={elbow} margin={{ top: 10, right: 16, bottom: 10, left: -10 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="0" />
              <XAxis dataKey="k" tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
              <YAxis                tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="wcss" stroke="var(--accent)" strokeWidth={3}
                dot={{ fill: 'var(--accent)', stroke: 'rgba(0,0,0,0.8)', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, fill: 'var(--accent2)' }} name="WCSS" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cluster Summary */}
      <div className="card">
        <div className="card-title">Cluster Summary</div>
        <div className="cluster-cards">
          {clusters.map(c => {
            const color  = CLUSTER_COLORS[c.id % CLUSTER_COLORS.length]
            const bClass = c.riskLevel === 3 ? 'badge-high' : c.riskLevel === 2 ? 'badge-med' : 'badge-low'
            return (
              <div className="cluster-card" key={c.id} style={{ borderLeft: `5px solid ${color}` }}>
                <div className="cluster-card-header">
                  <span className="cluster-num">Cluster {c.id}</span>
                  <span className={`badge ${bClass}`}>{c.churnRisk}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {[['Customers', c.count], ['Avg Spend', c.avgSpending], ['Avg Income', `${c.avgIncome}k`], ['Avg Age', c.avgAge]].map(([lbl, val]) => (
                    <div className="cluster-stat" key={lbl}>
                      <div className="cluster-stat-label">{lbl}</div>
                      <div className="cluster-stat-val" style={{ color }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
