import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'

export function KanbanCard({ lead, provided }) {
  const navigate = useNavigate()

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => navigate(`/leads/${lead._id}`)}
      className="bg-white border border-surface-border rounded-lg p-3.5 mb-2.5 shadow-sm cursor-pointer hover:shadow-md hover:border-brand-primary/30 transition-all duration-150 group"
    >
      {/* Title */}
      <h4 className="text-sm font-semibold text-slate-900 mb-1 leading-snug group-hover:text-brand-primary transition-colors">
        {lead.title}
      </h4>

      {/* Contact */}
      {lead.contactName && (
        <p className="text-xs text-slate-500 mb-2.5">{lead.contactName}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800">
          {formatCurrency(lead.dealValue)}
        </span>
        <Badge status={lead.status} />
      </div>

      {/* Owner */}
      {lead.owner?.name && (
        <div className="mt-2.5 pt-2.5 border-t border-surface-border flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-brand-light text-brand-primary text-xs font-bold flex items-center justify-center">
            {lead.owner.name[0].toUpperCase()}
          </div>
          <span className="text-xs text-slate-500">{lead.owner.name}</span>
        </div>
      )}
    </div>
  )
}
