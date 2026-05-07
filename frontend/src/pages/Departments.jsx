import { useState, useEffect } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import api from '../api/index'

export default function Departments() {
  const [departments, setDepartments] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', code: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/departments').then(({ data }) => setDepartments(data)).catch(() => {})
  }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', code: '' })
    setError('')
    setModalOpen(true)
  }

  const openEdit = (dept) => {
    setEditing(dept)
    setForm({ name: dept.name, code: dept.code })
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError('')
    try {
      if (editing) {
        const { data } = await api.put(`/departments/${editing._id}`, form)
        setDepartments((d) => d.map((dep) => (dep._id === data._id ? data : dep)))
      } else {
        const { data } = await api.post('/departments', form)
        setDepartments((d) => [...d, data].sort((a, b) => a.name.localeCompare(b.name)))
      }
      setModalOpen(false)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (dept) => {
    try {
      const { data } = await api.patch(`/departments/${dept._id}/toggle`)
      setDepartments((d) => d.map((dep) => (dep._id === data._id ? data : dep)))
    } catch {}
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">{departments.filter((d) => d.isActive).length} active departments</p>
        <Button
          variant="primary"
          size="sm"
          onClick={openAdd}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add Department
        </Button>
      </div>

      <div className="bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {['Name', 'Code', 'Status', 'Actions'].map((col) => (
                <th key={col} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {departments.map((dept) => (
              <tr key={dept._id} className="hover:bg-surface-bg transition-colors">
                <td className="px-5 py-3.5 font-medium text-slate-900">{dept.name}</td>
                <td className="px-5 py-3.5">
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{dept.code}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                    dept.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dept.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {dept.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(dept)}>Edit</Button>
                    <Button
                      variant={dept.isActive ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggle(dept)}
                    >
                      {dept.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Department' : 'Add Department'}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            name="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Finance"
          />
          <Input
            label="Code"
            name="code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="e.g. FIN"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleSubmit} loading={saving}>
              {editing ? 'Save Changes' : 'Add Department'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
