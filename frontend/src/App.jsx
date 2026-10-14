import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'
import useNotificationStore from './store/notificationStore'

import Login from './pages/Login'
import ChangePasswordFirst from './pages/ChangePasswordFirst'
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
import FisTracker from './pages/FisTracker'
import FisCaseDetail from './pages/FisCaseDetail'
import FisDashboard from './pages/FisDashboard'
import FisReport from './pages/FisReport'
import FisSettings from './pages/FisSettings'

const FH_ADMIN           = ['head', 'admin', 'ca']
const FH_ADMIN_MGR       = ['head', 'admin', 'manager', 'ca']
const FH_ADMIN_MGR_SALES = ['head', 'admin', 'manager', 'sales', 'ca']
const NOT_EMPLOYEE       = ['head', 'admin', 'manager', 'sales', 'ca']

// Employees can't see /dashboard, so their "home"/fallback route is Projects instead.
const getHomeRoute = (role) => (role === 'employee' ? '/projects' : '/dashboard')

function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  if (!initialized) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to={getHomeRoute(user?.role)} replace />
  return children
}

// FIS pages key off user.fisRole only (never user.role). Backend enforces the same.
function FisRoute({ children, admin = false }) {
  const { isAuthenticated, initialized, user } = useAuthStore()
  if (!initialized) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  const allowed = admin ? user?.fisRole === 'fis_admin' : !!user?.fisRole
  if (!allowed) return <Navigate to={getHomeRoute(user?.role)} replace />
  return children
}

// Force-password-change screen. Only reachable while authenticated AND flagged;
// once the password is changed the flag clears and this bounces to dashboard.
function ChangePasswordRoute() {
  const { isAuthenticated, initialized, user } = useAuthStore()
  if (!initialized) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.mustChangePassword) return <Navigate to="/dashboard" replace />
  return <ChangePasswordFirst />
}

export default function App() {
  const { loadFromStorage, fetchMe, isAuthenticated, user } = useAuthStore()
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
        <Route path="/change-password"  element={<ChangePasswordRoute />} />

        <Route path="/dashboard" element={
          <ProtectedRoute roles={NOT_EMPLOYEE}><Dashboard /></ProtectedRoute>
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

        <Route path="/fis" element={<FisRoute><FisTracker /></FisRoute>} />
        <Route path="/fis/cases/:id" element={<FisRoute><FisCaseDetail /></FisRoute>} />
        <Route path="/fis/dashboard" element={<FisRoute admin><FisDashboard /></FisRoute>} />
        <Route path="/fis/report" element={<FisRoute admin><FisReport /></FisRoute>} />
        <Route path="/fis/settings" element={<FisRoute admin><FisSettings /></FisRoute>} />

        <Route path="/"  element={<Navigate to={getHomeRoute(user?.role)} replace />} />
        <Route path="*"  element={<Navigate to={getHomeRoute(user?.role)} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
