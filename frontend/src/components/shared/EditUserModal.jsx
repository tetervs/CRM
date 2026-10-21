import { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import useAuthStore from '../../store/authStore'
import api from '../../api/index'

const ROLES = ['head', 'admin', 'manager', 'sales', 'employee', 'ca']
const selectCls = 'w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-900 focus:outline-none focus:border-brand-primary disabled:bg-slate-50 disabled:text-slate-400'

function Select({ label, children, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</label>
      <select className={selectCls} {...props}>{children}</select>
    </div>
  )
}

// Head/admin edit modal for a user. onSaved receives the updated user.
export function EditUserModal({ user: target, onClose, onSaved }) {
  const me = useAuthStore((s) => s.user)
  const [form, setForm] = useState(null)
  const [departments, setDepartments] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const isSelf = target && target._id === me?._id
  const canAssignHead = me?.role === 'head'

  useEffect(() => {
    if (!target) return
    setError('')
    setTempPassword('')
    setForm(null)
    // GET /users/:id (head/admin only) is the route that returns fisRole.
    api.get(`/users/${target._id}`).then(({ data }) => setForm({
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department?._id || '',
      isActive: data.isActive ? 'active' : 'inactive',
      fisRole: data.fisRole || '',
    })).catch(() => setError('Could not load user.'))
    api.get('/departments').then(({ data }) => setDepartments(data.filter((d) => d.isActive !== false))).catch(() => {})
  }, [target])

  const set = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setError('') }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, isActive: form.isActive === 'active', fisRole: form.fisRole || null }
      if (!payload.department) delete payload.department
      const { data } = await api.patch(`/users/${target._id}`, payload)
      onSaved?.(data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.message || err.response?.data?.message || 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    setError('')
    try {
      const { data } = await api.post(`/users/${target._id}/reset-password`)
      setTempPassword(data.tempPassword)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <Modal isOpen={!!target} onClose={onClose} title={`Edit — ${target?.name || ''}`}>
      {!form ? (
        <p className="text-sm text-slate-400">{error || 'Loading…'}</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Input label="Full name" name="name" value={form.name} onChange={set} required />
          <Input label="Email" name="email" type="email" value={form.email} onChange={set} required />

          <div className="grid grid-cols-2 gap-4">
            <Select label="Role" name="role" value={form.role} onChange={set} disabled={isSelf}>
              {ROLES.filter((r) => canAssignHead || r !== 'head' || form.role === 'head').map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
            <Select label="Status" name="isActive" value={form.isActive} onChange={set} disabled={isSelf}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          <Select label="Department" name="department" value={form.department} onChange={set}>
            <option value="">No department</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </Select>

          <Select label="FIS access" name="fisRole" value={form.fisRole} onChange={set} disabled={isSelf}>
            <option value="">None</option>
            <option value="fis_member">FIS member</option>
            <option value="fis_admin">FIS admin</option>
          </Select>
          {isSelf && <p className="text-xs text-slate-400 -mt-2">You can't change your own role, status or FIS access.</p>}

          <div className="border-t border-surface-border pt-4">
            {tempPassword ? (
              <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md space-y-1">
                <p className="text-xs text-amber-700">Temporary password — shown once. Share it directly; they must change it at next login.</p>
                <p className="font-mono text-sm text-slate-900 select-all">{tempPassword}</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Generate a one-time temporary password.</p>
                <Button type="button" variant="secondary" size="sm" loading={resetting} onClick={handleReset}>Reset password</Button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>Save changes</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
