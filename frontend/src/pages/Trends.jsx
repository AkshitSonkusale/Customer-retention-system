import { useEffect, useState } from 'react'
import { api } from '../api'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

const SERIES = [
  { key: 'highPct',   label: 'High Risk %',   color: '#ef4444' },
  { key: 'mediumPct', label: 'Medium Risk %', color: '#f59e0b' },
  { key: 'lowPct',    label: 'Low Risk %',    color: '#10b981' },
]

const cellStyle = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }
const headStyle = { ...cellStyle, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontSize: 10 }

const formatDate = iso => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Trends({ onDatasetReady }) {
  const [points,   setPoints]   = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [busyId,   setBusyId]   = useState(null)

  useEffect(() => {
    let active = true
    Promise.all([api.trends(), api.uploads()])
      .then(([t, u]) => {
        if (!active) return
        setPoints(t.points)
        setActiveId(u.activeId)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const chartData = points.map(p => ({ ...p, label: formatDate(p.uploadedAt) }))

  const activate = async id => {
    setBusyId(id)
    try {
      await api.activateUpload(id)
      onDatasetReady(null)
    } catch {
      window.alert('Could not switch dataset. Please try again.')
      setBusyId(null)
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /><span>Loading history...</span></div>

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Trends</h2>
        <p>Risk mix across every dataset you have uploaded</p>
      </div>

      {points.length === 0 ? (
        <div className="card">
          <div className="stat-label">No uploads yet. Upload a dataset from the Dataset page and it will appear here.</div>
        </div>
      ) : (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-title">Risk share by upload</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 10, left: -10 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="0" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text2)', fontSize: 11, fontWeight: 700 }} />
                <Tooltip formatter={v => `${Number(v).toFixed(1)}%`} />
                <Legend />
                {SERIES.map(s => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color}
                    strokeWidth={3} dot={{ r: 5, fill: s.color, stroke: 'rgba(0,0,0,0.8)', strokeWidth: 2 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-title">Upload history</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['File', 'Uploaded', 'Rows', 'High %', 'Medium %', 'Low %', 'Avg Spend', ''].map(h => (
                      <th key={h} style={{ ...headStyle, textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {points.map(p => {
                    const isActive = p.id === activeId
                    return (
                      <tr key={p.id}>
                        <td style={cellStyle}>{p.filename}{isActive && <span className="badge badge-low" style={{ marginLeft: 8 }}>Active</span>}</td>
                        <td style={cellStyle}>{formatDate(p.uploadedAt)}</td>
                        <td style={cellStyle}>{p.rows.toLocaleString()}</td>
                        <td style={{ ...cellStyle, color: 'var(--high)' }}>{p.highPct}%</td>
                        <td style={{ ...cellStyle, color: 'var(--med)' }}>{p.mediumPct}%</td>
                        <td style={{ ...cellStyle, color: 'var(--low)' }}>{p.lowPct}%</td>
                        <td style={cellStyle}>{p.avgSpending}</td>
                        <td style={cellStyle}>
                          {!isActive && (
                            <button className="k-btn" disabled={busyId !== null} onClick={() => activate(p.id)}>
                              {busyId === p.id ? 'Switching...' : 'Use this dataset'}
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
