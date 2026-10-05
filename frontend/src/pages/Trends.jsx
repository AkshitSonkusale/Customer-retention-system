import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { api } from '../api'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { axisTick, tooltipStyle, tooltipLabelStyle, tooltipItemStyle, errorMessage } from '../theme'
import { Loading, Alert, EmptyState } from '../components/States'

const SERIES = [
  { key: 'highPct',   label: 'High risk',   color: 'var(--high)', ink: 'var(--high-ink)' },
  { key: 'mediumPct', label: 'Medium risk', color: 'var(--med)',  ink: 'var(--med-ink)'  },
  { key: 'lowPct',    label: 'Low risk',    color: 'var(--low)',  ink: 'var(--low-ink)'  },
]

const formatDate = iso => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Trends({ onDatasetReady }) {
  const [points,      setPoints]      = useState([])
  const [activeId,    setActiveId]    = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [switchError, setSwitchError] = useState('')
  const [busyId,      setBusyId]      = useState(null)
  const [reloadKey,   setReloadKey]   = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    Promise.all([api.trends(), api.uploads()])
      .then(([t, u]) => {
        if (!active) return
        setPoints(t.points)
        setActiveId(u.activeId)
      })
      .catch(e => { if (active) setError(errorMessage(e, 'Could not load upload history.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadKey])

  const chartData = points.map(p => ({ ...p, label: formatDate(p.uploadedAt) }))

  const activate = async id => {
    setBusyId(id)
    setSwitchError('')
    try {
      await api.activateUpload(id)
      onDatasetReady(null)
    } catch {
      setSwitchError('Could not switch dataset. Please try again.')
      setBusyId(null)
    }
  }

  if (loading) return <Loading label="Loading history..." />

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Trends</h2>
        <p>How the risk mix changes across every dataset you have uploaded</p>
      </div>

      {error && <Alert style={{ marginBottom: 16 }} onRetry={() => setReloadKey(n => n + 1)}>{error}</Alert>}
      {switchError && <Alert style={{ marginBottom: 16 }}>{switchError}</Alert>}

      {!error && points.length === 0 ? (
        <div className="card">
          <EmptyState icon={TrendingUp} title="No uploads yet">
            Upload a dataset from the Dataset page. Each upload becomes a point on this chart so you can compare them over time.
          </EmptyState>
        </div>
      ) : points.length > 0 && (
        <>
          <div className="card section">
            <div className="card-title">Risk share by upload</div>
            <p className="card-sub">Percentage of customers in each risk tier, per uploaded dataset</p>
            {points.length === 1 ? (
              <div className="grid-3">
                {SERIES.map(s => (
                  <div key={s.key} className="card card-flat kpi" style={{ borderLeftColor: s.color }}>
                    <div className="eyebrow">{s.label}</div>
                    <div className="stat-value">{points[0][s.key]}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} stroke="var(--border-strong)" />
                  <YAxis domain={[0, 100]} tick={axisTick} stroke="var(--border-strong)" width={44} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle}
                    formatter={v => `${Number(v).toFixed(1)}%`} />
                  {SERIES.map(s => (
                    <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5}
                      dot={{ r: 4, fill: s.color, stroke: 'var(--bg2)', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
            <div className="chart-legend">
              {SERIES.map(s => (
                <span key={s.key} className="legend-item"><span className="swatch" style={{ background: s.color }} /> {s.label}</span>
              ))}
              {points.length === 1 && <span style={{ color: 'var(--text3)', marginLeft: 'auto' }}>Upload another dataset to see a trend line.</span>}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Upload history</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Uploaded</th>
                    <th className="num">Rows</th>
                    {SERIES.map(s => <th key={s.key} className="num">{s.label.split(' ')[0]} %</th>)}
                    <th className="num">Avg spend</th>
                    <th><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {points.map(p => {
                    const isActive = p.id === activeId
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700 }}>
                          {p.filename}
                          {isActive && <span className="badge badge-neutral" style={{ marginLeft: 8 }}>Active</span>}
                        </td>
                        <td>{formatDate(p.uploadedAt)}</td>
                        <td className="num">{p.rows.toLocaleString()}</td>
                        {SERIES.map(s => <td key={s.key} className="num" style={{ color: s.ink, fontWeight: 700 }}>{p[s.key]}%</td>)}
                        <td className="num">{p.avgSpending}</td>
                        <td style={{ textAlign: 'right' }}>
                          {!isActive && (
                            <button className="k-btn" disabled={busyId !== null} onClick={() => activate(p.id)}>
                              {busyId === p.id ? 'Switching...' : 'Use dataset'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
