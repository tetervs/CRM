export function StatCard({ label, value, icon, trend, color = 'brand-primary' }) {
  const isPositive = trend > 0
  const isNegative = trend < 0

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-brand-light text-brand-primary`}>
            {icon}
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div className="mt-3 flex items-center gap-1">
          {isPositive && (
            <svg className="w-3.5 h-3.5 text-status-won" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7 7 7" />
            </svg>
          )}
          {isNegative && (
            <svg className="w-3.5 h-3.5 text-status-lost" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7-7-7" />
            </svg>
          )}
          <span className={`text-xs font-medium ${isPositive ? 'text-status-won' : isNegative ? 'text-status-lost' : 'text-slate-500'}`}>
            {Math.abs(trend)}% vs last month
          </span>
        </div>
      )}
    </div>
  )
}
