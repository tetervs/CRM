import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../../api/index'

const STATUS_COLORS = {
  'New':          '#3B82F6',
  'Contacted':    '#F59E0B',
  'Proposal Sent':'#8B5CF6',
  'Won':          '#10B981',
  'Lost':         '#EF4444',
}
const STATUSES = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']

const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`
const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const fmtTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function Skeleton({ className }) {
  return <div className={`bg-slate-100 animate-pulse rounded ${className}`} />
}

function StatMini({ label, value }) {
  return (
    <div className="bg-surface-bg border border-surface-border rounded-lg p-3">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-lg font-bold text-slate-900 mt-1 truncate">{value}</p>
    </div>
  )
}

function Empty({ text }) {
  return <p className="text-sm text-slate-400 text-center py-6">{text}</p>
}

export function UserPerformanceDrawer({ userId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    setData(null)
    api.get(`/analytics/performance/${userId}`)
      .then(({ data: d }) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  if (!userId) return null

  const chartData = STATUSES.map((s) => ({
    status: s,
    count: data?.byStatus?.[s] || 0,
  }))

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-[480px] z-50 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-surface-border shrink-0">
          {loading ? (
            <div className="space-y-2 flex-1 mr-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-56" />
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-brand-light text-brand-primary text-sm font-bold flex items-center justify-center shrink-0">
                {data?.user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-base leading-tight">{data?.user?.name}</p>
                <p className="text-xs text-slate-400 truncate">
                  {data?.user?.email} · <span className="capitalize">{data?.user?.role?.replace('_', ' ')}</span>
                </p>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors shrink-0 ml-3"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
            ) : (
              <>
                <StatMini label="Total Leads"      value={data?.totalLeads ?? 0} />
                <StatMini label="Won"              value={data?.won ?? 0} />
                <StatMini label="Conversion Rate"  value={`${data?.conversionRate ?? 0}%`} />
                <StatMini label="Revenue"          value={fmt(data?.revenue ?? 0)} />
              </>
            )}
          </div>

          {/* Pipeline chart */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Lead Pipeline</h3>
            {loading ? (
              <Skeleton className="h-44" />
            ) : data?.totalLeads === 0 ? (
              <Empty text="No leads yet" />
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={chartData} barSize={28} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip
                    formatter={(v) => [v, 'Leads']}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #E2E8F0' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Manpower requests */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Manpower Requests {!loading && `(${data?.manpowerRequests?.total ?? 0})`}
            </h3>
            {loading ? (
              <Skeleton className="h-24" />
            ) : data?.manpowerRequests?.total === 0 ? (
              <Empty text="No manpower requests" />
            ) : (
              <div className="border border-surface-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-surface-border">
                      {['Date', 'Reason / Project', 'Type'].map((h) => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {data?.manpowerRequests?.list.map((r, i) => (
                      <tr key={i} className="hover:bg-surface-bg">
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                        <td className="px-3 py-2 text-slate-700 max-w-[160px] truncate">{r.reason || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                            r.employeeType === 'inhouse'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {r.employeeType}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Recent activity */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Recent Activity</h3>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : !data?.recentActivity?.length ? (
              <Empty text="No activity yet" />
            ) : (
              <div className="space-y-3">
                {data.recentActivity.map((entry, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 leading-snug">{entry.action}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {entry.leadTitle} · {fmtTime(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
