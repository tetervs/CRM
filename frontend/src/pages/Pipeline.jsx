import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { KanbanCard } from '../components/shared/KanbanCard'
import useLeadStore from '../store/leadStore'

const COLUMNS = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']

const COLUMN_STYLES = {
  'New':           { header: 'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-status-new' },
  'Contacted':     { header: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-status-contacted' },
  'Proposal Sent': { header: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-status-proposal' },
  'Won':           { header: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-status-won' },
  'Lost':          { header: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-status-lost' },
}

const EMPTY_LEAD = { title: '', contactName: '', contactEmail: '', contactPhone: '', dealValue: '', notes: '', status: 'New' }

export default function Pipeline() {
  const { leads, fetchLeads, updateLeadStatus, createLead } = useLeadStore()
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_LEAD)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const byStatus = (status) => leads.filter((l) => l.status === status)

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId) return
    updateLeadStatus(draggableId, destination.droppableId)
  }

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await createLead({ ...form, dealValue: Number(form.dealValue) || 0 })
    setSaving(false)
    setModalOpen(false)
    setForm(EMPTY_LEAD)
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">{leads.length} total leads</p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setModalOpen(true)}
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Add Lead
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-5 gap-3 min-h-[calc(100vh-12rem)]">
          {COLUMNS.map((col) => {
            const colLeads = byStatus(col)
            const styles = COLUMN_STYLES[col]
            return (
              <div key={col} className="flex flex-col min-w-0">
                {/* Column header */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-2 ${styles.header}`}>
                  <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                  <span className="text-xs font-semibold">{col}</span>
                  <span className="ml-auto text-xs font-bold opacity-70">{colLeads.length}</span>
                </div>

                {/* Drop zone */}
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-xl p-2 min-h-24 transition-colors duration-150 ${snapshot.isDraggingOver ? 'bg-brand-light' : 'bg-slate-100/60'}`}
                    >
                      {colLeads.map((lead, index) => (
                        <Draggable key={lead._id} draggableId={lead._id} index={index}>
                          {(provided) => (
                            <KanbanCard lead={lead} provided={provided} />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {colLeads.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center py-6">
                          <p className="text-xs text-slate-400">Drop leads here</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Add Lead Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Lead">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Lead / Company name" name="title" placeholder="Acme Corp" value={form.title} onChange={handleChange} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Contact name" name="contactName" placeholder="John Smith" value={form.contactName} onChange={handleChange} />
            <Input label="Deal value (₹)" name="dealValue" type="number" placeholder="0" value={form.dealValue} onChange={handleChange} />
          </div>
          <Input label="Contact email" name="contactEmail" type="email" placeholder="john@company.com" value={form.contactEmail} onChange={handleChange} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Stage</label>
            <select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light">
              {COLUMNS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm" loading={saving}>Create Lead</Button>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  )
}
