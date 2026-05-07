import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'
import useNotificationStore from './store/notificationStore'

import Login from './pages/Login'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'
import Dashboard from './pages/Dashboard'
import Pipeline from './pages/Pipeline'
import Leads from './pages/Leads'
import LeadDetail from './pages/LeadDetail'
import Team from './pages/Team'
import Employees from './pages/Employees'
import Analytics from './pages/Analytics'
import Manpower from './pages/Manpower'
import Departments from './pages/Departments'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Reimbursements from './pages/Reimbursements'
import NewReimbursement from './pages/NewReimbursement'
import ReimbursementDetail from './pages/ReimbursementDetail'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'

const FH_ADMIN           = ['finance_head', 'admin']
const FH_ADMIN_MGR       = ['finance_head', 'admin', 'manager']
const FH_ADMIN_MGR_SALES = ['finance_head', 'admin', 'manager', 'sales']

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  if (!initialized) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const { loadFromStorage, fetchMe, isAuthenticated } = useAuthStore()
  const { startPolling, stopPolling } = useNotificationStore()

  useEffect(() => {
    loadFromStorage()
    fetchMe()
  }, [loadFromStorage, fetchMe])

  useEffect(() => {
    if (isAuthenticated) {
      startPolling()
    } else {
      stopPolling()
    }
    return () => stopPolling()
  }, [isAuthenticated, startPolling, stopPolling])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"            element={<Login />} />
        <Route path="/register"         element={<Register />} />
        <Route path="/verify-email"     element={<VerifyEmail />} />
        <Route path="/forgot-password"  element={<ForgotPassword />} />
        <Route path="/reset-password"   element={<ResetPassword />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        <Route path="/pipeline" element={
          <ProtectedRoute roles={FH_ADMIN_MGR_SALES}><Pipeline /></ProtectedRoute>
        } />
        <Route path="/leads" element={
          <ProtectedRoute roles={FH_ADMIN_MGR_SALES}><Leads /></ProtectedRoute>
        } />
        <Route path="/leads/:id" element={
          <ProtectedRoute roles={FH_ADMIN_MGR_SALES}><LeadDetail /></ProtectedRoute>
        } />

        <Route path="/team" element={
          <ProtectedRoute roles={FH_ADMIN_MGR}><Team /></ProtectedRoute>
        } />
        <Route path="/employees" element={
          <ProtectedRoute><Employees /></ProtectedRoute>
        } />
        <Route path="/manpower" element={
          <ProtectedRoute roles={FH_ADMIN}><Manpower /></ProtectedRoute>
        } />

        <Route path="/projects" element={
          <ProtectedRoute><Projects /></ProtectedRoute>
        } />
        <Route path="/projects/:id" element={
          <ProtectedRoute><ProjectDetail /></ProtectedRoute>
        } />

        <Route path="/reimbursements" element={
          <ProtectedRoute><Reimbursements /></ProtectedRoute>
        } />
        <Route path="/reimbursements/new" element={
          <ProtectedRoute><NewReimbursement /></ProtectedRoute>
        } />
        <Route path="/reimbursements/:id" element={
          <ProtectedRoute><ReimbursementDetail /></ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute roles={FH_ADMIN}><Analytics /></ProtectedRoute>
        } />
        <Route path="/departments" element={
          <ProtectedRoute roles={FH_ADMIN}><Departments /></ProtectedRoute>
        } />

        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
        <Route path="*"  element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
