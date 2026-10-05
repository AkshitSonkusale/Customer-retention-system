import { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Predict   from './pages/Predict'
import Upload    from './pages/Upload'
import Login     from './pages/Login'
import Signup    from './pages/Signup'
import Trends    from './pages/Trends'
import { api }   from './api'
import PixelLogo from './components/PixelLogo'
import ThemeToggle from './components/ThemeToggle'
import { LogOut, Database, LayoutDashboard, Users, Target, TrendingUp, RotateCcw } from 'lucide-react'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'customers', label: 'Customers', Icon: Users           },
  { id: 'predict',   label: 'Predict',   Icon: Target          },
  { id: 'trends',    label: 'Trends',    Icon: TrendingUp      },
  { id: 'upload',    label: 'Dataset',   Icon: Database        },
]

const K_OPTIONS = [3, 4, 5, 6, 7]

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

  useEffect(() => { window.scrollTo(0, 0) }, [page])

  const handleDatasetReady = (ds) => {
    if (ds) {
      setDataset(ds)
    } else {
      api.datasetInfo().then(info => setDataset({ filename: info.filename, rows: info.row_count, isDefault: true }))
    }
    setPage('dashboard')
  }

  const resetDataset = async () => { await api.resetDataset(); handleDatasetReady(null) }

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
        <div className="sidebar-logo">
          <div style={{ marginBottom: 12 }}>
            <PixelLogo size={7} gap={2} />
          </div>
          <h1>CustomerIQ</h1>
          <span>Churn Intelligence</span>
        </div>

        <nav className="sidebar-nav" aria-label="Main">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}>
              <Icon size={isMobile ? 20 : 16} />
              {label}
            </button>
          ))}

          {isMobile && (
            <button className="nav-item" onClick={logout}>
              <LogOut size={20} />
              Logout
            </button>
          )}

          {!isMobile && (
            <div className="sidebar-section">
              <div className="eyebrow" style={{ marginBottom: 8 }}>Clusters (k)</div>
              <div className="k-group" role="group" aria-label="Number of clusters">
                {K_OPTIONS.map(n => (
                  <button key={n} className={`k-btn ${k === n ? 'active' : ''}`}
                    aria-pressed={k === n} onClick={() => setK(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {!isMobile && (
          <div className="sidebar-footer">
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Active dataset</div>
              <div className="dataset-name">{dataset ? dataset.filename : '—'}</div>
              <div className="dataset-meta" style={{ marginTop: 2 }}>
                {dataset ? `${Number(dataset.rows).toLocaleString()} rows · ` : ''}
                {isDefault ? 'default' : 'uploaded'}
              </div>
            </div>

            {!isDefault && (
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 0 }} onClick={resetDataset}>
                <RotateCcw size={13} /> Use default
              </button>
            )}

            <div className="sidebar-actions" style={{ marginTop: 4 }}>
              <ThemeToggle className="btn btn-sm btn-secondary" />
              <button className="btn btn-sm btn-danger-ghost" style={{ marginTop: 0 }} onClick={logout}>
                <LogOut size={13} /> Logout
              </button>
            </div>
          </div>
        )}
      </aside>

      <main className="main">
        <div className="page">
          {page === 'upload'    && <Upload    onDatasetReady={handleDatasetReady} onReset={resetDataset} currentDataset={isDefault ? null : dataset} />}
          {page === 'dashboard' && (
            <Dashboard k={k} setK={setK} kOptions={K_OPTIONS} isMobile={isMobile} dataset={dataset} isDefault={isDefault}
              onResetDataset={resetDataset} />
          )}
          {page === 'trends'    && <Trends onDatasetReady={handleDatasetReady} />}
          {page === 'customers' && <Customers k={k} />}
          {page === 'predict'   && <Predict />}
        </div>
      </main>
    </div>
  )
}
