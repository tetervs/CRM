import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import useLeadStore from '../store/leadStore'
import useAuthStore from '../store/authStore'
import useProjectStore from '../store/projectStore'
import api from '../api/index'

const STATUSES = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function LeadDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { leads, updateLead, updateLeadStatus } = useLeadStore()
  const { convertLead } = useProjectStore()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const [followUpDate, setFollowUpDate]       = useState('')
  const [savingFollowUp, setSavingFollowUp]   = useState(false)
  const [followUpSaved, setFollowUpSaved]     = useState(false)

  // Convert to Project
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [convertForm, setConvertForm] = useState({ projectHeadId: '', departmentId: '', budget: '' })
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])

  const lead = leads.find((l) => l._id === id)

  useEffect(() => {
    if (lead) {
      setForm({ title: lead.title, contactName: lead.contactName || '', contactEmail: lead.contactEmail || '', contactPhone: lead.contactPhone || '', dealValue: lead.dealValue || 0, notes: lead.notes || '', status: lead.status })
      setFollowUpDate(lead.followUpDate ? lead.followUpDate.slice(0, 10) : '')
    }
  }, [lead])

  const canConvert = ['finance_head', 'admin'].includes(user?.role) && lead?.status === 'Won'

  const openConvertModal = async () => {
    setConvertError('')
    setConvertForm({ projectHeadId: '', departmentId: '', budget: lead?.dealValue || '' })
    try {
      const [managersRes, deptsRes] = await Promise.all([
        users.length === 0 ? api.get('/users?role=manager') : Promise.resolve({ data: users }),
        departments.length === 0 ? api.get('/departments') : Promise.resolve({ data: departments }),
      ])
      if (users.length === 0) setUsers(managersRes.data)
      if (departments.length === 0) setDepartments(deptsRes.data.filter((d) => d.isActive))
    } catch (_) {}
    setShowConvertModal(true)
  }

  const handleConvert = async () => {
    if (!convertForm.projectHeadId) {
      setConvertError('Select a project head.')
      return
    }
    if (!convertForm.departmentId) {
      setConvertError('Select a department.')
      return
    }
    setConverting(true)
    setConvertError('')
    try {
      const project = await convertLead(id, {
        projectHeadId: convertForm.projectHeadId,
        departmentId:  convertForm.departmentId,
        budget:        Number(convertForm.budget) || 0,
      })
      setShowConvertModal(false)
      navigate(`/projects/${project._id}`)
    } catch (err) {
      setConvertError(err.response?.data?.message || 'Failed to convert lead')
      setConverting(false)
    }
  }

  if (!lead) {
    return (
      <PageWrapper>
        <div className="text-center py-20">
          <p className="text-slate-500 text-sm">Lead not found.</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/leads')} className="mt-3">Back to Leads</Button>
        </div>
      </PageWrapper>
    )
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    await updateLead(id, { ...form, dealValue: Number(form.dealValue) || 0 })
    setSaving(false)
    setEditing(false)
  }

  const handleStatusChange = async (e) => {
    await updateLeadStatus(id, e.target.value)
  }

  const handleSaveFollowUp = async () => {
    setSavingFollowUp(true)
    await updateLead(id, { followUpDate: followUpDate || null })
    setSavingFollowUp(false)
    setFollowUpSaved(true)
    setTimeout(() => setFollowUpSaved(false), 2000)
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/leads')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate">{lead.title}</h2>
          <p className="text-sm text-slate-500">{lead.contactName} {lead.contactEmail && `· ${lead.contactEmail}`}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canConvert && (
            <Button variant="secondary" size="sm" onClick={openConvertModal}>Convert to Project</Button>
          )}
          {!editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>Save</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <Card title="Lead Details">
            {editing && form ? (
              <form className="space-y-4" onSubmit={handleSave}>
                <Input label="Lead / Company name" name="title" value={form.title} onChange={handleChange} required />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Contact name" name="contactName" value={form.contactName} onChange={handleChange} />
                  <Input label="Deal value (₹)" name="dealValue" type="number" value={form.dealValue} onChange={handleChange} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Contact email" name="contactEmail" type="email" value={form.contactEmail} onChange={handleChange} />
                  <Input label="Contact phone" name="contactPhone" value={form.contactPhone} onChange={handleChange} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light resize-none" />
                </div>
              </form>
            ) : (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {[
                  ['Contact', lead.contactName || '—'],
                  ['Deal Value', formatCurrency(lead.dealValue)],
                  ['Email', lead.contactEmail || '—'],
                  ['Phone', lead.contactPhone || '—'],
                  ['Owner', lead.owner?.name || '—'],
                  ['Created', formatDate(lead.createdAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
                    <dd className="mt-1 text-sm text-slate-900">{value}</dd>
                  </div>
                ))}
                {lead.notes && (
                  <div className="col-span-2">
                    <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Notes</dt>
                    <dd className="mt-1 text-sm text-slate-700 leading-relaxed">{lead.notes}</dd>
                  </div>
                )}
              </dl>
            )}
          </Card>

          {/* Activity Log */}
          <Card title="Activity Log">
            {lead.activityLog?.length ? (
              <div className="space-y-3">
                {lead.activityLog.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700">{entry.action}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-4">No activity yet</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card title="Status">
            <div className="mb-3">
              <Badge status={lead.status} />
            </div>
            <select
              value={lead.status}
              onChange={handleStatusChange}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Card>

          {lead.tags?.length > 0 && (
            <Card title="Tags">
              <div className="flex flex-wrap gap-1.5">
                {lead.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">{tag}</span>
                ))}
              </div>
            </Card>
          )}

          <Card title="Deal Summary">
            <div className="text-2xl font-bold text-slate-900 mb-1">{formatCurrency(lead.dealValue)}</div>
            <p className="text-xs text-slate-500">Potential deal value</p>
          </Card>

          {lead.status !== 'Won' && lead.status !== 'Lost' && (
            <Card title="Follow-up Date">
              <div className="space-y-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveFollowUp} loading={savingFollowUp} disabled={followUpDate === (lead.followUpDate ? lead.followUpDate.slice(0, 10) : '')}>
                    Save
                  </Button>
                  {followUpDate && (
                    <button
                      type="button"
                      onClick={() => setFollowUpDate('')}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  {followUpSaved && <span className="text-xs text-emerald-600">Saved</span>}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Convert to Project Modal */}
      <Modal isOpen={showConvertModal} onClose={() => setShowConvertModal(false)} title="Convert to Project">
        <div className="space-y-4">
          {convertError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{convertError}</div>
          )}
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide block mb-1">Project Head</label>
              <select
                value={convertForm.projectHeadId}
                onChange={(e) => setConvertForm((f) => ({ ...f, projectHeadId: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary"
              >
                <option value="">Select a manager</option>
                {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide block mb-1">Department</label>
              <select
                value={convertForm.departmentId}
                onChange={(e) => setConvertForm((f) => ({ ...f, departmentId: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary"
              >
                <option value="">Select a department</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name} ({d.code})</option>)}
              </select>
            </div>

            <Input
              label="Budget (₹)"
              type="number"
              value={convertForm.budget}
              onChange={(e) => setConvertForm((f) => ({ ...f, budget: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={() => setShowConvertModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={converting} onClick={handleConvert}>Create Project</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  )
}
