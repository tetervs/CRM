import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import api from '../api/index'

const TYPE_STYLES = {
  inhouse:    'bg-blue-100 text-blue-700',
  freelancer: 'bg-amber-100 text-amber-700',
}

export default function Manpower() {
  const [pulls, setPulls] = useState([])

  useEffect(() => {
    api.get('/manpower').then((r) => setPulls(r.data)).catch(() => {})
  }, [])

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-semibold text-slate-900">Manpower Pulls</h1>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border">
              {['Project', 'Pulled By', 'Employee', 'Type', 'Reason', 'Date'].map((col) => (
                <th key={col} className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide pr-6">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {pulls.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-sm text-slate-400">No pulls logged yet.</td>
              </tr>
            )}
            {pulls.map((pull) => (
              <tr key={pull._id} className="hover:bg-surface-bg transition-colors">
                <td className="py-3 pr-6 font-medium">
                  {pull.project ? (
                    <Link
                      to={`/projects/${pull.project._id}`}
                      className="text-brand-primary hover:text-brand-hover hover:underline"
                    >
                      {pull.project.title}
                    </Link>
                  ) : '—'}
                </td>
                <td className="py-3 pr-6 font-medium text-slate-900">{pull.pulledBy?.name || '—'}</td>
                <td className="py-3 pr-6 text-slate-700">
                  {pull.employeeType === 'freelancer'
                    ? (pull.freelancerName ? `${pull.freelancerName} (${pull.freelancerEmail})` : 'Freelancer')
                    : (pull.pulledEmployee?.name || '—')}
                </td>
                <td className="py-3 pr-6">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[pull.employeeType] || 'bg-slate-100 text-slate-600'}`}>
                    {pull.employeeType}
                  </span>
                </td>
                <td className="py-3 pr-6 text-slate-600 max-w-xs truncate">{pull.reason || '—'}</td>
                <td className="py-3 text-slate-500 text-xs">
                  {new Date(pull.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageWrapper>
  )
}
