import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import useReimbursementStore from '../store/reimbursementStore'
import api from '../api/index'

const emptyItem = () => ({ description: '', amount: '' })

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

export default function NewReimbursement() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { createReimbursement } = useReimbursementStore()

  const prefilledProjectId = searchParams.get('projectId') || ''
  const [projectName, setProjectName] = useState('')

  const [items, setItems]         = useState([emptyItem()])
  const [notes, setNotes]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!prefilledProjectId) return
    api.get(`/projects/${prefilledProjectId}`)
      .then(({ data }) => setProjectName(data.title))
      .catch(() => {})
  }, [prefilledProjectId])

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const handleItemChange = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  const addItem = () => setItems((prev) => [...prev, emptyItem()])

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const validItems = items.filter((i) => i.description.trim() && Number(i.amount) > 0)
    if (validItems.length === 0) {
      setError('Add at least one item with a description and amount.')
      return
    }
    setSubmitting(true)
    try {
      const payload = { items: validItems, notes }
      if (prefilledProjectId) payload.projectId = prefilledProjectId
      const result = await createReimbursement(payload)
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

        {prefilledProjectId && (
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
        )}

        <Card title="Expense Items">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    placeholder="Description (e.g. Travel — Mumbai to Pune)"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
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
