import { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import api from '../../api/index'

const MANAGER_REQUIRED_ROLES = ['employee', 'sales']
const CREATE_ROLE_OPTIONS = ['employee', 'sales', 'manager', 'admin']

const blankForm = (role) => ({ name: '', email: '', role, department: '', manager: '' })

// Admin/finance_head user-creation modal. Reused by the Employees and Team pages.
// onCreated fires after a successful create so the parent can refresh its list.
export function AddUserModal({ isOpen, onClose, onCreated, defaultRole = 'employee' }) {
  const [form, setForm] = useState(blankForm(defaultRole))
  const [departments, setDepartments] = useState([])
  const [managers, setManagers] = useState([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null) // { user, tempPassword, warning }
  const [copied, setCopied] = useState(false)

  const managerShown    = form.role !== 'admin'
  const managerRequired = MANAGER_REQUIRED_ROLES.includes(form.role)

  // Reset everything each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setForm(blankForm(defaultRole))
      setError('')
      setCreated(null)
      setCopied(false)
      setManagers([])
    }
  }, [isOpen, defaultRole])

  // Load departments once.
  useEffect(() => {
    if (isOpen && departments.length === 0) {
      api.get('/departments').then(({ data }) => {
        setDepartments(data.filter((d) => d.isActive !== false))
      }).catch(() => {})
    }
  }, [isOpen, departments.length])

  // Reload manager options whenever the chosen department changes.
  useEffect(() => {
    if (!isOpen || !form.department) {
      setManagers([])
      return
    }
    api.get('/users/managers', { params: { department: form.department } })
      .then(({ data }) => setManagers(data))
      .catch(() => setManagers([]))
  }, [isOpen, form.department])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => {
      const next = { ...f, [name]: value }
      if (name === 'department') next.manager = ''
      if (name === 'role' && value === 'admin') next.manager = ''
      return next
    })
    setError('')
  }

  const resetForAnother = () => {
    setForm(blankForm(defaultRole))
    setError('')
    setCreated(null)
    setCopied(false)
    setManagers([])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim())  return setError('Name is required.')
    if (!form.email.trim()) return setError('Email is required.')
    if (!form.department)   return setError('Department is required.')
    if (managerRequired && !form.manager) return setError(`A manager is required for the ${form.role} role.`)

    setCreating(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        department: form.department,
      }
      if (managerShown && form.manager) payload.manager = form.manager

      const { data } = await api.post('/users', payload)
      setCreated(data)
      onCreated?.(data.user)
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || err.message
      setError(msg || 'Could not create user. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const copyTemp = async () => {
    try {
      await navigator.clipboard.writeText(created.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={created ? 'User created' : 'Add User'}>
      {created ? (
        <div className="space-y-4">
          <div className="px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-md">
            <p className="text-sm text-emerald-700">
              Account created for <strong>{created.user.name}</strong> ({created.user.email}).
            </p>
          </div>

          {created.warning && (
            <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm text-amber-700">{created.warning}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Temporary password</label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 px-3 py-2 text-sm font-mono bg-slate-100 border border-surface-border rounded-md text-slate-900 select-all">
                {created.tempPassword}
              </code>
              <Button variant="secondary" size="sm" onClick={copyTemp}>
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Share this with the user securely. It won't be shown again. They must change it on first login.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={resetForAnother}>Add another</Button>
            <Button variant="primary" size="sm" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Input label="Full name" name="name" placeholder="Jane Smith" value={form.name} onChange={handleChange} required />
          <Input label="Email" name="email" type="email" placeholder="jane@company.com" value={form.email} onChange={handleChange} required />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-900 focus:outline-none focus:border-brand-primary"
            >
              {CREATE_ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Department</label>
            <select
              name="department"
              value={form.department}
              onChange={handleChange}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-900 focus:outline-none focus:border-brand-primary"
              required
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>

          {managerShown && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Manager {managerRequired ? '' : '(optional)'}
              </label>
              <select
                name="manager"
                value={form.manager}
                onChange={handleChange}
                disabled={!form.department}
                className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-900 focus:outline-none focus:border-brand-primary disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{form.department ? 'Select manager…' : 'Select a department first'}</option>
                {managers.map((m) => (
                  <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
                ))}
              </select>
              {form.department && managers.length === 0 && (
                <p className="text-xs text-slate-400">No managers found in this department.</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={creating}>Create user</Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
