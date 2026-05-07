import { useEffect, useState } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { LeadTable } from '../components/shared/LeadTable'
import useLeadStore from '../store/leadStore'

const STATUSES = ['All', 'New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']
const EMPTY_LEAD = { title: '', contactName: '', contactEmail: '', contactPhone: '', dealValue: '', notes: '', status: 'New' }

export default function Leads() {
  const { leads, fetchLeads, createLead, updateLead, deleteLead, updateLeadStatus } = useLeadStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [form, setForm] = useState(EMPTY_LEAD)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const filtered = leads.filter((l) => {
    const matchStatus = statusFilter === 'All' || l.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q || l.title.toLowerCase().includes(q) || l.contactName?.toLowerCase().includes(q) || l.contactEmail?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_LEAD)
    setModalOpen(true)
  }

  const openEdit = (lead) => {
    setEditTarget(lead)
    setForm({ title: lead.title, contactName: lead.contactName || '', contactEmail: lead.contactEmail || '', contactPhone: lead.contactPhone || '', dealValue: lead.dealValue || '', notes: lead.notes || '', status: lead.status })
    setModalOpen(true)
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const data = { ...form, dealValue: Number(form.dealValue) || 0 }
    if (editTarget) {
      await updateLead(editTarget._id, data)
    } else {
      await createLead(data)
    }
    setSaving(false)
    setModalOpen(false)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Delete this lead?')) await deleteLead(id)
  }

  const handleStatusChange = async (id, status) => {
    await updateLeadStatus(id, status)
  }

  const handleDuplicate = async (lead) => {
    await createLead({
      title: `${lead.title} (copy)`,
      contactName: lead.contactName,
      contactEmail: lead.contactEmail,
      contactPhone: lead.contactPhone,
      dealValue: lead.dealValue,
      notes: lead.notes,
      tags: lead.tags,
      status: 'New',
    })
  }

  return (
    <PageWrapper>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-surface-border rounded-md text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
            />
          </div>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-700 focus:outline-none focus:border-brand-primary"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <Button
          variant="primary"
          size="sm"
          onClick={openCreate}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add Lead
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white border border-surface-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-border flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{filtered.length} leads</span>
        </div>
        <LeadTable leads={filtered} onEdit={openEdit} onDelete={handleDelete} onStatusChange={handleStatusChange} onDuplicate={handleDuplicate} />
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Lead' : 'New Lead'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Lead / Company name" name="title" placeholder="Acme Corp" value={form.title} onChange={handleChange} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contact name" name="contactName" placeholder="John Smith" value={form.contactName} onChange={handleChange} />
            <Input label="Deal value (₹)" name="dealValue" type="number" placeholder="0" value={form.dealValue} onChange={handleChange} />
          </div>
          <Input label="Contact email" name="contactEmail" type="email" placeholder="john@company.com" value={form.contactEmail} onChange={handleChange} />
          <Input label="Contact phone" name="contactPhone" placeholder="+1 555-0000" value={form.contactPhone} onChange={handleChange} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light">
              {STATUSES.filter((s) => s !== 'All').map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Add notes..." className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>{editTarget ? 'Save Changes' : 'Create Lead'}</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  )
}
