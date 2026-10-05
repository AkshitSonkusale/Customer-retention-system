import { useState, useRef } from "react"
import { Mail, Lock, Eye, EyeOff, Info, MessageSquare, Layers, Activity, Cpu, ExternalLink, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react"
import axios from "axios"
import AuthBackground from "./AuthBackground"
import PixelLogo from "../components/PixelLogo"
import ThemeToggle from "../components/ThemeToggle"

const BASE = "https://customeriq-backend.onrender.com"

export default function Login({ onLogin, switchToSignup }) {
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  const aboutRef   = useRef(null)
  const contactRef = useRef(null)

  const handleLogin = async () => {
    try {
      setLoading(true); setError("")
      const res = await axios.post(`${BASE}/auth/login`, { email, password })
      localStorage.setItem("token", res.data.token || res.data.access_token)
      onLogin()
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", position: "relative" }}>

      {/* Header */}
      <header className="auth-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PixelLogo size={5} gap={1.3} iWidthScale={1.4} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, letterSpacing: 3, textTransform: 'uppercase' }}>CustomerIQ</span>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => aboutRef.current?.scrollIntoView({ behavior: "smooth" })} className="k-btn">
            <Info size={13} /> <span className="label">About</span>
          </button>
          <button onClick={() => contactRef.current?.scrollIntoView({ behavior: "smooth" })} className="k-btn">
            <MessageSquare size={13} /> <span className="label">Contact</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main split */}
      <div style={{ width: "100%", display: "flex", justifyContent: "center", padding: "120px 20px 80px", boxSizing: "border-box", position: "relative", zIndex: 10 }}>
        <AuthBackground />

        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 64, width: "100%", maxWidth: 1040 }}>

          {/* Left — branding */}
          <section style={{ flex: "1 1 420px", maxWidth: 480, minWidth: 0 }}>
            <h1 className="auth-headline">
              Understand your<br/>
              <span>customers deeply.</span>
            </h1>

            <p className="auth-sub">
              ML-powered segmentation, churn prediction, and lifetime value modeling — all in one unified intelligence platform.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {['Cluster analysis across behavioural signals', 'Real-time churn risk scoring insights', 'LTV forecasting powered by ensemble models'].map(f => (
                <div key={f} className="feature-pill">→ {f}</div>
              ))}
            </div>

            <div className="stat-strip">
              <div className="stat-item">
                <div className="stat-num">K-Means<span className="stat-suffix">++</span></div>
                <span className="stat-desc">Optimized Seeding</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <div className="stat-num">&lt;200<span className="stat-suffix">ms</span></div>
                <span className="stat-desc">Inference Speed</span>
              </div>
            </div>
          </section>

          {/* Right — login card */}
          <section style={{ flex: "0 1 400px", minWidth: 0, width: "100%", maxWidth: 420 }}>
            <form className="auth-card" onSubmit={e => { e.preventDefault(); handleLogin() }}>
              <h2 className="auth-card-title">Welcome back</h2>
              <p className="auth-card-sub">Sign in to your CustomerIQ workspace</p>

              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Email address</label>
                <div className="input-wrap">
                  <span className="input-icon"><Mail size={15} /></span>
                  <input id="login-email" className="form-input" type="email" autoComplete="email" placeholder="you@company.com"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" htmlFor="login-password">Password</label>
                <div className="input-wrap">
                  <span className="input-icon"><Lock size={15} /></span>
                  <input id="login-password" className="form-input has-trailing" type={showPass ? "text" : "password"}
                    autoComplete="current-password" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" className="input-trailing" onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="alert" role="alert" style={{ marginBottom: 14 }}>
                  <AlertTriangle size={16} /><span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn" style={{ marginTop: 0 }} disabled={loading}>
                {loading ? <><div className="spinner spinner-sm" /> Signing in</> : <>Sign in <ArrowRight size={16} /></>}
              </button>

              <p className="auth-switch">
                No account?{" "}
                <button type="button" className="switch-link" onClick={switchToSignup}>Create one free</button>
              </p>
            </form>

            <p className="auth-trust">
              <ShieldCheck size={13} style={{ color: "var(--low)" }} />
              Protected by industry-standard encryption
            </p>
          </section>
        </div>
      </div>

      {/* About section */}
      <section ref={aboutRef} style={{ padding: "80px 24px", maxWidth: 1040, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <div style={{ borderTop: "2px solid var(--border-strong)", paddingTop: 48 }}>
          <div className="card">
            <div className="card-title" style={{ color: "var(--accent2)" }}>Platform Objective</div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 400, lineHeight: 1.1, marginBottom: 16, textTransform: "uppercase", letterSpacing: 2 }}>
              Advanced Intelligence For Modern Retention
            </h2>
            <p style={{ color: "var(--text2)", fontSize: 15, lineHeight: 1.7, marginBottom: 32, maxWidth: 720 }}>
              CustomerIQ transforms raw customer data into clean, actionable insight streams. K-Means clustering assigns distinct behavioural risk profiles to customer segments, while Random Forest classification validates and predicts individual churn probability.
            </p>
            <div className="grid-3">
              {[
                { icon: <Layers size={20} />, title: 'Dynamic Clustering', desc: 'Segment customers by income and spending patterns using optimized K-Means++ seeding.' },
                { icon: <Activity size={20} />, title: 'Elbow Method', desc: 'Track WCSS across k values to find the optimal number of clusters for your dataset.' },
                { icon: <Cpu size={20} />, title: 'RF Classification', desc: 'Random Forest validates cluster assignments using all 7 behavioural features.' },
              ].map(c => (
                <div key={c.title} className="card card-flat" style={{ padding: 24 }}>
                  <div style={{ color: "var(--accent2)", marginBottom: 12 }}>{c.icon}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 17, letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' }}>{c.title}</div>
                  <p className="muted">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer ref={contactRef} style={{ background: "var(--bg2)", borderTop: "2px solid var(--border-strong)", padding: "48px 24px", position: "relative", zIndex: 10 }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 24 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>CustomerIQ</div>
            <p className="muted">
              Precision analytics for automated customer retention.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <a className="outline-link" href="https://github.com/AkshitSonkusale/Mall-Customer-Churn-Prediction-System"
              target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> GitHub repo
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}