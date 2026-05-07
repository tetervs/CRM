import { useEffect } from 'react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { StatCard } from '../components/ui/StatCard'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import useLeadStore from '../store/leadStore'

const STATUSES = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']

const STATUS_COLORS = {
  'New': 'bg-status-new',
  'Contacted': 'bg-status-contacted',
  'Proposal Sent': 'bg-status-proposal',
  'Won': 'bg-status-won',
  'Lost': 'bg-status-lost',
}

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(val)

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function Dashboard() {
  const { leads, fetchLeads } = useLeadStore()

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const totalRevenue = leads.filter((l) => l.status === 'Won').reduce((s, l) => s + l.dealValue, 0)
  const wonCount = leads.filter((l) => l.status === 'Won').length
  const conversionRate = leads.length ? Math.round((wonCount / leads.length) * 100) : 0
  const activeDeals = leads.filter((l) => !['Won', 'Lost'].includes(l.status)).length

  // Pipeline counts per status
  const pipelineCounts = STATUSES.map((s) => ({
    status: s,
    count: leads.filter((l) => l.status === s).length,
  }))
  const maxCount = Math.max(...pipelineCounts.map((p) => p.count), 1)

  // Recent activity — last 5 leads by createdAt
  const recent = [...leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)

  return (
    <PageWrapper>
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Leads"
          value={leads.length}
          trend={12}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <StatCard
          label="Revenue Won"
          value={formatCurrency(totalRevenue)}
          trend={8}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          trend={-3}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
        <StatCard
          label="Active Deals"
          value={activeDeals}
          trend={5}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline summary */}
        <Card title="Pipeline Overview" className="lg:col-span-2">
          <div className="space-y-3">
            {pipelineCounts.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-28 shrink-0">{status}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${STATUS_COLORS[status]} transition-all duration-500`}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent activity */}
        <Card title="Recent Leads">
          <div className="space-y-3">
            {recent.map((lead) => (
              <div key={lead._id} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-light text-brand-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {lead.title[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{lead.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge status={lead.status} />
                    <span className="text-xs text-slate-400">{formatDate(lead.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageWrapper>
  )
}
