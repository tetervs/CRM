export function Card({ title, action, children, className = '' }) {
  return (
    <div className={`bg-surface-card border border-surface-border rounded-xl shadow-sm ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className="p-5">
        {children}
      </div>
    </div>
  )
}
