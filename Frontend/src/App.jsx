import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

const About = lazy(() => import('./components/About'))
const AdminPanel = lazy(() => import('./components/AdminPanel'))
const Contact = lazy(() => import('./components/Contact'))
const DiscoverSalonsTechnicians = lazy(() => import('./components/DiscoverSalonsTechnicians'))
const ForgotPassword = lazy(() => import('./components/ForgotPassword'))
const Landing = lazy(() => import('./components/Landing'))
const Login = lazy(() => import('./components/Login'))
const MyBookings = lazy(() => import('./components/MyBookings'))
const OwnerPanel = lazy(() => import('./components/OwnerPanel'))
const Profile = lazy(() => import('./components/Profile'))
const ResetPassword = lazy(() => import('./components/ResetPassword'))
const SalonDetail = lazy(() => import('./components/SalonDetail'))
const Services = lazy(() => import('./components/Services'))
const Signup = lazy(() => import('./components/Signup'))
const TechnicianPending = lazy(() => import('./components/TechnicianPending'))
const WorkerDashboard = lazy(() => import('./components/WorkerDashboard'))

const RouteFallback = ({ compact = false }) => (
  <div className={compact ? 'worker-app' : 'section-band section-band--base'}>
    <p className={compact ? 'worker-app-loading' : 'container py-5 text-center text-muted'}>
      Loading…
    </p>
  </div>
)

const AppShell = () => {
  const location = useLocation()
  const isWorkerApp = location.pathname === '/worker'
  const isAdminApp = location.pathname === '/admin'
  const isOwnerApp = location.pathname === '/owner'
  const compact = isWorkerApp || isAdminApp || isOwnerApp

  return (
    <>
      {!compact && <Navbar />}
      <Suspense fallback={<RouteFallback compact={compact} />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/Services" element={<Services />} />
          <Route path="/Services/discover" element={<DiscoverSalonsTechnicians />} />
          <Route path="/salons/:slug" element={<SalonDetail />} />
          <Route path="/About" element={<About />} />
          <Route path="/Contact" element={<Contact />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/technician-pending"
            element={
              <ProtectedRoute>
                <TechnicianPending />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute roles={['client']}>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/worker"
            element={
              <ProtectedRoute roles={['worker', 'admin']}>
                <WorkerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner"
            element={
              <ProtectedRoute roles={['salon_owner']}>
                <OwnerPanel />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      {!compact && <Footer />}
    </>
  )
}

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  </ThemeProvider>
)

export default App
