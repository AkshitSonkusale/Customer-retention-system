import { useEffect, useState, useMemo } from 'react'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import { api } from '../api'
import { clusterColor, riskOf, errorMessage } from '../theme'
import { Loading, Alert, EmptyState } from '../components/States'

const PAGE_SIZE = 50

const COLUMNS = [
  { key: 'id',            label: 'ID' },
  { key: 'gender',        label: 'Gender' },
  { key: 'age',           label: 'Age',      num: true },
  { key: 'annualIncome',  label: 'Income',   num: true },
  { key: 'spendingScore', label: 'Spending' },
  { key: 'cluster',       label: 'Cluster' },
  { key: 'riskLevel',     label: 'Risk' },
]

const FILTERS = [
  { label: 'All',    level: null },
  { label: 'High',   level: 3 },
  { label: 'Medium', level: 2 },
  { label: 'Low',    level: 1 },
]

const compare = (a, b) => {
  if (typeof a === 'string' || typeof b === 'string') return String(a).localeCompare(String(b), undefined, { numeric: true })
  return (a ?? 0) - (b ?? 0)
}

export default function Customers({ k }) {
  const [customers,  setCustomers]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [search,     setSearch]     = useState('')
  const [riskFilter, setRiskFilter] = useState(null)
  const [sortKey,    setSortKey]    = useState('id')
  const [sortDir,    setSortDir]    = useState('asc')
  const [pageIdx,    setPageIdx]    = useState(0)
  const [reloadKey,  setReloadKey]  = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api.customers(k)
      .then(d => { if (active) setCustomers(d.customers) })
      .catch(e => { if (active) setError(errorMessage(e, 'Could not load customers.')) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [k, reloadKey])

  const riskCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0 }
    customers.forEach(c => { counts[c.riskLevel] = (counts[c.riskLevel] || 0) + 1 })
    return counts
  }, [customers])

  const filtered = useMemo(() => {
    let data = customers
    if (riskFilter) data = data.filter(c => c.riskLevel === riskFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      data = data.filter(c =>
        String(c.id).toLowerCase().includes(q) ||
        String(c.gender).toLowerCase().includes(q) ||
        String(c.churnRisk).toLowerCase().includes(q) ||
        `cluster ${c.cluster}` === q
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return [...data].sort((a, b) => compare(a[sortKey], b[sortKey]) * dir || compare(a.id, b.id))
  }, [customers, riskFilter, search, sortKey, sortDir])

  useEffect(() => { setPageIdx(0) }, [riskFilter, search, sortKey, sortDir, k])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(pageIdx, pageCount - 1)
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const sort = (key) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'riskLevel' ? 'desc' : 'asc') }
  }

  if (loading && !customers.length) return <Loading label="Loading customers..." />

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Customers</h2>
        <p>{customers.length.toLocaleString()} customers with their cluster and churn risk</p>
      </div>

      {error && <Alert style={{ marginBottom: 16 }} onRetry={() => setReloadKey(n => n + 1)}>{error}</Alert>}

      <div className="card">
        <div className="table-toolbar">
          <div className="filter-btns" role="group" aria-label="Filter by risk">
            {FILTERS.map(f => (
              <button key={f.label} className={`filter-btn ${riskFilter === f.level ? 'active' : ''}`}
                aria-pressed={riskFilter === f.level}
                onClick={() => setRiskFilter(f.level)}>
                {f.level && <span className="swatch" style={{ background: riskOf(f.level).color }} />}
                {f.label}
                <span className="count">{f.level ? riskCounts[f.level] || 0 : customers.length}</span>
              </button>
            ))}
          </div>
          <label className="search-wrap">
            <Search size={15} />
            <input className="search-input" type="search" placeholder="Search ID, gender or risk"
              aria-label="Search customers"
              value={search} onChange={e => setSearch(e.target.value)} />
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {COLUMNS.map(({ key, label, num }) => {
                  const sorted = sortKey === key
                  const Icon = !sorted ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
                  return (
                    <th key={key} className={num ? 'num' : undefined}
                      aria-sort={sorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button className={`th-sort ${sorted ? 'is-sorted' : ''}`} onClick={() => sort(key)}>
                        {label}<Icon size={12} />
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(c => {
                const risk  = riskOf(c.riskLevel)
                const color = clusterColor(c.cluster)
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>#{c.id}</td>
                    <td>{c.gender}</td>
                    <td className="num">{c.age}</td>
                    <td className="num">${c.annualIncome}k</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="meter" aria-hidden="true">
                          <div style={{ width: `${Math.min(100, c.spendingScore)}%`, background: 'var(--text2)' }} />
                        </div>
                        <span style={{ fontWeight: 700, minWidth: 24 }}>{c.spendingScore}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                        <span className="swatch" style={{ background: color, borderRadius: '50%' }} />
                        {c.cluster}
                      </span>
                    </td>
                    <td><span className={`badge ${risk.badge}`}>{c.churnRisk}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <EmptyState icon={SearchX} title="No matches">
              No customers match the current filter and search. Try clearing one of them.
            </EmptyState>
          )}
        </div>

        <div className="table-foot">
          <span className="pager-info">
            {filtered.length === 0
              ? 'No records'
              : `Showing ${(page * PAGE_SIZE + 1).toLocaleString()}–${Math.min((page + 1) * PAGE_SIZE, filtered.length).toLocaleString()} of ${filtered.length.toLocaleString()}`}
          </span>
          {pageCount > 1 && (
            <div className="pager">
              <button className="k-btn" onClick={() => setPageIdx(page - 1)} disabled={page === 0} aria-label="Previous page">
                <ChevronLeft size={14} />
              </button>
              <span className="pager-info">Page {page + 1} of {pageCount}</span>
              <button className="k-btn" onClick={() => setPageIdx(page + 1)} disabled={page >= pageCount - 1} aria-label="Next page">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
