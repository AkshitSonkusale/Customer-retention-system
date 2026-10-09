import { useState } from 'react'
import { Target, Sparkles, ArrowRight } from 'lucide-react'
import { api } from '../api'
import { RISK } from '../theme'
import { Alert, EmptyState } from '../components/States'

// [label, type, placeholder/options, key, required, extra input attrs]
const FIELDS = [
  ['Gender',              'select', ['Male', 'Female'], 'gender',            false],
  ['Age',                 'number', 'e.g. 28',          'age',               true,  { min: 1, max: 100 }],
  ['Annual income (k$)',  'number', 'e.g. 65',          'annualIncome',      true,  { min: 1 }],
  ['Spending score',      'number', '1 – 100',          'spendingScore',     true,  { min: 1, max: 100 }],
  ['Visits per month',    'number', 'e.g. 12',          'visitFrequency',    false, { min: 0 }],
  ['Satisfaction (1–10)', 'number', 'Default 5',        'satisfactionScore', false, { min: 1, max: 10 }],
  ['Complaints',          'number', 'e.g. 1',           'complaintsCount',   false, { min: 0 }],
  ['Loyalty points',      'number', 'e.g. 500',         'loyaltyPoints',     false, { min: 0 }],
]

const RISK_INFO = {
  'High Risk':   { level: 3, tips: ['Send a personalised discount offer', 'Invite to the loyalty programme', 'Schedule an outreach call'] },
  'Medium Risk': { level: 2, tips: ['Send seasonal promotions', 'Highlight new arrivals', 'Offer a membership upgrade'] },
  'Low Risk':    { level: 1, tips: ['Reward with exclusive access', 'Invite to VIP events', 'Ask for feedback'] },
}

// Mirrors RISK_HIGH_BELOW / RISK_MEDIUM_BELOW in backend/data_loader.py
const TIERS = [
  { level: 3, rule: 'Spending score below 35', desc: 'Disengaged customers who need intervention now.' },
  { level: 2, rule: 'Spending score 35–59',    desc: 'Occasional shoppers who are open to competitor offers.' },
  { level: 1, rule: 'Spending score 60+',      desc: 'Loyal, frequent visitors. Maintain and reward.' },
]

const EMPTY = {
  age: '', annualIncome: '', spendingScore: '', gender: 'Male',
  visitFrequency: '', satisfactionScore: '', complaintsCount: '', loyaltyPoints: '',
}

export default function Predict({ k }) {
  const [form,    setForm]    = useState(EMPTY)
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [aiRec,     setAiRec]     = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const age = Number(form.age), income = Number(form.annualIncome), spend = Number(form.spendingScore)
    if (!form.age || !form.annualIncome || !form.spendingScore) return 'Age, annual income and spending score are required.'
    if (age < 1 || age > 100)     return 'Age must be between 1 and 100.'
    if (income < 1)               return 'Annual income must be a positive number.'
    if (spend < 1 || spend > 100) return 'Spending score must be between 1 and 100.'
    if (form.satisfactionScore && (Number(form.satisfactionScore) < 1 || Number(form.satisfactionScore) > 10)) return 'Satisfaction must be between 1 and 10.'
    return ''
  }

  const payload = () => ({
    age: Number(form.age), annualIncome: Number(form.annualIncome),
    spendingScore: Number(form.spendingScore), gender: form.gender,
    visitFrequency: Number(form.visitFrequency || 0),
    satisfactionScore: Number(form.satisfactionScore || 5),
    complaintsCount: Number(form.complaintsCount || 0),
    loyaltyPoints: Number(form.loyaltyPoints || 0),
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }
    setError(''); setLoading(true)
    setAiRec(''); setAiError('')
    try {
      setResult(await api.predict(payload(), k))
    } catch {
      setError('Could not reach the prediction service. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleAiRecommend = async () => {
    if (!result) return
    setAiLoading(true); setAiError('')
    try {
      const res = await api.recommend({
        ...payload(),
        predictedChurnRisk: result.predictedChurnRisk,
        cluster: result.cluster,
        confidence: result.confidence,
      })
      setAiRec(res.recommendation)
    } catch {
      setAiError('AI recommendation is unavailable right now. Try again in a moment.')
    } finally {
      setAiLoading(false)
    }
  }

  const reset = () => { setForm(EMPTY); setResult(null); setError(''); setAiRec(''); setAiError('') }

  const info = result && (RISK_INFO[result.predictedChurnRisk] || RISK_INFO['Medium Risk'])
  const risk = info && RISK[info.level]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Predict churn</h2>
        <p>Enter a customer profile to get their churn risk, cluster and suggested next steps</p>
      </div>

      <div className="grid-2 section" style={{ alignItems: 'stretch' }}>
        {/* Form */}
        <form className="card" onSubmit={handleSubmit} noValidate>
          <div className="card-title">Customer profile</div>
          <p className="card-sub">Fields marked <span style={{ color: 'var(--high-ink)', fontWeight: 800 }}>*</span> are required. The rest improve accuracy.</p>
          <div className="form-grid">
            {FIELDS.map(([lbl, type, opt, key, required, attrs]) => (
              <div className="form-group" key={key}>
                <label className="form-label" htmlFor={`f-${key}`}>
                  {lbl}{required && <span className="req" aria-hidden="true">*</span>}
                </label>
                {type === 'select' ? (
                  <select id={`f-${key}`} className="form-select" value={form[key]} onChange={e => set(key, e.target.value)}>
                    {opt.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input id={`f-${key}`} className="form-input" type="number" inputMode="decimal" placeholder={opt}
                    required={required} {...attrs}
                    value={form[key]} onChange={e => set(key, e.target.value)} />
                )}
              </div>
            ))}
          </div>

          {error && <Alert style={{ marginTop: 16 }}>{error}</Alert>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button type="submit" className="btn" style={{ marginTop: 0 }} disabled={loading}>
              {loading ? <><div className="spinner spinner-sm" /> Predicting</> : <>Predict churn risk <ArrowRight size={16} /></>}
            </button>
            {result && (
              <button type="button" className="btn btn-secondary btn-auto" onClick={reset}>Clear</button>
            )}
          </div>
        </form>

        {/* Result panel */}
        <div className="card result-panel" aria-live="polite">
          {!result && (
            <div style={{ margin: 'auto' }}>
              {loading
                ? <div className="loading"><div className="spinner" /><span>Scoring customer...</span></div>
                : <EmptyState icon={Target} title="No prediction yet">
                    Fill in the profile and press Predict. The risk level, cluster and retention ideas will appear here.
                  </EmptyState>}
            </div>
          )}

          {result && (
            <div className="fade-in" style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
              <div className="eyebrow">Predicted churn risk</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: 1, color: 'var(--text)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="swatch" style={{ width: 18, height: 18, background: risk.color }} />
                {result.predictedChurnRisk}
              </div>

              <div className="result-metrics">
                <div className="result-metric">
                  <div className="eyebrow">Cluster (k = {result.k})</div>
                  <div className="result-metric-val">{result.cluster}</div>
                </div>
                <div className="result-metric">
                  <div className="eyebrow">Confidence</div>
                  <div className="result-metric-val">{result.confidence != null ? `${result.confidence}%` : '—'}</div>
                </div>
                <div className="result-metric">
                  <div className="eyebrow">Model</div>
                  <div className="result-metric-val" style={{ fontSize: 20, paddingTop: 6 }}>
                    {result.modelUsed === 'xgboost' ? 'XGBoost' : result.modelUsed ? 'Random Forest' : 'K-Means'}
                  </div>
                </div>
              </div>

              <div className="callout" style={{ borderLeftColor: risk.color }}>
                <div className="callout-title">{result.recommendation}</div>
                <ul>{info.tips.map(t => <li key={t}>{t}</li>)}</ul>
              </div>

              <div style={{ marginTop: 14 }}>
                {!aiRec && (
                  <button className="btn btn-secondary" style={{ marginTop: 0 }} onClick={handleAiRecommend} disabled={aiLoading}>
                    {aiLoading ? <><div className="spinner spinner-sm" /> Writing strategy</> : <><Sparkles size={15} /> Get AI retention strategy</>}
                  </button>
                )}
                {aiError && <Alert style={{ marginTop: 10 }}>{aiError}</Alert>}
                {aiRec && (
                  <div className="callout fade-in" style={{ borderLeftColor: 'var(--accent)' }}>
                    <div className="eyebrow" style={{ color: 'var(--accent2)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={13} /> AI retention strategy
                    </div>
                    <div className="ai-text">{aiRec}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Risk tier legend */}
      <p className="muted" style={{ margin: 0 }}>
        These spending-score rules apply when the dataset has no ChurnRisk labels. With labels, risk comes from the trained model.
      </p>
      <div className="grid-3">
        {TIERS.map(t => {
          const r = RISK[t.level]
          return (
            <div key={t.level} className="card card-flat kpi" style={{ borderLeftColor: r.color }}>
              <span className={`badge ${r.badge}`}>{r.label}</span>
              <div style={{ fontWeight: 800, fontSize: 14, marginTop: 10 }}>{t.rule}</div>
              <div className="muted" style={{ marginTop: 2 }}>{t.desc}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
