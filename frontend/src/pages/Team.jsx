import { useState, useEffect } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { UserPerformanceDrawer } from '../components/shared/UserPerformanceDrawer'
import useAuthStore from '../store/authStore'
import useLeadStore from '../store/leadStore'
import api from '../api/index'

const MGMT_ROLES = ['finance_head', 'admin', 'manager']

const ROLE_STYLES = {
  finance_head: 'bg-emerald-100 text-emerald-700',
  admin:        'bg-violet-100 text-violet-700',
  manager:      'bg-blue-100 text-blue-700',
}

const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Team() {
  const { user } = useAuthStore()
  const { leads } = useLeadStore()
  const [team, setTeam] = useState([])
  const [analyseUserId, setAnalyseUserId] = useState(null)

  const isAdmin     = user?.role === 'admin'
  const isPrivileged = ['finance_head', 'admin'].includes(user?.role)

  useEffect(() => {
    api.get('/users').then(({ data }) => {
      setTeam(data.filter((m) => MGMT_ROLES.includes(m.role)))
    }).catch(() => {})
  }, [])

  const leadsFor = (userId) => leads.filter((l) => l.owner?._id === userId).length

  const handleRoleChange = async (id, role) => {
    await api.put(`/users/${id}/role`, { role })
    setTeam((t) => t.map((m) => (m._id === id ? { ...m, role } : m)))
  }

  const handleToggleActive = async (id) => {
    await api.delete(`/users/${id}`)
    setTeam((t) => t.map((m) => (m._id === id ? { ...m, isActive: !m.isActive } : m)))
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">{team.filter((m) => m.isActive).length} active managers &amp; admins</p>
        </div>
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
            {team.map((member) => (
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
                  {isAdmin && member.role !== 'finance_head' ? (
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
                      {member.role.replace('_', ' ')}
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
                      {isAdmin && member.role !== 'finance_head' && (
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
    </PageWrapper>
  )
}
