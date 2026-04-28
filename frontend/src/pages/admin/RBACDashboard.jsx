import { useEffect, useState } from 'react'
import client from '../../api/client'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { StatusDot } from '../../components/ui/StatusDot'

export default function RBACDashboard() {
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'addUser' | 'addRole'
  const [userForm, setUserForm] = useState({ full_name: '', email: '', password: '', role_id: '' })
  const [roleForm, setRoleForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [r, u] = await Promise.all([client.get('/roles'), client.get('/users')])
      setRoles(r.data)
      setUsers(u.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [])

  const handleAddUser = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      await client.post('/users', { ...userForm, role_id: userForm.role_id ? parseInt(userForm.role_id) : null })
      setModal(null)
      setUserForm({ full_name: '', email: '', password: '', role_id: '' })
      fetchAll()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to create user') }
    finally { setSaving(false) }
  }

  const handleAddRole = async (e) => {
    e.preventDefault(); setError(''); setSaving(true)
    try {
      await client.post('/roles', roleForm)
      setModal(null)
      setRoleForm({ name: '', description: '' })
      fetchAll()
    } catch (err) { setError(err.response?.data?.detail || 'Failed to create role') }
    finally { setSaving(false) }
  }

  const handleDeleteUser = async (id) => {
    if (!confirm('Delete this user?')) return
    await client.delete(`/users/${id}`)
    fetchAll()
  }

  const handleToggleActive = async (user) => {
    await client.patch(`/users/${user.id}`, { is_active: !user.is_active })
    fetchAll()
  }

  return (
    <div>
      <div className="page-banner" style={{ marginBottom: '24px', borderRadius: 'var(--radius-md)' }}>
        <h1>RBAC Dashboard</h1>
        <p>Manage roles and user assignments. Any role can have multiple team members for shift scaling.</p>
      </div>

      {/* Roles */}
      <Card 
        title={`👥 Roles (${roles.length})`} 
        headerAction={
          <Button size="sm" onClick={() => { setModal('addRole'); setError('') }}>
            + Add Role
          </Button>
        }
        className="mb-6"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {loading ? <span style={{ color: 'var(--neutral-4)', fontSize: '13px' }}>Loading…</span> :
            roles.map((role) => (
              <div key={role.id} style={{
                background: '#fff',
                border: '1px solid var(--neutral-7)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                minWidth: '180px',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--neutral-0)', marginBottom: '4px' }}>{role.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--neutral-4)', marginBottom: '8px' }}>{role.description || 'No description'}</div>
                <div style={{ fontSize: '11px', color: 'var(--neutral-5)' }}>
                  {users.filter(u => u.role?.id === role.id).length} member(s)
                </div>
              </div>
            ))
          }
        </div>
      </Card>

      {/* Users Table */}
      <Card
        title={`🧑‍💼 Users (${users.length})`}
        headerAction={
          <Button size="sm" onClick={() => { setModal('addUser'); setError('') }}>
            + Add User
          </Button>
        }
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--neutral-4)' }}>Loading users…</td></tr>
              ) : users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                  <td style={{ fontSize: '13px', color: 'var(--neutral-3)' }}>{u.email}</td>
                  <td>
                    {u.role
                      ? <Badge variant="primary">{u.role.name}</Badge>
                      : <Badge variant="neutral">Unassigned</Badge>}
                  </td>
                  <td>
                    <StatusDot status={u.is_active ? 'active' : 'inactive'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </StatusDot>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--neutral-5)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteUser(u.id)}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add User Modal */}
      <Modal 
        isOpen={modal === 'addUser'} 
        onClose={() => setModal(null)} 
        title="Add New User"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={handleAddUser} disabled={saving}>{saving ? 'Creating…' : 'Create User'}</Button>
          </>
        }
      >
        <form onSubmit={handleAddUser}>
          {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" value={userForm.full_name} onChange={e => setUserForm(p => ({ ...p, full_name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={userForm.email} onChange={e => setUserForm(p => ({ ...p, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={userForm.password} onChange={e => setUserForm(p => ({ ...p, password: e.target.value }))} required minLength={8} />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={userForm.role_id} onChange={e => setUserForm(p => ({ ...p, role_id: e.target.value }))}>
              <option value="">— Select Role —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </form>
      </Modal>

      {/* Add Role Modal */}
      <Modal 
        isOpen={modal === 'addRole'} 
        onClose={() => setModal(null)} 
        title="Add New Role"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={handleAddRole} disabled={saving}>{saving ? 'Creating…' : 'Create Role'}</Button>
          </>
        }
      >
        <form onSubmit={handleAddRole}>
          {error && <div style={{ background: 'var(--error-light)', color: 'var(--error)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Role Name</label>
            <input className="form-input" value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
