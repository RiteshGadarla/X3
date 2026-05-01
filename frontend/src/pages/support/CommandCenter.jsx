import { useState } from 'react'
import client from '../../api/client'

export default function CommandCenter() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const presets = [
    { label: '🔴 Show Angry', cmd: { action: 'filter_tickets', params: { sentiment: 'angry' } } },
    { label: '🔥 P1 Critical', cmd: { action: 'filter_tickets', params: { priority: 'P1' } } },
    { label: '📊 Get Stats', cmd: { action: 'get_stats', params: {} } },
    { label: '🏗️ SRE Tickets', cmd: { action: 'filter_tickets', params: { routing_target: 'SRE-Team' } } },
  ]

  const execute = async (cmd) => {
    setLoading(true)
    try {
      const { data } = await client.post('/actions/execute', cmd)
      setResults(prev => [{ ts: new Date().toLocaleTimeString(), cmd: cmd.action, data, success: data.success }, ...prev.slice(0, 19)])
    } catch (e) {
      setResults(prev => [{ ts: new Date().toLocaleTimeString(), cmd: cmd.action, data: { error: e.message }, success: false }, ...prev.slice(0, 19)])
    }
    finally { setLoading(false) }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    try {
      const parsed = JSON.parse(input)
      execute(parsed)
      setInput('')
    } catch {
      setResults(prev => [{ ts: new Date().toLocaleTimeString(), cmd: 'parse_error', data: { error: 'Invalid JSON. Use format: {"action": "filter_tickets", "params": {"status": "angry"}}' }, success: false }, ...prev])
    }
  }

  return (
    <div>
      <div className="page-banner" style={{ marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
        <h1>Command Center</h1>
        <p>Execute JSON action commands. This interface will be replaced by voice-controlled avatar in a future phase.</p>
      </div>

      {/* Presets */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">⚡ Quick Commands</span>
          <span className="badge badge-primary">API Ready</span>
        </div>
        <div className="card-body" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {presets.map((p, i) => (
            <button key={p.label} id={`cmd-preset-${i}`} className="btn btn-secondary btn-sm" disabled={loading} onClick={() => execute(p.cmd)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* JSON Input */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title">🖥️ Command Input</span>
          <span style={{ fontSize: '11px', color: 'var(--neutral-4)' }}>Future: Voice → LLM → JSON → API</span>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              className="form-input"
              style={{ fontFamily: 'var(--font-code)', fontSize: '12px' }}
              placeholder='{"action": "filter_tickets", "params": {"status": "angry"}}'
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button id="cmd-execute" type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '…' : '▶ Execute'}
            </button>
          </form>
        </div>
      </div>

      {/* Results Log */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Results ({results.length})</span>
          {results.length > 0 && <button id="cmd-results-clear" className="btn btn-ghost btn-sm" onClick={() => setResults([])}>Clear</button>}
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--neutral-4)', fontSize: '13px' }}>
              No commands executed yet. Try a quick command above or type JSON.
            </div>
          ) : results.map((r, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--neutral-7)', padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--neutral-5)', fontFamily: 'var(--font-code)' }}>{r.ts}</span>
                <span className={`badge ${r.success ? 'badge-success' : 'badge-error'}`}>{r.success ? 'OK' : 'ERR'}</span>
                <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--primary)' }}>{r.cmd}</span>
              </div>
              <pre style={{
                background: 'var(--neutral-8)', borderRadius: 'var(--radius-sm)', padding: '10px',
                fontSize: '11px', fontFamily: 'var(--font-code)', overflow: 'auto', maxHeight: '200px',
                color: 'var(--neutral-1)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {JSON.stringify(r.data?.result || r.data, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
