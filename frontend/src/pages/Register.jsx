import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import useAuthStore from '../store/authStore'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'employee' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const { register } = useAuthStore()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
    setErrors((err) => ({ ...err, [e.target.name]: '' }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.email.trim()) e.email = 'Email is required.'
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters.'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match.'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const e2 = validate()
    if (Object.keys(e2).length) { setErrors(e2); return }
    setLoading(true)
    try {
      const data = await register({ name: form.name, email: form.email, password: form.password, role: form.role })
      setSuccess(data.message || 'Account created! Please check your email to verify your account.')
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.response?.data?.message || err.message
      setErrors({ general: msg || 'Registration failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
        <div className="max-w-md bg-white border border-surface-border rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h2>
          <p className="text-slate-600 mb-6">{success}</p>
          <Link to="/login" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-brand-hover focus:outline-none">
            Go to Login
          </Link>
        </div>
      </div>
    )
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
            <h2 className="text-xl font-bold text-slate-900">Create account</h2>
            <p className="text-sm text-slate-500 mt-1">Join your team on SalesPilot.</p>
          </div>

          {errors.general && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Full name" name="name" placeholder="Jane Smith" value={form.name} onChange={handleChange} error={errors.name} required />
            <Input label="Email" name="email" type="email" placeholder="jane@in-quest.co.in" value={form.email} onChange={handleChange} error={errors.email} required />
            <Input label="Password" name="password" type="password" placeholder="••••••••" value={form.password} onChange={handleChange} error={errors.password} required />
            <Input label="Confirm password" name="confirm" type="password" placeholder="••••••••" value={form.confirm} onChange={handleChange} error={errors.confirm} required />

            {/* Role selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">Role</label>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-md border border-surface-border bg-white text-slate-900 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-light"
              >
                <option value="employee">Employee</option>
                <option value="sales">Sales</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <Button type="submit" variant="primary" size="md" loading={loading} className="w-full justify-center">
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-primary font-medium hover:text-brand-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
