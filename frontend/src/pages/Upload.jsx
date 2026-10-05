import { useState, useRef } from 'react'
import { UploadCloud, FileSpreadsheet, Columns3, RotateCcw, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react'
import { api } from '../api'
import { errorMessage } from '../theme'
import { Alert } from '../components/States'

const ROLES = [
  { key: 'id',       label: 'Customer ID',    required: false, hint: 'Unique row identifier' },
  { key: 'gender',   label: 'Gender',         required: false, hint: 'Male / Female column'  },
  { key: 'age',      label: 'Age',            required: true,  hint: 'Numeric age column'    },
  { key: 'income',   label: 'Annual income',  required: true,  hint: 'Numeric income column' },
  { key: 'spending', label: 'Spending score', required: true,  hint: 'Numeric score, 1–100'  },
]

const STEPS = ['Upload file', 'Map columns', 'Analyse']

function Stepper({ current }) {
  return (
    <ol style={{ display: 'flex', gap: 8, listStyle: 'none', marginBottom: 20, flexWrap: 'wrap' }} aria-label="Upload progress">
      {STEPS.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        return (
          <li key={s} aria-current={state === 'current' ? 'step' : undefined}
            className={`filter-btn ${state === 'current' ? 'active' : ''}`}
            style={{ cursor: 'default', opacity: state === 'todo' ? 0.6 : 1, boxShadow: state === 'current' ? 'var(--shadow-sm)' : 'none' }}>
            {state === 'done' ? <CheckCircle2 size={13} /> : <span>{i + 1}</span>} {s}
          </li>
        )
      })}
    </ol>
  )
}

export default function Upload({ onDatasetReady, onReset, currentDataset }) {
  const [step,       setStep]       = useState('idle')
  const [uploadData, setUploadData] = useState(null)
  const [colMap,     setColMap]     = useState({})
  const [drag,       setDrag]       = useState(false)
  const [error,      setError]      = useState('')
  const fileRef = useRef()

  const handleFile = async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) { setError('Please choose a .csv file.'); return }
    setError(''); setStep('uploading')
    try {
      const data = await api.uploadCSV(file)
      setUploadData(data)
      setColMap(data.suggestion || {})
      setStep('mapping')
    } catch (e) {
      setError(errorMessage(e, 'Upload failed. Please try again.'))
      setStep('idle')
    }
  }

  const handleConfirm = async () => {
    for (const r of ROLES.filter(r => r.required)) {
      if (!colMap[r.key]) { setError(`Choose a column for "${r.label}".`); return }
    }
    setError(''); setStep('confirming')
    try {
      await api.confirmUpload(uploadData.token, colMap)
      onDatasetReady({ filename: uploadData.filename, rows: uploadData.totalRows, colMap })
    } catch (e) {
      setError(errorMessage(e, 'Could not apply the column mapping.'))
      setStep('mapping')
    }
  }

  const openPicker = () => { if (step !== 'uploading') fileRef.current.click() }

  if (step === 'idle' || step === 'uploading') return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Dataset</h2>
        <p>Upload your own customer CSV to run the full analysis on it</p>
      </div>

      <Stepper current={0} />

      {currentDataset && (
        <div className="card section kpi" style={{ borderLeftColor: 'var(--low)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Currently active</div>
            <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>{currentDataset.filename}</div>
            <div className="muted">{Number(currentDataset.rows).toLocaleString()} rows loaded</div>
          </div>
          <button className="btn btn-sm btn-secondary btn-auto" onClick={onReset}>
            <RotateCcw size={13} /> Use default dataset
          </button>
        </div>
      )}

      <div
        className={`drop-zone ${drag ? 'is-dragging' : ''}`}
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV file"
        aria-busy={step === 'uploading'}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={openPicker}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() } }}
      >
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
          onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />

        {step === 'uploading' ? (
          <>
            <div className="spinner" style={{ marginBottom: 12 }} />
            <div className="drop-zone-title">Reading your file...</div>
          </>
        ) : (
          <>
            <div className="drop-zone-icon"><UploadCloud size={26} /></div>
            <div className="drop-zone-title">{drag ? 'Drop to upload' : 'Drop a CSV here or click to browse'}</div>
            <div className="muted">Needs numeric columns for age, annual income and spending score</div>
          </>
        )}
      </div>

      {error && <Alert style={{ marginTop: 14 }}>{error}</Alert>}

      <div className="grid-3" style={{ marginTop: 24 }}>
        {[
          { Icon: FileSpreadsheet, title: 'Any column names', desc: 'You map your columns to the right roles in the next step.' },
          { Icon: Columns3,        title: '3 required fields', desc: 'Age, annual income and spending score must be numeric.' },
          { Icon: RotateCcw,       title: 'Switch anytime',    desc: 'Go back to the default dataset or a past upload with one click.' },
        ].map(({ Icon, title, desc }) => (
          <div key={title} className="card card-flat info-tile">
            <div className="info-tile-icon"><Icon size={18} /></div>
            <div>
              <div className="info-tile-title">{title}</div>
              <div className="muted">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (step === 'mapping' || step === 'confirming') return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Map columns</h2>
        <p>{uploadData.filename} · {uploadData.totalRows.toLocaleString()} rows detected</p>
      </div>

      <Stepper current={1} />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">Column roles</div>
          <p className="card-sub">We pre-filled our best guess. Check each one before continuing.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ROLES.map(role => (
              <div key={role.key} className="form-group">
                <label className="form-label" htmlFor={`map-${role.key}`}>
                  {role.label}
                  {role.required ? <span className="req" aria-hidden="true">*</span> : <span className="opt">(optional)</span>}
                </label>
                <select id={`map-${role.key}`} className="form-select" value={colMap[role.key] || ''}
                  onChange={e => setColMap(m => ({ ...m, [role.key]: e.target.value || undefined }))}>
                  <option value="">— Not mapped —</option>
                  {uploadData.columns.map(col => <option key={col} value={col}>{col}</option>)}
                </select>
                <div className="form-hint">{role.hint}</div>
              </div>
            ))}
          </div>

          {error && <Alert style={{ marginTop: 16 }}>{error}</Alert>}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-secondary btn-auto" onClick={() => { setStep('idle'); setUploadData(null); setError('') }}>
              <ArrowLeft size={15} /> Back
            </button>
            <button className="btn" style={{ marginTop: 0 }} onClick={handleConfirm} disabled={step === 'confirming'}>
              {step === 'confirming' ? <><div className="spinner spinner-sm" /> Applying</> : <>Confirm and analyse <ArrowRight size={15} /></>}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Preview</div>
          <p className="card-sub">First 5 rows of your file</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>{uploadData.columns.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {uploadData.preview.map((row, i) => (
                  <tr key={i}>
                    {uploadData.columns.map(c => <td key={c}>{String(row[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="chart-note">
            {uploadData.totalRows.toLocaleString()} rows · {uploadData.numericColumns.length} numeric · {uploadData.categoricalColumns.length} text columns
          </div>
        </div>
      </div>
    </div>
  )

  return null
}
