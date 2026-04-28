import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

export default function Login() {
  const [email, setEmail] = useState('admin@csagent.ai')
  const [password, setPassword] = useState('Admin@1234!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/support/queue')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--gradient-hero)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px',
            background: 'var(--pink)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 800, color: '#fff',
            margin: '0 auto 12px',
            boxShadow: '0 8px 24px rgba(207,0,139,.3)',
          }}>C</div>
          <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--neutral-0)' }}>centific</div>
          <div style={{ fontSize: '12px', color: 'var(--neutral-4)', letterSpacing: '.04em' }}>aegis.ai · CSAgent Portal</div>
        </div>

        {/* Card */}
        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          <div className="card-body">
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--neutral-0)', marginBottom: '4px' }}>
              Welcome back
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--neutral-4)', marginBottom: '24px' }}>
              Sign in to your CSAgent workspace
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.ai"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div style={{
                  background: 'var(--error-light)',
                  border: '1px solid var(--error)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: 'var(--error)',
                  marginBottom: '16px',
                }}>
                  ⚠️ {error}
                </div>
              )}

              <button
                id="login-submit"
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
                style={{ justifyContent: 'center', padding: '11px' }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Default creds hint */}
            <div style={{
              marginTop: '20px',
              padding: '10px 14px',
              background: 'var(--primary-light)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11.5px',
              color: 'var(--neutral-3)',
            }}>
              <strong style={{ color: 'var(--primary)' }}>Dev defaults (Password: Role@1234!):</strong><br/>
              • Admin: admin@csagent.ai (Admin@1234!)<br/>
              • Agent: agent@csagent.ai<br/>
              • Manager: manager@csagent.ai<br/>
              • VP: vp@csagent.ai<br/>
              • Legal: legal@csagent.ai
            </div>
          </div>
        </div>

        {/* AI notice */}
        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--neutral-5)', marginTop: '16px' }}>
          🤖 This system uses AI agents to process support tickets.
        </p>
      </div>
    </div>
  )
}
