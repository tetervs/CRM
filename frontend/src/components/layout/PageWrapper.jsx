import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Navbar } from './Navbar'
import useAuthStore from '../../store/authStore'

export function PageWrapper({ children }) {
  const { isAuthenticated, loadFromStorage, fetchMe } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  useEffect(() => {
    if (isAuthenticated) {
      fetchMe()
    } else {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, navigate, fetchMe])

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen bg-surface-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
