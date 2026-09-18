import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import useReimbursementStore from '../store/reimbursementStore'
import api from '../api/index'

// clientId ties an item row to its proof upload (field name `proof_<clientId>`) —
// stable identity, not array position, so removing/reordering rows can't misattach a file.
const emptyItem = () => ({ clientId: crypto.randomUUID(), description: '', amount: '', proofFile: null, previewUrl: null })

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

export default function NewReimbursement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { createReimbursement } = useReimbursementStore()

  const prefilledProjectId = searchParams.get('projectId') || ''
  const [projectName, setProjectName] = useState('')

  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')

  const [items, setItems] = useState([emptyItem()])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showMissingProof, setShowMissingProof] = useState(false)

  // Revoke every item's preview URL on unmount — a ref keeps this in sync with the
  // latest items so the unmount cleanup isn't stuck looking at the initial render.
  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => {
    return () => { itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl)) }
  }, [])

  useEffect(() => {
    if (!prefilledProjectId) return
    api.get(`/projects/${prefilledProjectId}`)
      .then(({ data }) => setProjectName(data.title))
      .catch(() => { })
  }, [prefilledProjectId])

  useEffect(() => {
    if (prefilledProjectId) return
    api.get('/projects')
      .then(({ data }) => setProjects(data))
      .catch(() => { })
  }, [prefilledProjectId])

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const handleItemChange = (clientId, field, value) => {
    setItems((prev) => prev.map((item) => item.clientId === clientId ? { ...item, [field]: value } : item))
  }

  const handleItemFile = (clientId, file) => {
    if (!file) return
    setItems((prev) => prev.map((item) => {
      if (item.clientId !== clientId) return item
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return { ...item, proofFile: file, previewUrl: URL.createObjectURL(file) }
    }))
    setShowMissingProof(false)
  }

  const removeItemFile = (clientId) => {
    setItems((prev) => prev.map((item) => {
      if (item.clientId !== clientId) return item
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return { ...item, proofFile: null, previewUrl: null }
    }))
  }

  const addItem = () => setItems((prev) => [...prev, emptyItem()])

  const removeItem = (clientId) => setItems((prev) => {
    const target = prev.find((i) => i.clientId === clientId)
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    return prev.filter((item) => item.clientId !== clientId)
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setShowMissingProof(false)

    if (!prefilledProjectId && !selectedProjectId) {
      setError('Select a project — reimbursements must be linked to a project.')
      return
    }

    const validItems = items.filter((i) => i.description.trim() && Number(i.amount) > 0)
    if (validItems.length === 0) {
      setError('Add at least one item with a description and amount.')
      return
    }
    if (validItems.some((i) => !i.proofFile)) {
      setError('Every expense item needs a proof-of-spending image attached.')
      setShowMissingProof(true)
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('items', JSON.stringify(validItems.map(({ clientId, description, amount }) => ({ clientId, description, amount }))))
      if (notes) fd.append('notes', notes)
      if (prefilledProjectId) fd.append('projectId', prefilledProjectId)
      else if (selectedProjectId) fd.append('projectId', selectedProjectId)
      validItems.forEach((item) => fd.append(`proof_${item.clientId}`, item.proofFile))

      const result = await createReimbursement(fd)
      navigate(`/reimbursements/${result._id}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit reimbursement')
      setSubmitting(false)
    }
  }

  return (
    <PageWrapper>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(prefilledProjectId ? `/projects/${prefilledProjectId}` : '/reimbursements')}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-slate-900">New Reimbursement Request</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {prefilledProjectId ? (
          <Card title="Project">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="text-sm font-medium text-slate-900">{projectName || 'Loading…'}</span>
              <span className="text-xs text-slate-400">(linked to project)</span>
            </div>
          </Card>
        ) : (
          <Card title="Project">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
              className="px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light w-full"
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>{p.title}</option>
              ))}
            </select>
          </Card>
        )}

        <Card title="Expense Items">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.clientId} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    placeholder="Description (e.g. Travel — Mumbai to Pune)"
                    value={item.description}
                    onChange={(e) => handleItemChange(item.clientId, 'description', e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => handleItemChange(item.clientId, 'amount', e.target.value)}
                  />
                </div>

                {/* Per-item proof upload — required, tied to this row via clientId */}
                <div className="shrink-0">
                  {item.previewUrl ? (
                    <div className="relative group w-10 h-10">
                      <img src={item.previewUrl} alt="Proof" className="w-10 h-10 object-cover rounded-md border border-surface-border" />
                      <button
                        type="button"
                        onClick={() => removeItemFile(item.clientId)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label
                      className={`flex items-center justify-center w-10 h-10 rounded-md border cursor-pointer transition-colors ${
                        showMissingProof
                          ? 'border-status-lost bg-red-50 text-status-lost'
                          : 'border-dashed border-surface-border text-slate-400 hover:text-brand-primary hover:border-brand-primary'
                      }`}
                      title="Attach proof of spending"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleItemFile(item.clientId, e.target.files[0])}
                      />
                    </label>
                  )}
                </div>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.clientId)}
                    className="mb-0.5 text-slate-400 hover:text-status-lost transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="text-xs text-brand-primary hover:text-brand-hover font-medium"
            >
              + Add another item
            </button>

            {totalAmount > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-surface-border">
                <span className="text-sm font-medium text-slate-700">Total</span>
                <span className="text-base font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
              </div>
            )}
          </div>
        </Card>

        <Card title="Notes (optional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional context for your reviewer..."
            className="w-full px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light resize-none"
          />
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" type="button" onClick={() => navigate(prefilledProjectId ? `/projects/${prefilledProjectId}` : '/reimbursements')}>Cancel</Button>
          <Button variant="primary" size="sm" type="submit" loading={submitting}>Submit Request</Button>
        </div>
      </form>
    </PageWrapper>
  )
}
