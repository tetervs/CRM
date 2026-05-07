import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import useReimbursementStore from '../store/reimbursementStore'
import useAuthStore from '../store/authStore'

const STATUS_STYLE = {
  'Pending':          'bg-blue-100 text-blue-700',
  'Head Approved':    'bg-amber-100 text-amber-700',
  'Finance Approved': 'bg-violet-100 text-violet-700',
  'Paid':             'bg-emerald-100 text-emerald-700',
  'Rejected':         'bg-red-100 text-red-700',
}

const TIMELINE = ['Pending', 'Head Approved', 'Finance Approved', 'Paid']

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

const formatDate = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null

export default function ReimbursementDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { current, loading, fetchReimbursement, headApprove, financeApprove, rejectReimbursement, markPaid } = useReimbursementStore()

  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => { fetchReimbursement(id) }, [id, fetchReimbursement])

  useEffect(() => {
    if (!current || ['Paid', 'Rejected'].includes(current.status)) return
    const interval = setInterval(() => fetchReimbursement(id), 10000)
    return () => clearInterval(interval)
  }, [id, current?.status, fetchReimbursement])

  if (loading || !current) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      </PageWrapper>
    )
  }

  const r = current
  const { role } = user || {}
  const isPrivileged = ['finance_head', 'admin'].includes(role)
  const isManager = role === 'manager'

  const canHeadApprove   = (isPrivileged || isManager) && r.status === 'Pending'
  const canFinanceApprove = isPrivileged && r.status === 'Head Approved'
  const canReject        = (isPrivileged || isManager) && !['Paid', 'Rejected'].includes(r.status)
  const canPay           = isPrivileged && r.status === 'Finance Approved'
  const hasActions       = canHeadApprove || canFinanceApprove || canReject || canPay

  const doAction = async (action) => {
    setActionLoading(action)
    try {
      if (action === 'head-approve')    await headApprove(id)
      else if (action === 'finance-approve') await financeApprove(id)
      else if (action === 'pay')        await markPaid(id)
      else if (action === 'reject') {
        await rejectReimbursement(id, rejectReason)
        setRejectModal(false)
        setRejectReason('')
      }
    } catch (_) {}
    setActionLoading('')
  }

  const currentStep = TIMELINE.indexOf(r.status)

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/reimbursements')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">Reimbursement Request</h2>
          <p className="text-sm text-slate-500">Submitted by {r.submittedBy?.name} · {formatDate(r.createdAt)}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[r.status] || 'bg-slate-100 text-slate-600'}`}>
          {r.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Items */}
          <Card title="Expense Items">
            <div className="divide-y divide-surface-border">
              {r.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center py-2.5">
                  <p className="text-sm text-slate-700">{item.description}</p>
                  <p className="text-sm font-medium text-slate-900 shrink-0 ml-4">{formatCurrency(item.amount)}</p>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2.5 font-semibold">
                <span className="text-sm text-slate-900">Total</span>
                <span className="text-base text-slate-900">{formatCurrency(r.totalAmount)}</span>
              </div>
            </div>
          </Card>

          {r.notes && (
            <Card title="Notes">
              <p className="text-sm text-slate-700">{r.notes}</p>
            </Card>
          )}

          {r.status === 'Rejected' && r.rejectionReason && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-medium text-red-700 uppercase tracking-wide mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{r.rejectionReason}</p>
            </div>
          )}

          {hasActions && (
            <Card title="Actions">
              <div className="flex flex-wrap gap-2">
                {canHeadApprove && (
                  <Button size="sm" onClick={() => doAction('head-approve')} loading={actionLoading === 'head-approve'}>
                    Approve (Head)
                  </Button>
                )}
                {canFinanceApprove && (
                  <Button size="sm" onClick={() => doAction('finance-approve')} loading={actionLoading === 'finance-approve'}>
                    Approve (Finance)
                  </Button>
                )}
                {canPay && (
                  <Button size="sm" variant="secondary" onClick={() => doAction('pay')} loading={actionLoading === 'pay'}>
                    Mark Paid
                  </Button>
                )}
                {canReject && (
                  <Button size="sm" variant="danger" onClick={() => setRejectModal(true)}>Reject</Button>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Timeline */}
        <div>
          <Card title="Timeline">
            {r.status === 'Rejected' ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-status-lost" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-status-lost">Rejected</p>
                  <p className="text-xs text-slate-400 mt-0.5">Request was rejected</p>
                </div>
              </div>
            ) : (
              <div>
                {TIMELINE.map((step, i) => {
                  const isDone = i < currentStep
                  const isActive = i === currentStep
                  return (
                    <div key={step} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isDone || isActive ? 'bg-brand-primary' : 'bg-slate-100'}`}>
                          {isDone || isActive ? (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-slate-300" />
                          )}
                        </div>
                        {i < TIMELINE.length - 1 && (
                          <div className={`w-0.5 h-8 ${isDone ? 'bg-brand-primary' : 'bg-slate-200'}`} />
                        )}
                      </div>
                      <div className="pb-5">
                        <p className={`text-xs font-medium ${!isDone && !isActive ? 'text-slate-400' : 'text-slate-900'}`}>{step}</p>
                        {step === 'Head Approved' && r.headReviewedBy && (
                          <p className="text-xs text-slate-400 mt-0.5">{r.headReviewedBy?.name} · {formatDate(r.headReviewedAt)}</p>
                        )}
                        {step === 'Finance Approved' && r.financeReviewedBy && (
                          <p className="text-xs text-slate-400 mt-0.5">{r.financeReviewedBy?.name} · {formatDate(r.financeReviewedAt)}</p>
                        )}
                        {step === 'Paid' && r.paidBy && (
                          <p className="text-xs text-slate-400 mt-0.5">{r.paidBy?.name} · {formatDate(r.paidAt)}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Modal isOpen={rejectModal} onClose={() => setRejectModal(false)} title="Reject Reimbursement">
        <p className="text-sm text-slate-600 mb-4">Provide a reason for rejection (optional).</p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder="Rejection reason..."
          className="w-full px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light resize-none mb-4"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setRejectModal(false)}>Cancel</Button>
          <Button variant="danger" size="sm" loading={actionLoading === 'reject'} onClick={() => doAction('reject')}>Confirm Reject</Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
