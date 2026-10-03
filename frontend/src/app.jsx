import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Predict   from './pages/Predict'
import Upload    from './pages/Upload'
import Login     from './pages/Login'
import Signup    from './pages/Signup'
import { api }   from './api'
import PixelLogo from './components/PixelLogo'
import { LogOut, Database, LayoutDashboard, Users, Target } from 'lucide-react'

const NAV = [
  { id: 'upload',    label: 'Dataset',   Icon: Database        },
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', Icon: Users           },
  { id: 'predict',   label: 'Predict',   Icon: Target          },
]

export default function App() {
  const [page,          setPage]        = useState('dashboard')
  const [k,             setK]           = useState(5)
  const [dataset,       setDataset]     = useState(null)
  const [authenticated, setAuth]        = useState(!!localStorage.getItem('token'))
  const [showSignup,    setShowSignup]  = useState(false)
  const [isMobile,      setIsMobile]    = useState(window.innerWidth <= 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!authenticated) return
    api.datasetInfo()
      .then(info => {
        if (info.source === 'upload') {
          setDataset({ filename: info.filename, rows: info.row_count, colMap: info.col_map })
        } else {
          setDataset({ filename: info.filename, rows: info.row_count, isDefault: true })
        }
        setPage('dashboard')
      })
      .catch(() => {})
  }, [authenticated])

  const handleDatasetReady = (ds) => {
    if (ds) {
      setDataset(ds)
    } else {
      api.datasetInfo().then(info => setDataset({ filename: info.filename, rows: info.row_count, isDefault: true }))
    }
    setPage('dashboard')
  }

  const logout = () => {
    localStorage.removeItem('token')
    setAuth(false)
    setShowSignup(false)
  }

  if (!authenticated) {
    return showSignup
      ? <Signup switchToLogin={() => setShowSignup(false)} />
      : <Login  onLogin={() => setAuth(true)} switchToSignup={() => setShowSignup(true)} />
  }

  const isDefault = !dataset || dataset.isDefault

  return (
    <div className="app">
      <aside className="sidebar">
        {/* Logo — hidden on mobile via CSS */}
        <div className="sidebar-logo">
          <div style={{ marginBottom: 10 }}>
            <PixelLogo size={7} gap={2} />
          </div>
          <h1>CustomerIQ</h1>
          <span>Churn Intelligence</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => setPage(id)}>
              <Icon size={isMobile ? 20 : 16} />
              {label}
            </button>
          ))}

          {/* k selector — desktop only */}
          {!isMobile && (
            <div style={{ marginTop: 'auto', paddingTop: 24 }}>
              <div style={{ padding: '0 12px', marginBottom: 8, fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800 }}>
                Clusters (k)
              </div>
              <div style={{ padding: '0 12px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[3,4,5,6,7].map(n => (
                  <button key={n} className={`k-btn ${k === n ? 'active' : ''}`} onClick={() => setK(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mobile logout button in nav */}
          {isMobile && (
            <button className="nav-item" onClick={logout}
              style={{ color: 'var(--high)', borderTop: '1px solid var(--border)' }}>
              <LogOut size={20} />
              Logout
            </button>
          )}
        </nav>

        {/* Dataset footer — desktop only */}
        {!isMobile && (
          <div style={{ padding: '14px 20px', borderTop: '2px solid rgba(255,255,255,0.55)' }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 800, marginBottom: 4 }}>
              Active Dataset
            </div>
            <div style={{ fontSize: 11, color: isDefault ? 'var(--text2)' : 'var(--accent2)', fontWeight: 700, wordBreak: 'break-all' }}>
              {dataset ? dataset.filename : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {dataset ? `${Number(dataset.rows).toLocaleString()} rows` : ''}
              {isDefault ? ' · default' : ' · uploaded'}
            </div>

            {!isDefault && (
              <button className="k-btn" style={{ marginTop: 8, width: '100%', fontSize: 10 }}
                onClick={async () => { await api.resetDataset(); handleDatasetReady(null) }}>
                ↩ Use Default
              </button>
            )}

            <button onClick={logout} style={{ marginTop: 10, width: '100%', background: 'transparent', border: '2px solid rgba(255,255,255,0.55)', color: 'var(--text2)', padding: '8px 12px', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-body)', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background='var(--high)'; e.currentTarget.style.borderColor='var(--high)'; e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='translate(-2px,-2px)'; e.currentTarget.style.boxShadow='3px 3px 0px rgba(0,0,0,0.8)' }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='rgba(255,255,255,0.55)'; e.currentTarget.style.color='var(--text2)'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        )}
      </aside>

      <main className="main">
        {page === 'upload'    && <Upload    onDatasetReady={handleDatasetReady} currentDataset={isDefault ? null : dataset} />}
        {page === 'dashboard' && (
          <Dashboard k={k} setK={setK} isMobile={isMobile} dataset={dataset} isDefault={isDefault}
            onResetDataset={async () => { await api.resetDataset(); handleDatasetReady(null) }} />
        )}
        {page === 'customers' && <Customers k={k} />}
        {page === 'predict'   && <Predict />}
      </main>
    </div>
  )
}