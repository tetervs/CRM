import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import useReimbursementStore from '../store/reimbursementStore'
import api from '../api/index'

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

// Returns the default "last 6 months" range as YYYY-MM strings
const defaultRange = () => {
  const now = new Date()
  const from = new Date(now)
  from.setMonth(from.getMonth() - 6)
  from.setDate(1)
  const pad = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { from: pad(from), to: pad(now) }
}

export default function Reimbursements() {
  const navigate = useNavigate()
  const { reimbursements, loading, error, fetchReimbursements } = useReimbursementStore()
  const [activeTab, setActiveTab] = useState('All')

  const def = defaultRange()
  const [exportFrom, setExportFrom] = useState(def.from)
  const [exportTo,   setExportTo]   = useState(def.to)
  const [exporting,  setExporting]  = useState(false)
  const [exportError, setExportError] = useState('')
  const [showExport, setShowExport] = useState(false)

  useEffect(() => { fetchReimbursements() }, [fetchReimbursements])

  const filtered = activeTab === 'All' ? reimbursements : reimbursements.filter((r) => r.status === activeTab)

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const params = new URLSearchParams()
      if (exportFrom) params.set('from', exportFrom)
      if (exportTo)   params.set('to',   exportTo)

      const res = await api.get(`/exports/reimbursements?${params}`, { responseType: 'blob' })

      const url  = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', `reimbursements_${exportFrom}_to_${exportTo}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      setShowExport(false)
    } catch (err) {
      let msg = 'Export failed. Please try again.'
      if (err.response?.status === 429) {
        msg = 'Export limit reached (10/hour). Try again later.'
      } else if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text()
          msg = JSON.parse(text).message || msg
        } catch {}
      }
      setExportError(msg)
    } finally {
      setExporting(false)
    }
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reimbursements</h1>
          <p className="text-sm text-slate-500 mt-0.5">{reimbursements.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => { setShowExport(!showExport); setExportError('') }}>
            Export to Excel
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/reimbursements/new')}>
            + New Request
          </Button>
        </div>
      </div>

      {/* Export panel */}
      {showExport && (
        <div className="mb-5 p-4 bg-white border border-surface-border rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Export Date Range</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">From (month)</label>
              <input
                type="month"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500">To (month)</label>
              <input
                type="month"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
                className="px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
              />
            </div>
            <Button variant="primary" size="sm" loading={exporting} onClick={handleExport}>
              Download .xlsx
            </Button>
          </div>
          {exportError && (
            <p className="mt-2 text-xs text-red-600">{exportError}</p>
          )}
        </div>
      )}

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
