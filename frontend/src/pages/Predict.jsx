import { useState } from 'react'
import { api } from '../api'

const FIELDS = [
  ['Gender',              'select', ['Male','Female'],  'gender'],
  ['Age',                 'number', 'e.g. 28',          'age'],
  ['Annual Income (k$)',  'number', 'e.g. 65',          'annualIncome'],
  ['Spending Score',      'number', 'e.g. 72',          'spendingScore'],
  ['Visit Frequency',     'number', 'e.g. 12',          'visitFrequency'],
  ['Satisfaction (1-10)', 'number', 'e.g. 8',           'satisfactionScore'],
  ['Complaints Count',    'number', 'e.g. 1',           'complaintsCount'],
  ['Loyalty Points',      'number', 'e.g. 500',         'loyaltyPoints'],
]

const RISK_INFO = {
  'High Risk':   { tips: ['Send personalised discount offer', 'Invite to loyalty programme', 'Schedule outreach call'], border: 'var(--high)',   bg: 'rgba(239,68,68,0.08)' },
  'Medium Risk': { tips: ['Send seasonal promotions', 'Highlight new arrivals', 'Offer membership upgrade'],            border: 'var(--med)',    bg: 'rgba(245,158,11,0.08)' },
  'Low Risk':    { tips: ['Reward with exclusive access', 'Invite to VIP events', 'Collect feedback'],                 border: 'var(--low)',    bg: 'rgba(16,185,129,0.08)' },
}

export default function Predict() {
  const [form, setForm] = useState({
    age: '', annualIncome: '', spendingScore: '', gender: 'Male',
    visitFrequency: '', satisfactionScore: '', complaintsCount: '', loyaltyPoints: ''
  })
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [aiRec,     setAiRec]     = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError,   setAiError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    if (!form.age || !form.annualIncome || !form.spendingScore) return 'Fill required fields.'
    if (form.age < 1 || form.age > 100)           return 'Age must be 1–100.'
    if (form.annualIncome < 1)                     return 'Income must be positive.'
    if (form.spendingScore < 1 || form.spendingScore > 100) return 'Spending score must be 1–100.'
    return ''
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError(''); setLoading(true)
    setAiRec(''); setAiError('')
    try {
      const res = await api.predict({
        age: Number(form.age), annualIncome: Number(form.annualIncome),
        spendingScore: Number(form.spendingScore), gender: form.gender,
        visitFrequency: Number(form.visitFrequency || 0),
        satisfactionScore: Number(form.satisfactionScore || 5),
        complaintsCount: Number(form.complaintsCount || 0),
        loyaltyPoints: Number(form.loyaltyPoints || 0),
      })
      setResult(res)
    } catch {
      setError('Cannot connect to backend. Make sure API is running.')
    } finally {
      setLoading(false)
    }
  }

  const handleAiRecommend = async () => {
    if (!result) return
    setAiLoading(true); setAiError('')
    try {
      const res = await api.recommend({
        age: Number(form.age), annualIncome: Number(form.annualIncome),
        spendingScore: Number(form.spendingScore), gender: form.gender,
        visitFrequency: Number(form.visitFrequency || 0),
        satisfactionScore: Number(form.satisfactionScore || 5),
        complaintsCount: Number(form.complaintsCount || 0),
        loyaltyPoints: Number(form.loyaltyPoints || 0),
        predictedChurnRisk: result.predictedChurnRisk,
        cluster: result.cluster,
        confidence: result.confidence,
      })
      setAiRec(res.recommendation)
    } catch {
      setAiError('AI recommendation unavailable right now.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Customer Intelligence</h2>
        <p>Input customer profile — get instant churn risk prediction with confidence score</p>
      </div>

      <div className="grid-2" style={{ maxWidth: 900, alignItems: 'stretch' }}>
        {/* Form */}
        <div className="card">
          <div className="card-title">Profile Matrix</div>
          <div className="form-grid">
            {FIELDS.map(([lbl, type, opt, key]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{lbl}</label>
                {type === 'select' ? (
                  <select className="form-select" value={form[key]} onChange={e => set(key, e.target.value)}>
                    {opt.map(o => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className="form-input" style={{ paddingLeft: 12 }} type="number" placeholder={opt}
                    value={form[key]} onChange={e => set(key, e.target.value)} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div style={{ color: 'var(--high)', fontWeight: 800, fontSize: 11, marginTop: 12, textTransform: 'uppercase', letterSpacing: 1, border: '2px solid var(--high)', padding: '8px 12px' }}>
              ⚠ {error}
            </div>
          )}

          <button className="btn" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Predicting...' : 'Predict Churn Risk →'}
          </button>
        </div>

        {/* Result panel */}
        <div className="card" style={{ background: 'var(--bg3)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', minHeight: 300 }}>
          {!result && !loading && (
            <div>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 3, color: 'var(--text3)', textTransform: 'uppercase' }}>
                Awaiting Input
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                Fill the form to get prediction
              </div>
            </div>
          )}

          {loading && <div className="loading"><div className="spinner" /></div>}

          {result && !loading && (() => {
            const info   = RISK_INFO[result.predictedChurnRisk] || RISK_INFO['Medium Risk']
            const bClass = result.riskLevel === 3 ? 'badge-high' : result.riskLevel === 2 ? 'badge-med' : 'badge-low'
            return (
              <div style={{ width: '100%', animation: 'fadeIn 0.25s ease' }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>{result.riskBadge}</div>
                <span className={`badge ${bClass}`} style={{ fontSize: 13, padding: '6px 18px' }}>
                  {result.predictedChurnRisk}
                </span>

                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Cluster</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: 2, color: 'var(--text)' }}>{result.cluster}</div>
                  </div>
                  {result.confidence && (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>Confidence</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: 2, color: 'var(--accent2)' }}>{result.confidence}%</div>
                    </div>
                  )}
                </div>
                {result.modelUsed && (
                  <div style={{ marginTop: 10, fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Model: {result.modelUsed === 'xgboost' ? 'XGBoost' : 'Random Forest'}
                  </div>
                )}

                <div style={{ background: info.bg, border: `2px solid ${info.border}`, marginTop: 16, padding: 14, textAlign: 'left', boxShadow: `3px 3px 0px ${info.border}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    {result.recommendation}
                  </div>
                  {info.tips.map((t, i) => (
                    <div key={i} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginTop: 4 }}>→ {t}</div>
                  ))}
                </div>

                <div style={{ marginTop: 12, textAlign: 'left' }}>
                  {!aiRec && (
                    <button className="btn" style={{ width: '100%' }} onClick={handleAiRecommend} disabled={aiLoading}>
                      {aiLoading ? 'Thinking...' : '✨ Get AI Recommendation'}
                    </button>
                  )}
                  {aiError && (
                    <div style={{ color: 'var(--high)', fontWeight: 700, fontSize: 11, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                      ⚠ {aiError}
                    </div>
                  )}
                  {aiRec && (
                    <div style={{ background: 'var(--bg3)', border: '2px solid var(--accent2)', marginTop: 8, padding: 14, boxShadow: '3px 3px 0px var(--accent2)' }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                        ✨ AI Retention Strategy
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', lineHeight: 1.6 }}>{aiRec}</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Risk tier legend */}
      <div className="grid-3" style={{ marginTop: 20, maxWidth: 900 }}>
        {[
          { risk: 'High Risk', emoji: '🔴', desc: 'Spending score < 35. Disengaged customers needing immediate intervention.',       border: 'var(--high)' },
          { risk: 'Medium Risk', emoji: '🟡', desc: 'Spending score 35–55. Occasional shoppers susceptible to competitor offers.',   border: 'var(--med)'  },
          { risk: 'Low Risk', emoji: '🟢', desc: 'Spending score > 55. Loyal frequent visitors. Maintain and reward.',               border: 'var(--low)'  },
        ].map(info => (
          <div key={info.risk} className="card" style={{ borderLeft: `5px solid ${info.border}` }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 2, marginBottom: 6, color: 'var(--text)' }}>
              {info.emoji} {info.risk}
            </div>
            <div style={{ color: 'var(--text2)', fontSize: 12, fontWeight: 600, lineHeight: 1.6 }}>{info.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}