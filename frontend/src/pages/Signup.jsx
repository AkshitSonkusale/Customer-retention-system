import { useState } from "react"
import { User, Mail, Lock, Eye, EyeOff, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react"
import axios from "axios"
import AuthBackground from "./AuthBackground"
import PixelLogo from "../components/PixelLogo"
import ThemeToggle from "../components/ThemeToggle"

const BASE = "https://customeriq-backend.onrender.com"

function scorePassword(pw) {
  if (!pw) return { level: 0, label: "", color: "" }
  let s = 0
  if (pw.length >= 8)               s++
  if (pw.length >= 12)              s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw))                s++
  if (/[^a-zA-Z0-9]/.test(pw))     s++
  return [
    { level: 0, label: "",        color: "" },
    { level: 1, label: "Weak",    color: "var(--high)" },
    { level: 2, label: "Fair",    color: "var(--med)" },
    { level: 3, label: "Good",    color: "var(--low)" },
    { level: 4, label: "Strong",  color: "var(--low)" },
  ][Math.min(4, s)]
}

export default function Signup({ switchToLogin }) {
  const [username, setUsername] = useState("")
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  const strength = scorePassword(password)

  const handleSignup = async (e) => {
    e.preventDefault()
    try {
      setLoading(true); setError("")
      await axios.post(`${BASE}/auth/signup`, { username, email, password })
      switchToLogin()
    } catch (err) {
      setError(err?.response?.data?.detail || "Signup failed. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", position: "relative" }}>
      <AuthBackground />

      <div style={{ position: "absolute", top: 20, right: 20, zIndex: 20 }}>
        <ThemeToggle />
      </div>

      <div style={{ width: "100%", display: "flex", justifyContent: "center", padding: "88px 20px 60px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 64, width: "100%", maxWidth: 1040 }}>

          {/* Left — branding */}
          <section style={{ flex: "1 1 420px", maxWidth: 500, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
              <PixelLogo size={10} gap={2.5} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: 28, textTransform: "uppercase", letterSpacing: 3 }}>CustomerIQ</span>
            </div>

            <h1 className="auth-headline" style={{ fontSize: 56 }}>
              Build smarter<br/>
              <span>growth strategies.</span>
            </h1>

            <p className="auth-sub">
              ML-powered segmentation, churn prediction, and lifetime value modeling — all in one unified intelligence platform.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
              {[
                'Cluster analysis across behavioural signals',
                'Real-time churn risk scoring with explainability',
                'LTV forecasting powered by ensemble models',
              ].map(f => (
                <div key={f} className="feature-pill">→ {f}</div>
              ))}
            </div>

            <div className="stat-strip">
              <div className="stat-item">
                <div className="stat-num">98.95<span className="stat-suffix">%</span></div>
                <span className="stat-desc">Model Accuracy</span>
              </div>
              <div className="stat-divider" />
              <div className="stat-item">
                <div className="stat-num">10K<span className="stat-suffix">+</span></div>
                <span className="stat-desc">Data Points</span>
              </div>
            </div>
          </section>

          {/* Right — signup card */}
          <section style={{ flex: "0 1 400px", minWidth: 0, width: "100%", maxWidth: 420 }}>
            <form className="auth-card" onSubmit={handleSignup}>
              <h2 className="auth-card-title">Create account</h2>
              <p className="auth-card-sub">Start your CustomerIQ journey — it's free</p>

              <div className="form-group">
                <label className="form-label" htmlFor="su-username">Username</label>
                <div className="input-wrap">
                  <span className="input-icon"><User size={15} /></span>
                  <input id="su-username" className="form-input" autoComplete="username" placeholder="ada_lovelace"
                    value={username} onChange={e => setUsername(e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="su-email">Work email</label>
                <div className="input-wrap">
                  <span className="input-icon"><Mail size={15} /></span>
                  <input id="su-email" className="form-input" type="email" autoComplete="email" placeholder="ada@company.com"
                    value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label" htmlFor="su-password">Password</label>
                <div className="input-wrap">
                  <span className="input-icon"><Lock size={15} /></span>
                  <input id="su-password" className="form-input has-trailing" type={showPass ? "text" : "password"}
                    autoComplete="new-password" placeholder="Min. 8 characters"
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" className="input-trailing" onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}>
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {password && (
                  <div className="strength-wrap">
                    <div className="strength-bar">
                      <div style={{ width: `${strength.level * 25}%`, background: strength.color }} />
                    </div>
                    <span className="eyebrow" style={{ color: "var(--text2)", minWidth: 48 }}>{strength.label}</span>
                  </div>
                )}
              </div>

              {error && (
                <div className="alert" role="alert" style={{ marginBottom: 14 }}>
                  <AlertTriangle size={16} /><span>{error}</span>
                </div>
              )}

              <button type="submit" className="btn" style={{ marginTop: 0 }} disabled={loading}>
                {loading ? <><div className="spinner spinner-sm" /> Creating account</> : <>Create account <ArrowRight size={16} /></>}
              </button>

              <p className="auth-switch">
                Already have an account?{" "}
                <button type="button" className="switch-link" onClick={switchToLogin}>Sign in</button>
              </p>
            </form>

            <p className="auth-trust">
              <ShieldCheck size={14} style={{ color: "var(--low-ink)" }} />
              Protected by industry-standard encryption
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
