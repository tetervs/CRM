import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import useReimbursementStore from '../store/reimbursementStore'

const TABS = ['All', 'Pending', 'Head Approved', 'Finance Approved', 'Paid', 'Rejected']

const STATUS_STYLE = {
  'Pending':          'bg-blue-100 text-blue-700',
  'Head Approved':    'bg-amber-100 text-amber-700',
  'Finance Approved': 'bg-violet-100 text-violet-700',
  'Paid':             'bg-emerald-100 text-emerald-700',
  'Rejected':         'bg-red-100 text-red-700',
}

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Reimbursements() {
  const navigate = useNavigate()
  const { reimbursements, loading, error, fetchReimbursements } = useReimbursementStore()
  const [activeTab, setActiveTab] = useState('All')

  useEffect(() => { fetchReimbursements() }, [fetchReimbursements])

  const filtered = activeTab === 'All' ? reimbursements : reimbursements.filter((r) => r.status === activeTab)

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reimbursements</h1>
          <p className="text-sm text-slate-500 mt-0.5">{reimbursements.length} total</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/reimbursements/new')}>
          + New Request
        </Button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-surface-border overflow-x-auto">
        {TABS.map((tab) => {
          const count = tab === 'All' ? reimbursements.length : reimbursements.filter((r) => r.status === tab).length
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 px-3 py-2 text-xs font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}{count > 0 ? ` (${count})` : ''}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48">
          <p className="text-slate-400 text-sm">No reimbursements in this category.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div
              key={r._id}
              onClick={() => navigate(`/reimbursements/${r._id}`)}
              className="bg-surface-card border border-surface-border rounded-xl px-5 py-4 cursor-pointer hover:shadow-md hover:border-brand-primary/30 transition-all flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {r.items?.[0]?.description}{r.items?.length > 1 ? ` +${r.items.length - 1} more` : ''}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{r.submittedBy?.name} · {formatDate(r.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(r.totalAmount)}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
