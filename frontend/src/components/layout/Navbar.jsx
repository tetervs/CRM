import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useNotificationStore from '../../store/notificationStore'
import api from '../../api/index'

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
  const { user, logout } = useAuthStore()
  const { notifications, unreadCount, fetchNotifications, markRead, markAllRead } = useNotificationStore()

  const [open, setOpen]               = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const ref    = useRef(null)
  const userRef = useRef(null)

  const [changePwOpen, setChangePwOpen]   = useState(false)
  const [pwForm, setPwForm]               = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [pwLoading, setPwLoading]         = useState(false)
  const [pwError, setPwError]             = useState('')
  const [pwSuccess, setPwSuccess]         = useState('')

  const title = pageTitles[pathname] ||
    (pathname.startsWith('/leads/')          ? 'Lead Detail' :
     pathname.startsWith('/projects/')       ? 'Project Detail' :
     pathname.startsWith('/reimbursements/') ? 'Reimbursement' : 'SalesPilot')

  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const openChangePw = () => {
    setUserMenuOpen(false)
    setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setPwError('')
    setPwSuccess('')
    setChangePwOpen(true)
  }

  const handleChangePw = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }
    if (pwForm.newPassword.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }
    setPwLoading(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword:     pwForm.newPassword,
      })
      setPwSuccess('Password updated successfully.')
      setTimeout(() => setChangePwOpen(false), 1500)
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to update password.')
    } finally {
      setPwLoading(false)
    }
  }

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
    <>
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

        {/* Avatar + user menu */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-10 w-52 bg-white border border-surface-border rounded-xl shadow-xl z-50">
              <div className="px-4 py-3 border-b border-surface-border">
                <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={openChangePw}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Change Password
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Change Password Modal */}
    {changePwOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-slate-900">Change Password</h3>
            <button onClick={() => setChangePwOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {pwError && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{pwError}</p>
            </div>
          )}
          {pwSuccess && (
            <div className="mb-4 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-md">
              <p className="text-sm text-emerald-700">{pwSuccess}</p>
            </div>
          )}

          <form onSubmit={handleChangePw} className="space-y-4">
            {[
              { label: 'Current password',     key: 'currentPassword' },
              { label: 'New password',         key: 'newPassword' },
              { label: 'Confirm new password', key: 'confirmPassword' },
            ].map(({ label, key }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">{label}</label>
                <input
                  type="password"
                  required
                  value={pwForm[key]}
                  onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-md border border-surface-border focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
                />
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setChangePwOpen(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-md border border-surface-border text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pwLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-brand-primary text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
              >
                {pwLoading ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}
