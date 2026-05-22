import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import useAuthStore from '../store/authStore'
import api from '../api/index'

export default function ChangePasswordFirst() {
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const { updateUser, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setErrors((err) => ({ ...err, [e.target.name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = {}
    if (form.password.length < 6) e2.password = 'Password must be at least 6 characters.'
    if (form.password !== form.confirm) e2.confirm = 'Passwords do not match.'
    if (Object.keys(e2).length) { setErrors(e2); return }

    setLoading(true)
    try {
      await api.post('/auth/change-password-first-time', { newPassword: form.password })
      updateUser({ mustChangePassword: false })
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || err.message
      setErrors({ general: msg || 'Could not update password. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
            <h2 className="text-xl font-bold text-slate-900">Set a new password</h2>
            <p className="text-sm text-slate-500 mt-1">Your account uses a temporary password. Choose a new one to continue.</p>
          </div>

          {errors.general && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="New password" name="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} error={errors.password} required />
            <Input label="Confirm password" name="confirm" type="password" placeholder="••••••••" value={form.confirm} onChange={handleChange} error={errors.confirm} required />
            <Button type="submit" variant="primary" size="md" loading={loading} className="w-full justify-center">
              Update password
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          <button onClick={() => { logout(); navigate('/login') }} className="text-brand-primary font-medium hover:text-brand-hover">
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}
