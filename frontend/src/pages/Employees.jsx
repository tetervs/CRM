import { useState, useEffect } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import useAuthStore from '../store/authStore'
import api from '../api/index'

const WORKER_ROLES = ['sales', 'employee']

const ROLE_STYLES = {
  sales:    'bg-sky-100 text-sky-700',
  employee: 'bg-slate-100 text-slate-600',
}

const ROLE_OPTIONS_BASE  = ['employee', 'sales']
const ROLE_OPTIONS_ADMIN = ['employee', 'sales', 'manager']

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Employees() {
  const { user } = useAuthStore()
  const [employees, setEmployees] = useState([])
  const [editTarget, setEditTarget] = useState(null)
  const [newRole, setNewRole] = useState('')
  const [saving, setSaving] = useState(false)

  const isPrivileged = ['finance_head', 'admin'].includes(user?.role)
  const isAdmin      = user?.role === 'admin'
  const roleOptions  = isAdmin ? ROLE_OPTIONS_ADMIN : ROLE_OPTIONS_BASE

  useEffect(() => {
    api.get('/users').then(({ data }) => {
      setEmployees(data.filter((u) => WORKER_ROLES.includes(u.role)))
    }).catch(() => {})
  }, [])

  const openEdit = (member) => {
    setEditTarget(member)
    setNewRole(member.role)
  }

  const handleSave = async () => {
    if (!newRole || newRole === editTarget.role) {
      setEditTarget(null)
      return
    }
    setSaving(true)
    try {
      await api.put(`/users/${editTarget._id}/role`, { role: newRole })
      setEmployees((prev) => {
        const updated = prev.map((m) => m._id === editTarget._id ? { ...m, role: newRole } : m)
        return updated.filter((m) => WORKER_ROLES.includes(m.role))
      })
    } catch {}
    setSaving(false)
    setEditTarget(null)
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">{employees.filter((e) => e.isActive).length} active</p>
        </div>
      </div>

      <div className="bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {['Employee', 'Role', 'Department', 'Email', 'Status', ...(isPrivileged ? ['Actions'] : [])].map((col) => (
                <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {employees.map((member) => (
              <tr key={member._id} className="hover:bg-surface-bg transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-sm font-bold flex items-center justify-center shrink-0">
                      {member.name[0]}
                    </div>
                    <p className="font-medium text-slate-900">{member.name}</p>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[member.role] || 'bg-slate-100 text-slate-600'}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-slate-500 text-xs">—</td>
                <td className="px-5 py-3.5 text-slate-500 text-xs">{member.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${member.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${member.isActive ? 'bg-status-won' : 'bg-slate-400'}`} />
                    {member.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isPrivileged && (
                  <td className="px-5 py-3.5">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(member)}>
                      Edit Role
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={isPrivileged ? 6 : 5} className="py-10 text-center text-sm text-slate-400">
                  No employees found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit Role — ${editTarget?.name}`}>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">New Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary"
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {newRole === 'manager' && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
              Promoting to manager will move this user to the Team page.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>Save</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
