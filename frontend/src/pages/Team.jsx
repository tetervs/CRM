import { useState, useEffect, Fragment } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { UserPerformanceDrawer } from '../components/shared/UserPerformanceDrawer'
import { AddUserModal } from '../components/shared/AddUserModal'
import useAuthStore from '../store/authStore'
import useLeadStore from '../store/leadStore'
import api from '../api/index'

const MGMT_ROLES = ['head', 'admin', 'manager', 'ca']
const SPECIAL_ROLES = ['head', 'ca'] // externally-managed accounts — not editable from the quick-edit controls below

const SECTIONS = [
  { role: 'head',    label: 'Head' },
  { role: 'admin',   label: 'Admin' },
  { role: 'manager', label: 'Manager' },
  { role: 'ca',      label: 'CA' },
]

const ROLE_STYLES = {
  head:    'bg-emerald-100 text-emerald-700',
  admin:   'bg-violet-100 text-violet-700',
  manager: 'bg-blue-100 text-blue-700',
  ca:      'bg-amber-100 text-amber-700',
}

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Team() {
  const { user } = useAuthStore()
  const { leads } = useLeadStore()
  const [team, setTeam] = useState([])
  const [analyseUserId, setAnalyseUserId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [managerEditTarget, setManagerEditTarget] = useState(null)
  const [newManagerId, setNewManagerId] = useState('')
  const [managerOptions, setManagerOptions] = useState([])
  const [savingManager, setSavingManager] = useState(false)

  const isAdmin     = user?.role === 'admin'
  const isPrivileged = ['head', 'admin'].includes(user?.role)

  const loadTeam = () => {
    api.get('/users').then(({ data }) => {
      setTeam(data.filter((m) => MGMT_ROLES.includes(m.role)))
    }).catch(() => {})
  }

  useEffect(() => { loadTeam() }, [])

  const leadsFor = (userId) => leads.filter((l) => l.owner?._id === userId).length

  const handleRoleChange = async (id, role) => {
    await api.put(`/users/${id}/role`, { role })
    setTeam((t) => t.map((m) => (m._id === id ? { ...m, role } : m)))
  }

  const handleToggleActive = async (id) => {
    await api.delete(`/users/${id}`)
    setTeam((t) => t.map((m) => (m._id === id ? { ...m, isActive: !m.isActive } : m)))
  }

  const openManagerEdit = (member) => {
    setManagerEditTarget(member)
    setNewManagerId(member.manager?._id || '')
    setManagerOptions([])
    api.get('/users/managers').then(({ data }) => setManagerOptions(data)).catch(() => {})
  }

  const handleSaveManager = async () => {
    if (!newManagerId) { setManagerEditTarget(null); return }
    setSavingManager(true)
    try {
      const { data } = await api.put(`/users/${managerEditTarget._id}/role`, {
        role: managerEditTarget.role,
        manager: newManagerId,
      })
      setTeam((t) => t.map((m) => (m._id === managerEditTarget._id ? data : m)))
    } catch {}
    setSavingManager(false)
    setManagerEditTarget(null)
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">{team.filter((m) => m.isActive).length} active team members</p>
        </div>
        {isPrivileged && (
          <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>+ Add User</Button>
        )}
      </div>

      <div className="bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {['Member', 'Role', 'Leads', 'Status', 'Joined', ...(isPrivileged ? ['Actions'] : [])].map((col) => (
                <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {SECTIONS.map(({ role, label }) => {
              const members = team.filter((m) => m.role === role)
              if (members.length === 0) return null
              return (
                <Fragment key={role}>
                  <tr className="bg-surface-bg">
                    <td colSpan={isPrivileged ? 6 : 5} className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {label}
                    </td>
                  </tr>
                  {members.map((member) => (
                    <tr key={member._id} className="hover:bg-surface-bg transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-light text-brand-primary text-sm font-bold flex items-center justify-center shrink-0">
                            {member.name[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{member.name}</p>
                            <p className="text-xs text-slate-400">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {isAdmin && !SPECIAL_ROLES.includes(member.role) ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member._id, e.target.value)}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 focus:outline-none focus:ring-1 focus:ring-brand-primary cursor-pointer ${ROLE_STYLES[member.role] || 'bg-slate-100 text-slate-600'}`}
                          >
                            <option value="manager">manager</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_STYLES[member.role] || 'bg-slate-100 text-slate-600'}`}>
                            {member.role}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 font-medium">{leadsFor(member._id)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${member.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${member.isActive ? 'bg-status-won' : 'bg-slate-400'}`} />
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatDate(member.createdAt)}</td>
                      {isPrivileged && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setAnalyseUserId(member._id)}>
                              Analyse
                            </Button>
                            {isAdmin && member.role === 'manager' && (
                              <Button variant="ghost" size="sm" onClick={() => openManagerEdit(member)}>
                                Reports To
                              </Button>
                            )}
                            {isAdmin && !SPECIAL_ROLES.includes(member.role) && (
                              <Button
                                variant={member.isActive ? 'danger' : 'secondary'}
                                size="sm"
                                onClick={() => handleToggleActive(member._id)}
                              >
                                {member.isActive ? 'Deactivate' : 'Reactivate'}
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
            {team.length === 0 && (
              <tr>
                <td colSpan={isPrivileged ? 6 : 5} className="py-10 text-center text-sm text-slate-400">
                  No management users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UserPerformanceDrawer
        userId={analyseUserId}
        onClose={() => setAnalyseUserId(null)}
      />

      <Modal isOpen={!!managerEditTarget} onClose={() => setManagerEditTarget(null)} title={`Reports To — ${managerEditTarget?.name}`}>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Manager (head or admin)</label>
            <select
              value={newManagerId}
              onChange={(e) => setNewManagerId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary"
            >
              <option value="">Select…</option>
              {managerOptions.filter((m) => m.role !== 'manager').map((m) => (
                <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setManagerEditTarget(null)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={savingManager} onClick={handleSaveManager}>Save</Button>
          </div>
        </div>
      </Modal>

      <AddUserModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={loadTeam}
        defaultRole="manager"
      />
    </PageWrapper>
  )
}
