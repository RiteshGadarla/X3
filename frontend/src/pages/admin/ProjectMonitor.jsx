import { useState, useEffect } from 'react'
import client from '../../api/client'

export default function ProjectMonitor() {
  const [stats, setStats] = useState({ total: 0, unassigned: 0, resolved: 0 })
  const [file, setFile] = useState(null)
  const [docType, setDocType] = useState('kb')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const { data } = await client.get('/tickets', { params: { page_size: 100 } })
      const unassigned = data.items.filter(t => t.priority === 'UNASSIGNED').length
      const resolved = data.items.filter(t => t.status === 'resolved').length
      setStats({ total: data.total, unassigned, resolved })
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setMessage('')
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      // Pass doc_type as query param
      const { data } = await client.post(`/documents/upload?doc_type=${docType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setMessage(`✅ ${data.message} (Extracted ${data.extracted_length} characters)`)
      setFile(null)
    } catch (err) {
      setMessage(`❌ Upload failed: ${err.response?.data?.detail || err.message}`)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="page-banner" style={{ marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
        <h1>Project Monitor & Knowledge Base</h1>
        <p>Monitor project health and ingest KB/SLA documents for the AI agents.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="card-body">
            <div style={{ fontSize: '13px', color: 'var(--neutral-4)', fontWeight: 600 }}>TOTAL TICKETS</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--neutral-0)' }}>{stats.total}</div>
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="card-body">
            <div style={{ fontSize: '13px', color: 'var(--neutral-4)', fontWeight: 600 }}>UNASSIGNED PRIORITY</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--warning)' }}>{stats.unassigned}</div>
          </div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="card-body">
            <div style={{ fontSize: '13px', color: 'var(--neutral-4)', fontWeight: 600 }}>RESOLVED TICKETS</div>
            <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--success)' }}>{stats.resolved}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--neutral-0)' }}>Document Ingestion</h3>
            <div style={{ fontSize: '12px', color: 'var(--neutral-4)', marginTop: '4px' }}>
              Upload PDF or TXT files to be embedded into the Qdrant Vector Database.
            </div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={handleUpload}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Document Type</label>
                <select className="form-select" value={docType} onChange={e => setDocType(e.target.value)}>
                  <option value="kb">Knowledge Base Article</option>
                  <option value="sla">SLA Master Document</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">File (.pdf, .txt)</label>
                <input 
                  type="file" 
                  className="form-input" 
                  accept=".pdf,.txt"
                  onChange={e => setFile(e.target.files[0])}
                  required
                />
              </div>
            </div>

            {message && (
              <div style={{ 
                padding: '12px 16px', 
                marginBottom: '16px', 
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                background: message.startsWith('✅') ? 'var(--success-light)' : 'var(--error-light)',
                color: message.startsWith('✅') ? 'var(--success)' : 'var(--error)',
                border: `1px solid ${message.startsWith('✅') ? 'var(--success)' : 'var(--error)'}`
              }}>
                {message}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={uploading || !file}>
                {uploading ? '⏳ Uploading & Embedding...' : '📤 Upload to Qdrant'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
