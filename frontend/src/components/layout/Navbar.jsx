import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useNotificationStore from '../../store/notificationStore'

const pageTitles = {
  '/dashboard':      'Dashboard',
  '/pipeline':       'Pipeline',
  '/leads':          'Leads',
  '/team':           'Team',
  '/employees':      'Employees',
  '/manpower':       'Manpower',
  '/projects':       'Projects',
  '/reimbursements': 'Reimbursements',
  '/analytics':      'Analytics',
  '/departments':    'Departments',
}

const relativeTime = (date) => {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { notifications, unreadCount, fetchNotifications, markRead, markAllRead } = useNotificationStore()

  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const title = pageTitles[pathname] ||
    (pathname.startsWith('/leads/')          ? 'Lead Detail' :
     pathname.startsWith('/projects/')       ? 'Project Detail' :
     pathname.startsWith('/reimbursements/') ? 'Reimbursement' : 'SalesPilot')

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleBellClick = () => {
    if (!open) fetchNotifications()
    setOpen((v) => !v)
  }

  const handleNotificationClick = (n) => {
    if (!n.isRead) markRead(n._id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const recent = notifications.slice(0, 10)

  return (
    <header className="h-14 bg-surface-card border-b border-surface-border flex items-center justify-between px-6 shrink-0">
      <h1 className="text-base font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-1.5 text-sm bg-surface-bg border border-surface-border rounded-md text-slate-600 placeholder-slate-400 focus:outline-none focus:border-brand-primary w-52"
          />
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={ref}>
          <button
            onClick={handleBellClick}
            className="relative w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-10 w-80 bg-white border border-surface-border rounded-xl shadow-xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
                <span className="text-sm font-semibold text-slate-900">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="text-xs text-brand-primary hover:text-brand-hover font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-surface-border">
                {recent.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</div>
                ) : (
                  recent.map((n) => (
                    <button
                      key={n._id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-surface-bg transition-colors flex items-start gap-2.5 ${!n.isRead ? 'bg-brand-light/40' : ''}`}
                    >
                      <div className="w-2 shrink-0 mt-1">
                        {!n.isRead && <div className="w-2 h-2 rounded-full bg-brand-primary" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-700 leading-snug">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{relativeTime(n.createdAt)}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-semibold">
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  )
}
