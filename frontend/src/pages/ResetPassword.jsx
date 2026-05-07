import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import api from '../api/index'

export default function ResetPassword() {
  const [searchParams]          = useSearchParams()
  const navigate                = useNavigate()
  const token                   = searchParams.get('token') || ''
  const userId                  = searchParams.get('id') || ''

  const [form, setForm]         = useState({ newPassword: '', confirmPassword: '' })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, userId, newPassword: form.newPassword })
      navigate('/login?reset=1')
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  if (!token || !userId) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-slate-600 text-sm mb-4">Invalid or missing reset link.</p>
          <Link to="/forgot-password" className="text-brand-primary font-medium hover:text-brand-hover text-sm">Request a new one</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 bg-brand-primary rounded-md flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
          </div>
          <span className="text-slate-900 text-lg font-bold tracking-tight">SalesPilot</span>
        </div>

        <div className="bg-white border border-surface-border rounded-xl shadow-sm p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Set new password</h2>
            <p className="text-sm text-slate-500 mt-1">Choose a strong password for your account.</p>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New password"
              type="password"
              placeholder="••••••••"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              placeholder="••••••••"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              required
            />
            <Button type="submit" variant="primary" size="md" loading={loading} className="w-full justify-center">
              Reset password
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          <Link to="/login" className="text-brand-primary font-medium hover:text-brand-hover">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
