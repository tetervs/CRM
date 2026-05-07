import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import useProjectStore from '../store/projectStore'
import useAuthStore from '../store/authStore'
import api from '../api/index'

const PROJECT_STATUSES = ['Active', 'On Hold']

const STATUS_STYLE = {
  'Active':    'bg-emerald-100 text-emerald-700',
  'On Hold':   'bg-amber-100 text-amber-700',
  'Completed': 'bg-slate-100 text-slate-600',
}

const ROLE_BADGE = {
  employee:     'bg-slate-100 text-slate-600',
  sales:        'bg-sky-100 text-sky-700',
  manager:      'bg-blue-100 text-blue-700',
  admin:        'bg-violet-100 text-violet-700',
  finance_head: 'bg-emerald-100 text-emerald-700',
}

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

const formatDate = (d) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const emptyPullForm = { employeeType: 'inhouse', pulledEmployee: '', freelancerName: '', freelancerEmail: '', reason: '' }
const emptyMilestoneForm = { title: '', description: '', dueDate: '', assignedTo: '' }

const MILESTONE_STATUS_STYLE = {
  'pending':     'bg-slate-100 text-slate-600',
  'in-progress': 'bg-amber-100 text-amber-700',
  'completed':   'bg-emerald-100 text-emerald-700',
}

export default function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { current: project, loading, fetchProject, updateStatus, addProgress, logExpense, completeProject } = useProjectStore()

  const [progressNote, setProgressNote]     = useState('')
  const [addingProgress, setAddingProgress] = useState(false)
  const [expenseForm, setExpenseForm]       = useState({ description: '', amount: '' })
  const [addingExpense, setAddingExpense]   = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completing, setCompleting]         = useState(false)
  const [completeSummary, setCompleteSummary] = useState(null)
  const [statusChanging, setStatusChanging] = useState(false)

  const [manpowerPulls, setManpowerPulls]     = useState([])

  const [pullModalOpen, setPullModalOpen]     = useState(false)
  const [pullForm, setPullForm]               = useState(emptyPullForm)
  const [availableWorkers, setAvailableWorkers] = useState([])
  const [pulling, setPulling]                 = useState(false)
  const [pullError, setPullError]             = useState('')
  const [pullSuccess, setPullSuccess]         = useState('')

  const [milestones, setMilestones]                 = useState([])
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [milestoneForm, setMilestoneForm]           = useState(emptyMilestoneForm)
  const [addingMilestone, setAddingMilestone]       = useState(false)
  const [milestoneError, setMilestoneError]         = useState('')
  const [updatingMilestone, setUpdatingMilestone]   = useState('')

  const fetchMilestones = () =>
    api.get(`/milestones/project/${id}`).then((r) => setMilestones(r.data)).catch(() => {})

  useEffect(() => { fetchProject(id) }, [id, fetchProject])

  useEffect(() => {
    api.get(`/projects/${id}/manpower`).then((r) => setManpowerPulls(r.data)).catch(() => {})
    fetchMilestones()
  }, [id])

  if (loading || !project) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </PageWrapper>
    )
  }

  const isPrivileged = ['finance_head', 'admin'].includes(user?.role)
  const isManager    = user?.role === 'manager'
  const isHead = (project.projectHead?._id || project.projectHead)?.toString() === user?._id?.toString()
  const memberIds = project.teamMembers?.map((m) => (m._id || m).toString()) || []
  const isMember  = memberIds.includes(user?._id?.toString())

  const canAddProgress      = isPrivileged || isHead || isMember
  const canLogExpense       = isPrivileged || isHead
  const canChangeStatus     = isPrivileged || isHead
  const canPullEmployee     = (isPrivileged || isHead) && project.status !== 'Completed'
  const canComplete         = isPrivileged
  const canSubmitReimbursement = isPrivileged || isHead || isMember
  const canManageMilestones = isPrivileged || isManager

  const totalExpenses = project.expenses?.reduce((s, e) => s + e.amount, 0) || 0
  const profit    = project.budget - totalExpenses
  const budgetUsed = project.budget > 0 ? Math.min((totalExpenses / project.budget) * 100, 100) : 0

  const handleStatusChange = async (e) => {
    setStatusChanging(true)
    await updateStatus(id, e.target.value)
    setStatusChanging(false)
  }

  const handleAddProgress = async (e) => {
    e.preventDefault()
    if (!progressNote.trim()) return
    setAddingProgress(true)
    await addProgress(id, progressNote.trim())
    setProgressNote('')
    setAddingProgress(false)
  }

  const handleLogExpense = async (e) => {
    e.preventDefault()
    if (!expenseForm.description.trim() || !expenseForm.amount) return
    setAddingExpense(true)
    await logExpense(id, { description: expenseForm.description, amount: expenseForm.amount })
    setExpenseForm({ description: '', amount: '' })
    setAddingExpense(false)
  }

  const handleComplete = async () => {
    setCompleting(true)
    const result = await completeProject(id)
    setCompleteSummary(result.summary)
    setCompleting(false)
    setShowCompleteModal(false)
  }

  const handleAddMilestone = async (e) => {
    e.preventDefault()
    if (!milestoneForm.title.trim() || !milestoneForm.dueDate) return
    setMilestoneError('')
    setAddingMilestone(true)
    try {
      await api.post('/milestones', {
        projectId:   id,
        title:       milestoneForm.title.trim(),
        description: milestoneForm.description.trim(),
        dueDate:     milestoneForm.dueDate,
        assignedTo:  milestoneForm.assignedTo || undefined,
      })
      await fetchMilestones()
      setMilestoneModalOpen(false)
      setMilestoneForm(emptyMilestoneForm)
    } catch (err) {
      setMilestoneError(err.response?.data?.message || 'Failed to add milestone')
    } finally {
      setAddingMilestone(false)
    }
  }

  const handleMilestoneStatus = async (milestoneId, status) => {
    setUpdatingMilestone(milestoneId)
    try {
      await api.patch(`/milestones/${milestoneId}`, { status })
      setMilestones((prev) => prev.map((m) => m._id === milestoneId ? { ...m, status } : m))
    } catch {}
    setUpdatingMilestone('')
  }

  const openPullModal = async () => {
    setPullError('')
    setPullSuccess('')
    setPullForm(emptyPullForm)
    try {
      const { data } = await api.get('/users')
      const existingMemberIds = project.teamMembers?.map((m) => (m._id || m).toString()) || []
      setAvailableWorkers(data.filter((u) => ['employee', 'sales'].includes(u.role) && !existingMemberIds.includes(u._id.toString())))
    } catch {}
    setPullModalOpen(true)
  }

  const handlePull = async (e) => {
    e.preventDefault()
    setPullError('')
    if (pullForm.employeeType === 'inhouse' && !pullForm.pulledEmployee) {
      setPullError('Select an employee.')
      return
    }
    setPulling(true)
    try {
      await api.post(`/projects/${id}/manpower`, pullForm)
      await fetchProject(id)
      const { data } = await api.get(`/projects/${id}/manpower`)
      setManpowerPulls(data)
      setPullModalOpen(false)
      setPullSuccess('Employee pulled and added to project team.')
    } catch (err) {
      setPullError(err.response?.data?.message || 'Failed to pull employee')
    } finally {
      setPulling(false)
    }
  }

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/projects')} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate">{project.title}</h2>
          {project.lead && <p className="text-sm text-slate-500">Lead: {project.lead.title}</p>}
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLE[project.status] || 'bg-slate-100 text-slate-600'}`}>
          {project.status}
        </span>
        {canSubmitReimbursement && (
          <Button variant="secondary" size="sm" onClick={() => navigate(`/reimbursements/new?projectId=${id}`)}>
            Submit Reimbursement
          </Button>
        )}
        {canComplete && project.status !== 'Completed' && (
          <Button variant="primary" size="sm" onClick={() => setShowCompleteModal(true)}>Mark Complete</Button>
        )}
      </div>

      {completeSummary && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${completeSummary.isOverBudget ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          Project completed. Budget: {formatCurrency(completeSummary.budget)} · Expenses: {formatCurrency(completeSummary.totalExpenses)} · {completeSummary.isOverBudget ? `Over by ${formatCurrency(-completeSummary.profit)}` : `Profit: ${formatCurrency(completeSummary.profit)}`}
        </div>
      )}

      {pullSuccess && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm border bg-emerald-50 border-emerald-200 text-emerald-700">
          {pullSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress Updates */}
          <Card title="Progress Updates">
            {canAddProgress && (
              <form onSubmit={handleAddProgress} className="flex gap-2 mb-4">
                <input
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder="Add a progress note..."
                  className="flex-1 px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
                />
                <Button type="submit" size="sm" loading={addingProgress} disabled={!progressNote.trim()}>Add</Button>
              </form>
            )}
            {project.progressUpdates?.length ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {[...project.progressUpdates].reverse().map((u, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700">{u.note}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{u.updatedBy?.name} · {formatDate(u.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-2">No updates yet</p>
            )}
          </Card>

          {/* Manpower */}
          <Card
            title="Manpower Pulled"
            action={canPullEmployee ? (
              <Button variant="ghost" size="sm" onClick={openPullModal}>Pull Employee</Button>
            ) : null}
          >
            {manpowerPulls.length ? (
              <div className="divide-y divide-surface-border">
                {manpowerPulls.map((pull, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {pull.employeeType === 'freelancer'
                          ? (pull.freelancerName || 'Freelancer')
                          : (pull.pulledEmployee?.name || '—')}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Pulled by {pull.pulledBy?.name}
                        {pull.reason ? ` · ${pull.reason}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${pull.employeeType === 'freelancer' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {pull.employeeType}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(pull.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-2">No manpower pulled yet</p>
            )}
          </Card>

          {/* Milestones */}
          <Card
            title="Milestones"
            action={canManageMilestones ? (
              <Button variant="ghost" size="sm" onClick={() => { setMilestoneError(''); setMilestoneForm(emptyMilestoneForm); setMilestoneModalOpen(true) }}>
                + Add
              </Button>
            ) : null}
          >
            {milestones.length ? (
              <div className="divide-y divide-surface-border">
                {milestones.map((m) => {
                  const isOverdue = m.status !== 'completed' && new Date(m.dueDate) < new Date()
                  return (
                    <div key={m._id} className="py-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-slate-900">{m.title}</p>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Overdue</span>
                          )}
                        </div>
                        {m.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{m.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          <span>Due {new Date(m.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          {m.assignedTo && <span>· {m.assignedTo.name}</span>}
                        </div>
                      </div>
                      {canManageMilestones ? (
                        <select
                          value={m.status}
                          onChange={(e) => handleMilestoneStatus(m._id, e.target.value)}
                          disabled={updatingMilestone === m._id}
                          className="text-xs px-2 py-1 rounded border border-surface-border bg-white focus:outline-none focus:border-brand-primary shrink-0"
                        >
                          <option value="pending">Pending</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      ) : (
                        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${MILESTONE_STATUS_STYLE[m.status] || 'bg-slate-100 text-slate-600'}`}>
                          {m.status}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-2">No milestones yet</p>
            )}
          </Card>

          {/* Expenses */}
          <Card title="Expenses">
            {canLogExpense && (
              <form onSubmit={handleLogExpense} className="flex gap-2 mb-4">
                <input
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Description"
                  className="flex-1 px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
                />
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="Amount"
                  className="w-28 px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
                />
                <Button type="submit" size="sm" loading={addingExpense} disabled={!expenseForm.description.trim() || !expenseForm.amount}>Log</Button>
              </form>
            )}
            {project.expenses?.length ? (
              <div className="divide-y divide-surface-border">
                {project.expenses.map((exp, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm text-slate-700">{exp.description}</p>
                      <p className="text-xs text-slate-400">{exp.loggedBy?.name} · {formatDate(exp.date)}</p>
                    </div>
                    <span className="text-sm font-medium text-slate-900 shrink-0 ml-4">{formatCurrency(exp.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2.5 font-semibold">
                  <span className="text-sm text-slate-700">Total</span>
                  <span className={`text-sm ${profit < 0 ? 'text-status-lost' : 'text-slate-900'}`}>{formatCurrency(totalExpenses)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-2">No expenses logged</p>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {canChangeStatus && project.status !== 'Completed' && (
            <Card title="Status">
              <select
                value={project.status}
                onChange={handleStatusChange}
                disabled={statusChanging}
                className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white focus:outline-none focus:border-brand-primary"
              >
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Card>
          )}

          <Card title="Budget">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Total budget</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(project.budget)}</p>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Used</span>
                  <span>{budgetUsed.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${budgetUsed >= 100 ? 'bg-status-lost' : budgetUsed >= 80 ? 'bg-status-contacted' : 'bg-status-won'}`}
                    style={{ width: `${budgetUsed}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 rounded-md p-2">
                  <p className="text-slate-500">Spent</p>
                  <p className="font-medium text-slate-900">{formatCurrency(totalExpenses)}</p>
                </div>
                <div className={`rounded-md p-2 ${profit < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
                  <p className="text-slate-500">Remaining</p>
                  <p className={`font-medium ${profit < 0 ? 'text-status-lost' : 'text-status-won'}`}>{formatCurrency(profit)}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Team">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-brand-light flex items-center justify-center text-xs font-semibold text-brand-primary shrink-0">
                  {project.projectHead?.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-900 truncate">{project.projectHead?.name}</p>
                  <p className="text-xs text-slate-400">Project Head</p>
                </div>
                <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">manager</span>
              </div>
              {project.teamMembers?.map((m) => (
                <div key={m._id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                    {m.name?.[0]?.toUpperCase()}
                  </div>
                  <p className="text-xs text-slate-700 truncate flex-1">{m.name}</p>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[m.role] || 'bg-slate-100 text-slate-600'}`}>
                    {m.role}
                  </span>
                </div>
              ))}
              {!project.teamMembers?.length && (
                <p className="text-xs text-slate-400">No team members assigned</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Milestone Modal */}
      <Modal isOpen={milestoneModalOpen} onClose={() => setMilestoneModalOpen(false)} title="Add Milestone">
        <form onSubmit={handleAddMilestone} className="space-y-4">
          {milestoneError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{milestoneError}</div>
          )}
          <Input
            label="Title"
            required
            placeholder="Milestone title"
            value={milestoneForm.title}
            onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Description</label>
            <textarea
              rows={2}
              placeholder="Optional description..."
              value={milestoneForm.description}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light resize-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Due Date<span className="text-status-lost ml-0.5">*</span></label>
            <input
              type="date"
              required
              value={milestoneForm.dueDate}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Assign To</label>
            <select
              value={milestoneForm.assignedTo}
              onChange={(e) => setMilestoneForm((f) => ({ ...f, assignedTo: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-900 focus:border-brand-primary focus:ring-2 focus:ring-brand-light outline-none"
            >
              <option value="">Unassigned</option>
              {project.projectHead && (
                <option value={project.projectHead._id}>{project.projectHead.name} (Head)</option>
              )}
              {project.teamMembers?.map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setMilestoneModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={addingMilestone} disabled={!milestoneForm.title.trim() || !milestoneForm.dueDate}>Add Milestone</Button>
          </div>
        </form>
      </Modal>

      {/* Pull Employee Modal */}
      <Modal isOpen={pullModalOpen} onClose={() => setPullModalOpen(false)} title="Pull Employee">
        <form onSubmit={handlePull} className="space-y-4">
          {pullError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{pullError}</div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              Type<span className="text-status-lost ml-0.5">*</span>
            </label>
            <select
              value={pullForm.employeeType}
              onChange={(e) => setPullForm((f) => ({ ...f, employeeType: e.target.value, pulledEmployee: '', freelancerName: '', freelancerEmail: '' }))}
              className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-900 focus:border-brand-primary focus:ring-2 focus:ring-brand-light outline-none"
            >
              <option value="inhouse">Inhouse</option>
              <option value="freelancer">Freelancer</option>
            </select>
          </div>

          {pullForm.employeeType === 'inhouse' ? (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Employee<span className="text-status-lost ml-0.5">*</span>
              </label>
              <select
                value={pullForm.pulledEmployee}
                onChange={(e) => setPullForm((f) => ({ ...f, pulledEmployee: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-900 focus:border-brand-primary focus:ring-2 focus:ring-brand-light outline-none"
              >
                <option value="">Select employee…</option>
                {availableWorkers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                label="Freelancer Name"
                placeholder="Enter name"
                value={pullForm.freelancerName}
                onChange={(e) => setPullForm((f) => ({ ...f, freelancerName: e.target.value }))}
              />
              <Input
                label="Freelancer Email"
                type="email"
                placeholder="Enter email"
                value={pullForm.freelancerEmail}
                onChange={(e) => setPullForm((f) => ({ ...f, freelancerEmail: e.target.value }))}
              />
            </div>
          )}

          <Input
            label="Reason"
            placeholder="Optional reason..."
            value={pullForm.reason}
            onChange={(e) => setPullForm((f) => ({ ...f, reason: e.target.value }))}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setPullModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={pulling}>Pull</Button>
          </div>
        </form>
      </Modal>

      {/* Complete Modal */}
      <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Mark Project Complete">
        <p className="text-sm text-slate-600 mb-4">
          This will finalize the project and calculate the profit/loss summary.
        </p>
        <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Budget</span>
            <span className="font-medium">{formatCurrency(project.budget)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total Expenses</span>
            <span className="font-medium">{formatCurrency(totalExpenses)}</span>
          </div>
          <div className={`flex justify-between text-sm font-semibold border-t border-surface-border pt-1.5 ${profit < 0 ? 'text-status-lost' : 'text-status-won'}`}>
            <span>Profit / Loss</span>
            <span>{formatCurrency(profit)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowCompleteModal(false)}>Cancel</Button>
          <Button variant="primary" size="sm" loading={completing} onClick={handleComplete}>Confirm Complete</Button>
        </div>
      </Modal>
    </PageWrapper>
  )
}
