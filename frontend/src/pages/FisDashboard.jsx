import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import { StatCard } from '../components/ui/StatCard'
import api from '../api/index'
import { fmtDate, fmtDateTime } from '../utils/fis'

const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide'
const td = 'px-3 py-2 text-sm'

const Table = ({ children }) => <div className="overflow-x-auto"><table className="min-w-full">{children}</table></div>
const typeSummary = (m) => Object.entries(m || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'

export default function FisDashboard() {
  const [params] = useSearchParams()
  const asOf = params.get('asOf')
  const [d, setD] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/fis/dashboard', { params: asOf ? { asOf } : {} }).then((r) => setD(r.data)).catch(() => setError('Failed to load dashboard'))
  }, [asOf])

  if (error) return <PageWrapper><p className="text-sm text-red-600">{error}</p></PageWrapper>
  if (!d) return <PageWrapper><p className="text-sm text-slate-400">Loading…</p></PageWrapper>
  const t = d.tiles

  const row = (key, label, r, bold) => (
    <tr key={key} className={bold ? 'bg-slate-50 font-semibold' : ''}>
      <td className={td}>{label}</td>
      <td className={td}>{r.leading ?? '—'}</td>
      <td className={td}>{r.supporting ?? '—'}</td>
      <td className={`${td} ${r.overdue ? 'text-red-600 font-semibold' : ''}`}>{r.overdue}</td>
      <td className={`${td} ${r.dueSoon ? 'text-orange-600 font-semibold' : ''}`}>{r.dueSoon}</td>
      <td className={`${td} ${r.stale ? 'text-amber-700 font-semibold' : ''}`}>{r.stale}</td>
      <td className={td}>{r.lastUpdate ? fmtDate(r.lastUpdate) : '—'}</td>
      <td className={td}>{r.closed ?? '—'}</td>
      <td className={td}>{typeSummary(r.openByType)}</td>
    </tr>
  )

  return (
    <PageWrapper>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">FIS dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">As of {fmtDate(d.asOf)}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <StatCard label="Open" value={t.open} />
        <StatCard label="Overdue" value={t.overdue} />
        <StatCard label="Due soon" value={t.dueSoon} />
        <StatCard label={`No update in ${t.staleDays}+ days`} value={t.stale} />
        <StatCard label="Closed" value={t.closed} />
        <StatCard label="Last change" value={<span className="text-sm">{fmtDateTime(t.lastChange)}</span>} />
      </div>

      <div className="space-y-6">
        <Card title="Workload by person">
          <Table>
            <thead className="bg-slate-50"><tr>
              {['Person', 'Leading', 'Supporting', 'Overdue', 'Due soon', 'No recent update', 'Last update', 'Closed', 'Open cases by type'].map((h) => <th key={h} className={th}>{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-surface-border">
              {d.workload.map((w) => row(w.person._id, w.person.name, w))}
              {row('total', 'Total (each case once)', d.total, true)}
              {row('nolead', 'No lead yet', { ...d.noLead, leading: undefined, supporting: undefined, closed: undefined, lastUpdate: null })}
            </tbody>
          </Table>
        </Card>

        <Card title="Open cases per person by phase">
          <Table>
            <thead className="bg-slate-50"><tr>
              <th className={th}>Person</th>
              {d.phases.map((p) => <th key={p} className={th}>Phase: {p}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-surface-border">
              {d.openByPhase.map((r) => (
                <tr key={r.person}>
                  <td className={td}>{r.person}</td>
                  {d.phases.map((p) => <td key={p} className={td}>{r.counts[p] || 0}</td>)}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card title="Open cases at each stage, per case type">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {d.stageCounts.map((ct) => (
              <div key={ct.code}>
                <p className="text-sm font-semibold text-slate-800">{ct.code} <span className="font-normal text-slate-400">· {ct.name}</span></p>
                <ul className="mt-1.5 text-sm divide-y divide-surface-border border border-surface-border rounded-md">
                  {ct.stages.map((s) => (
                    <li key={s.stage} className="flex justify-between px-3 py-1">
                      <span className={s.removed ? 'text-amber-700' : 'text-slate-600'}>{s.stage}{s.removed && ' (removed)'}</span>
                      <span className={s.count ? 'font-semibold text-slate-900' : 'text-slate-300'}>{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}
