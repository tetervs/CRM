const statusStyles = {
  'New':           'bg-blue-100 text-blue-700',
  'Contacted':     'bg-amber-100 text-amber-700',
  'Proposal Sent': 'bg-violet-100 text-violet-700',
  'Won':           'bg-emerald-100 text-emerald-700',
  'Lost':          'bg-red-100 text-red-700',
}

const dotColors = {
  'New':           'bg-status-new',
  'Contacted':     'bg-status-contacted',
  'Proposal Sent': 'bg-status-proposal',
  'Won':           'bg-status-won',
  'Lost':          'bg-status-lost',
}

export function Badge({ status, className = '' }) {
  const style = statusStyles[status] || 'bg-slate-100 text-slate-600'
  const dot = dotColors[status] || 'bg-slate-400'

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  )
}
