import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import api from '../api/index'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Invalid or missing verification token.')
      return
    }

    const verify = async () => {
      try {
        const { data } = await api.get(`/auth/verify/${token}`)
        setStatus('success')
        setMessage(data.message || 'Email verified successfully! You can now log in.')
      } catch (err) {
        setStatus('error')
        setMessage(err.response?.data?.message || err.message || 'Verification failed.')
      }
    }

    verify()
  }, [token])

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-surface-border rounded-xl shadow-sm p-8 text-center">
        {status === 'loading' && (
          <div>
            <div className="mx-auto mb-4 w-12 h-12 border-4 border-brand-light border-t-brand-primary rounded-full animate-spin"></div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verifying Email...</h2>
            <p className="text-slate-600">Please wait while we verify your email address.</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verification Successful</h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <Link to="/login" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-primary hover:bg-brand-hover focus:outline-none">
              Go to Login
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verification Failed</h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <Link to="/login" className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-brand-primary bg-brand-light hover:bg-brand-light/80 focus:outline-none">
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
