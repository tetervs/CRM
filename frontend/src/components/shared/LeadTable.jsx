import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import useAuthStore from '../../store/authStore'

const STATUSES = ['New', 'Contacted', 'Proposal Sent', 'Won', 'Lost']

const formatCurrency = (val) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function StatusDropdown({ lead, onStatusChange }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!btnRef.current?.contains(e.target) && !document.getElementById('status-dropdown-portal')?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = (e) => {
    e.stopPropagation()
    const rect = btnRef.current.getBoundingClientRect()
    setCoords({ top: rect.bottom + 4, left: rect.left })
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
        title="Change status"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        Stage
      </button>

      {open && createPortal(
        <div
          id="status-dropdown-portal"
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 9999 }}
          className="w-44 bg-white border border-surface-border rounded-lg shadow-xl py-1"
        >
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={(e) => {
                e.stopPropagation()
                onStatusChange?.(lead._id, s)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-bg transition-colors flex items-center gap-2 ${lead.status === s ? 'font-semibold text-brand-primary' : 'text-slate-700'}`}
            >
              {lead.status === s
                ? <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                : <span className="w-3 shrink-0" />
              }
              {s}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

export function LeadTable({ leads = [], onEdit, onDelete, onStatusChange, onDuplicate }) {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm font-medium">No leads found</p>
        <p className="text-xs mt-1">Add your first lead to get started</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border">
            {['Lead', 'Contact', 'Deal Value', 'Status', 'Owner', 'Created', 'Actions'].map((col) => (
              <th
                key={col}
                className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-border">
          {leads.map((lead) => (
            <tr
              key={lead._id}
              onClick={() => navigate(`/leads/${lead._id}`)}
              className="hover:bg-surface-bg transition-colors group cursor-pointer"
            >
              <td className="px-4 py-3">
                <span className="font-medium text-slate-900 group-hover:text-brand-primary transition-colors">
                  {lead.title}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <div>{lead.contactName}</div>
                {lead.contactEmail && (
                  <div className="text-xs text-slate-400">{lead.contactEmail}</div>
                )}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">
                {formatCurrency(lead.dealValue)}
              </td>
              <td className="px-4 py-3">
                <Badge status={lead.status} />
              </td>
              <td className="px-4 py-3 text-slate-600">
                {lead.owner?.name || '—'}
              </td>
              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                {lead.createdAt ? formatDate(lead.createdAt) : '—'}
              </td>
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <StatusDropdown lead={lead} onStatusChange={onStatusChange} />

                  <button
                    onClick={(e) => { e.stopPropagation(); onDuplicate?.(lead) }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                    title="Duplicate lead"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit?.(lead) }}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                    title="Edit lead"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>

                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete?.(lead._id) }}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors"
                      title="Delete lead"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
