import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import useProjectStore from '../store/projectStore'
import useAuthStore from '../store/authStore'

const statusStyle = {
  'Active':    'bg-emerald-100 text-emerald-700',
  'On Hold':   'bg-amber-100 text-amber-700',
  'Completed': 'bg-slate-100 text-slate-600',
}

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

export default function Projects() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { projects, loading, error, fetchProjects } = useProjectStore()
  const isWorker = ['employee', 'sales'].includes(user?.role)

  useEffect(() => { fetchProjects() }, [fetchProjects])

  if (loading) {
    return (
      <PageWrapper>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-slate-400 text-sm">{isWorker ? "You haven't been assigned to any projects yet." : 'No projects yet.'}</p>
          {!isWorker && <p className="text-slate-400 text-xs mt-1">Convert a Won lead to create a project.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => {
            const totalExpenses = project.expenses?.reduce((s, e) => s + e.amount, 0) || 0
            const budgetUsed = project.budget > 0 ? Math.min((totalExpenses / project.budget) * 100, 100) : 0
            return (
              <div
                key={project._id}
                onClick={() => navigate(`/projects/${project._id}`)}
                className="bg-surface-card border border-surface-border rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-brand-primary/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{project.title}</h3>
                    {project.projectId && (
                      <p className="font-mono text-xs text-slate-400 mt-0.5">{project.projectId}</p>
                    )}
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[project.status] || 'bg-slate-100 text-slate-600'}`}>
                    {project.status}
                  </span>
                </div>

                {project.lead && (
                  <p className="text-xs text-slate-500 mb-3 truncate">Lead: {project.lead.title}</p>
                )}

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Budget used</span>
                    <span>{formatCurrency(totalExpenses)} / {formatCurrency(project.budget)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${budgetUsed >= 100 ? 'bg-status-lost' : budgetUsed >= 80 ? 'bg-status-contacted' : 'bg-status-won'}`}
                      style={{ width: `${budgetUsed}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="truncate">Head: {project.projectHead?.name || '—'}</span>
                  <span className="shrink-0 ml-2">{project.teamMembers?.length || 0} member{project.teamMembers?.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageWrapper>
  )
}
