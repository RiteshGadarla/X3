import { useState } from 'react'

export default function CustomerPortal() {
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    subject: '',
    description: '',
    category: 'General',
    ai_disclosure_accepted: false,
  })
  const [submitted, setSubmitted] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('submit') // 'submit' or 'status'
  const [statusForm, setStatusForm] = useState({ ticket_ref: '', customer_email: '' })
  const [statusResult, setStatusResult] = useState(null)

  const categories = ['General', 'Billing', 'Technical', 'Account', 'Feature Request', 'Security', 'Other']

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.ai_disclosure_accepted) {
      setError('Please accept the AI assistance disclosure to proceed.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/tickets/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Submission failed')
      }
      const ticket = await res.json()
      setSubmitted(ticket)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setStatusResult(null)
    try {
      const url = new URL(`${import.meta.env.VITE_API_BASE_URL}/tickets/status/check`)
      url.searchParams.append('ticket_ref', statusForm.ticket_ref)
      url.searchParams.append('customer_email', statusForm.customer_email)
      
      const res = await fetch(url)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to fetch status')
      }
      const ticket = await res.json()
      setStatusResult(ticket)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--gradient-hero)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>✅</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--neutral-0)', marginBottom: '8px' }}>
            Ticket Submitted Successfully
          </h2>
          <p style={{ color: 'var(--neutral-4)', marginBottom: '24px', fontSize: '14px' }}>
            Our AI support team is already reviewing your request. You'll receive updates at{' '}
            <strong style={{ color: 'var(--neutral-0)' }}>{submitted.customer_email}</strong>.
          </p>
          <div className="card" style={{ textAlign: 'left', marginBottom: '20px' }}>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                {[
                  ['Reference', submitted.ticket_ref],
                  ['Category', submitted.category],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--neutral-4)', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontWeight: 600, color: 'var(--neutral-0)' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button id="portal-submit-another" className="btn btn-primary" onClick={() => setSubmitted(null)}>
            Submit Another Ticket
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gradient-hero)', padding: '40px 24px' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', background: 'var(--pink)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, color: '#fff', margin: '0 auto 12px', boxShadow: '0 8px 24px rgba(207,0,139,.3)' }}>C</div>
          <div style={{ fontWeight: 800, fontSize: '20px', color: 'var(--neutral-0)' }}>centific aegis.ai</div>
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '24px' }}>
            <button id="portal-mode-submit" className={`btn ${mode === 'submit' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setMode('submit'); setError(''); setStatusResult(null); }}>
              Submit Ticket
            </button>
            <button id="portal-mode-status" className={`btn ${mode === 'status' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setMode('status'); setError(''); }}>
              Check Status
            </button>
          </div>
          
          {mode === 'submit' && (
            <>
              <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--neutral-0)', marginTop: '20px', marginBottom: '6px' }}>
                How can we <span style={{ color: 'var(--pink)' }}>help you?</span>
              </h1>
              <p style={{ color: 'var(--neutral-4)', fontSize: '14px' }}>
                Submit a support ticket and our AI-powered team will respond based on priority SLA.
              </p>
            </>
          )}
        </div>

        {/* Form */}
        <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {/* Banner */}
          <div style={{ background: 'var(--gradient-banner)', padding: '14px 24px', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
              {mode === 'submit' ? '🎫 New Support Request' : '🔍 Check Ticket Status'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.75)' }}>
              {mode === 'submit' ? 'All fields marked * are required' : 'Enter your email and ticket reference ID'}
            </div>
          </div>

          <div className="card-body">
            {mode === 'submit' ? (
              <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="customer_name">Full Name *</label>
                  <input id="customer_name" name="customer_name" className="form-input" value={form.customer_name} onChange={handleChange} placeholder="Jane Smith" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="customer_email">Email Address *</label>
                  <input id="customer_email" name="customer_email" type="email" className="form-input" value={form.customer_email} onChange={handleChange} placeholder="jane@company.com" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="subject">Subject *</label>
                  <input id="subject" name="subject" className="form-input" value={form.subject} onChange={handleChange} placeholder="Brief description of your issue" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="category">Category</label>
                  <select id="category" name="category" className="form-select" value={form.category} onChange={handleChange}>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="description">Description *</label>
                <textarea id="description" name="description" className="form-textarea" value={form.description} onChange={handleChange} placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, or relevant context." required style={{ minHeight: '140px' }} />
              </div>

              {/* AI Disclosure — mandatory */}
              <div style={{ background: 'var(--primary-light)', border: '1.5px solid var(--primary-border)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
                <label className="form-checkbox" htmlFor="ai_disclosure">
                  <input
                    id="ai_disclosure"
                    type="checkbox"
                    name="ai_disclosure_accepted"
                    checked={form.ai_disclosure_accepted}
                    onChange={handleChange}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>
                      🤖 AI Assistance Disclosure *
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--neutral-3)', lineHeight: '1.6' }}>
                      I understand and consent that this ticket will be processed by an AI-powered support system. AI agents will analyze, prioritize, and assist in resolving my request. Sensitive information will be automatically redacted. A human agent may review escalated issues.
                    </div>
                  </div>
                </label>
              </div>

              {error && (
                <div style={{ background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', color: 'var(--error)', marginBottom: '16px' }}>
                  ⚠️ {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button id="portal-form-clear" type="button" className="btn btn-ghost" onClick={() => setForm({ customer_name: '', customer_email: '', subject: '', description: '', category: 'General', ai_disclosure_accepted: false })}>
                  Clear
                </button>
                <button id="portal-submit" type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Submitting…' : '🚀 Submit Ticket'}
                </button>
              </div>
            </form>
            ) : (
            <form onSubmit={handleStatusSubmit}>
              <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="status_email">Email Address *</label>
                  <input id="status_email" type="email" className="form-input" value={statusForm.customer_email} onChange={e => setStatusForm(s => ({...s, customer_email: e.target.value}))} placeholder="jane@company.com" required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="ticket_ref">Ticket Reference ID *</label>
                  <input id="ticket_ref" className="form-input" value={statusForm.ticket_ref} onChange={e => setStatusForm(s => ({...s, ticket_ref: e.target.value}))} placeholder="TKT-XXXXXXX" required />
                </div>
              </div>
              
              {error && (
                <div style={{ background: 'var(--error-light)', border: '1px solid var(--error)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', color: 'var(--error)', marginBottom: '16px' }}>
                  ⚠️ {error}
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button id="portal-check-status" type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Checking…' : '🔍 Check Status'}
                </button>
              </div>
              
              {statusResult && (
                <div style={{ marginTop: '24px', padding: '16px', border: '1px solid var(--primary-border)', borderRadius: 'var(--radius-md)', background: 'var(--primary-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--neutral-0)' }}>{statusResult.ticket_ref}</div>
                    <span className="badge badge-primary">{statusResult.status.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--neutral-2)', marginBottom: '8px' }}>
                    <strong>Subject:</strong> {statusResult.subject}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--neutral-2)' }}>
                    <strong>Priority:</strong> {statusResult.priority}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--neutral-2)', marginTop: '8px' }}>
                    <strong>Created:</strong> {new Date(statusResult.created_at).toLocaleString()}
                  </div>
                </div>
              )}
            </form>
            )}
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--neutral-5)', marginTop: '20px' }}>
          SLA: P1 ≤15 min · P2 ≤1 hr · P3 ≤4 hr · P4 ≤1 business day
        </p>
      </div>
    </div>
  )
}
