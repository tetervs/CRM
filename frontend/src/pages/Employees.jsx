import { useState, useEffect, Fragment } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { AddUserModal } from '../components/shared/AddUserModal'
import { UserActions } from '../components/shared/UserActions'
import useAuthStore from '../store/authStore'
import api from '../api/index'

const WORKER_ROLES = ['sales', 'employee']

const ROLE_STYLES = {
  sales:    'bg-sky-100 text-sky-700',
  employee: 'bg-slate-100 text-slate-600',
}

export default function Employees() {
  const { user } = useAuthStore()
  const [employees, setEmployees] = useState([])
  const [showInactive, setShowInactive] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const isPrivileged = ['head', 'admin'].includes(user?.role)

  const loadEmployees = () => {
    api.get('/users').then(({ data }) => {
      setEmployees(data.filter((u) => WORKER_ROLES.includes(u.role)))
    }).catch(() => {})
  }

  const groups = employees.filter((m) => showInactive || m.isActive).reduce((acc, member) => {
    const dept = member.department?.name || 'Unassigned'
    ;(acc[dept] ??= []).push(member)
    return acc
  }, {})
  const departmentNames = Object.keys(groups).sort((a, b) => a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b))

  useEffect(() => { loadEmployees() }, [])

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-0.5">{employees.filter((e) => e.isActive).length} active</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show deactivated
          </label>
          {isPrivileged && (
            <Button variant="primary" size="md" onClick={() => setShowAdd(true)}>+ Add User</Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {['Employee', 'Role', 'Designation', 'Email', 'Status', ...(isPrivileged ? ['Actions'] : [])].map((col) => (
                <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {departmentNames.map((dept) => (
              <Fragment key={dept}>
                <tr className="bg-surface-bg">
                  <td colSpan={isPrivileged ? 6 : 5} className="px-5 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {dept}
                  </td>
                </tr>
                {groups[dept].map((member) => (
                  <tr key={member._id} className={`hover:bg-surface-bg transition-colors ${member.isActive ? '' : 'opacity-50'}`}>
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
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{member.designation || '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">{member.email}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${member.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${member.isActive ? 'bg-status-won' : 'bg-slate-400'}`} />
                        {member.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isPrivileged && (
                      <td className="px-5 py-3.5">
                        <UserActions member={member} onChanged={loadEmployees} />
                      </td>
                    )}
                  </tr>
                ))}
              </Fragment>
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

      <AddUserModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={loadEmployees}
        defaultRole="employee"
      />
    </PageWrapper>
  )
}
