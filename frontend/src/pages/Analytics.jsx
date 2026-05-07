import { useEffect, useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Card } from '../components/ui/Card'
import api from '../api/index'
import useAuthStore from '../store/authStore'

const STATUS_COLORS = {
  'New': '#3B82F6',
  'Contacted': '#F59E0B',
  'Proposal Sent': '#8B5CF6',
  'Won': '#10B981',
  'Lost': '#EF4444',
}

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 0 }).format(val)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-surface-border rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs text-slate-600">
          {p.name}: <span className="font-semibold" style={{ color: p.color }}>{typeof p.value === 'number' && p.value > 999 ? formatCurrency(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { user } = useAuthStore()
  const [pipelineData, setPipelineData] = useState([])
  const [trendData, setTrendData] = useState([])
  const [performers, setPerformers] = useState([])

  useEffect(() => {
    const requests = [
      api.get('/analytics/pipeline'),
      api.get('/analytics/trend'),
    ]
    if (user?.role === 'admin') requests.push(api.get('/analytics/performance'))

    Promise.all(requests).then(([pipe, trend, perf]) => {
      setPipelineData(pipe.data.map((d) => ({ status: d.status, count: d.count })))
      setTrendData(trend.data)
      if (perf) setPerformers(perf.data.map((p) => ({ name: p.user.name, leads: p.totalLeads, won: p.won, revenue: p.revenue })))
    }).catch(() => {})
  }, [user?.role])

  const pieData = pipelineData.filter((d) => d.count > 0)

  return (
    <PageWrapper>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Bar: leads per stage */}
        <Card title="Leads by Stage">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pipelineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                {pipelineData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Pie: conversion breakdown */}
        <Card title="Status Breakdown">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={40}
                paddingAngle={3}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Line: revenue trend */}
      <Card title="Revenue Trend (Last 6 Months)" className="mb-4">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#6366F1"
              strokeWidth={2}
              dot={{ fill: '#6366F1', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Top performers — admin only */}
      {user?.role === 'admin' && (
        <Card title="Top Performers">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {['Rep', 'Total Leads', 'Won', 'Revenue'].map((col) => (
                  <th key={col} className="text-left pb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide pr-6">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {performers.map((p, i) => (
                <tr key={p.name} className="hover:bg-surface-bg transition-colors">
                  <td className="py-3 pr-6">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-brand-light text-brand-primary text-xs font-bold flex items-center justify-center">
                        {p.name[0]}
                      </div>
                      <div>
                        <span className="font-medium text-slate-900">{p.name}</span>
                        {i === 0 && <span className="ml-2 text-xs text-amber-600 font-medium">Top rep</span>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-6 text-slate-700">{p.leads}</td>
                  <td className="py-3 pr-6 text-slate-700">{p.won}</td>
                  <td className="py-3 font-semibold text-slate-900">{formatCurrency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageWrapper>
  )
}
