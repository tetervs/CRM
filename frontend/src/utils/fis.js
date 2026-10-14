const TZ = 'Asia/Kolkata'

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

// YYYY-MM-DD in IST, for <input type="date"> values
export const toInputDate = (d) => (d ? new Date(d).toLocaleDateString('en-CA', { timeZone: TZ }) : '')

export const DEADLINE_STYLE = {
  'Overdue': 'bg-red-100 text-red-700',
  'Due soon': 'bg-orange-100 text-orange-700',
  'On track': 'bg-emerald-100 text-emerald-700',
  'No deadline': 'bg-slate-100 text-slate-500',
  'Closed': 'bg-slate-200 text-slate-600',
}

export const ROW_STYLE = (c) =>
  c.closed ? 'bg-slate-100 text-slate-500'
    : c.deadlineStatus === 'Overdue' ? 'bg-red-50'
    : c.deadlineStatus === 'Due soon' ? 'bg-orange-50'
    : ''

export const isFisAdmin = (user) => user?.fisRole === 'fis_admin'
