import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import api from '../api/index'
import { fmtDate } from '../utils/fis'

const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide'
const td = 'px-3 py-2 text-sm'
const dateClass = 'px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light'
const OUTCOME = { onTime: 'On time', late: 'Late', noDeadline: 'No deadline' }
const pct = (v) => (v === null ? '—' : `${v}%`)

const SummaryHead = ({ first }) => (
  <thead className="bg-slate-50"><tr>
    {[first, 'On time', 'Late', 'No deadline', 'On time %', 'Avg days to close'].map((h) => <th key={h} className={th}>{h}</th>)}
  </tr></thead>
)

export default function FisReport() {
  const [params] = useSearchParams()
  const asOf = params.get('asOf')
  const [from, setFrom] = useState(params.get('from') || '')
  const [to, setTo] = useState(params.get('to') || '')
  const [r, setR] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = {}
    if (from) q.from = from
    if (to) q.to = to
    if (asOf) q.asOf = asOf
    api.get('/fis/report', { params: q }).then((res) => { setR(res.data); setError('') })
      .catch((e) => setError(e.response?.data?.message || 'Failed to load report'))
  }, [from, to, asOf])

  return (
    <PageWrapper>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Review report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cases closed in the range. On time = closed on or before the deadline.</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">From
            <input type="date" className={dateClass} value={from || r?.from || ''} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">To
            <input type="date" className={dateClass} value={to || r?.to || ''} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {r && (
        <div className="space-y-6">
          <Card title={`Per person · ${fmtDate(r.from)} – ${fmtDate(r.to)}`}>
            <div className="overflow-x-auto"><table className="min-w-full">
              <thead className="bg-slate-50"><tr>
                {['Person', 'Led', 'Supported', 'On time', 'Late', 'No deadline', 'On time %', 'Avg days to close'].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-surface-border">
                {r.perPerson.map((p) => (
                  <tr key={p.person}>
                    <td className={td}>{p.person}</td><td className={td}>{p.led}</td><td className={td}>{p.supported}</td>
                    <td className={td}>{p.onTime}</td><td className={td}>{p.late}</td><td className={td}>{p.noDeadline}</td>
                    <td className={td}>{pct(p.onTimePct)}</td><td className={td}>{p.avgDaysToClose ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>

          <Card title="By case type">
            <div className="overflow-x-auto"><table className="min-w-full">
              <SummaryHead first="Case type" />
              <tbody className="divide-y divide-surface-border">
                {r.byType.map((t) => (
                  <tr key={t.code}>
                    <td className={td}>{t.code}</td><td className={td}>{t.onTime}</td><td className={td}>{t.late}</td>
                    <td className={td}>{t.noDeadline}</td><td className={td}>{pct(t.onTimePct)}</td><td className={td}>{t.avgDaysToClose ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>

          <Card title="Closed cases in range">
            <div className="overflow-x-auto"><table className="min-w-full">
              <thead className="bg-slate-50"><tr>
                {['Case', 'Type', 'Deadline', 'Closed', 'Outcome', 'Days to close'].map((h) => <th key={h} className={th}>{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-surface-border">
                {r.cases.map((c) => (
                  <tr key={c._id}>
                    <td className={td}>{c.caseRef}</td><td className={td}>{c.caseType}</td>
                    <td className={td}>{fmtDate(c.deadline)}</td><td className={td}>{fmtDate(c.closedAt)}</td>
                    <td className={`${td} font-medium ${c.outcome === 'late' ? 'text-red-600' : c.outcome === 'onTime' ? 'text-emerald-600' : 'text-slate-500'}`}>{OUTCOME[c.outcome]}</td>
                    <td className={td}>{c.daysToClose ?? '—'}</td>
                  </tr>
                ))}
                {!r.cases.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">No cases closed in this range</td></tr>}
              </tbody>
            </table></div>
          </Card>

          <Card title="Cases closed per month (12 months from From)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.perMonth}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="closed" fill="#6366F1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </PageWrapper>
  )
}
