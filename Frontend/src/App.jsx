import About from "./components/About"

import AdminPanel from "./components/AdminPanel"

import Contact from "./components/Contact"

import Footer from "./components/Footer"

import Landing from "./components/Landing"

import Login from "./components/Login"

import ForgotPassword from "./components/ForgotPassword"

import ResetPassword from "./components/ResetPassword"

import MyBookings from "./components/MyBookings"

import Profile from "./components/Profile"

import OwnerPanel from "./components/OwnerPanel"

import Navbar from "./components/Navbar"

import ProtectedRoute from "./components/ProtectedRoute"

import Services from "./components/Services"

import SalonDetail from "./components/SalonDetail"

import Signup from "./components/Signup"

import TechnicianPending from "./components/TechnicianPending"

import WorkerDashboard from "./components/WorkerDashboard"

import { AuthProvider } from "./context/AuthContext"

import { Routes, Route, useLocation } from 'react-router-dom'



const AppShell = () => {

  const location = useLocation()

  const isWorkerApp = location.pathname === '/worker'
  const isAdminApp = location.pathname === '/admin'
  const isOwnerApp = location.pathname === '/owner'



  return (

    <>

      {!isWorkerApp && !isAdminApp && !isOwnerApp && <Navbar />}

      <Routes>

        <Route path='/' element={<Landing />} />

        <Route path='/Services' element={<Services />} />

        <Route path='/salons/:slug' element={<SalonDetail />} />

        <Route path='/About' element={<About />} />

        <Route path='/Contact' element={<Contact />} />

        <Route path='/signup' element={<Signup />} />

        <Route path='/login' element={<Login />} />

        <Route path='/forgot-password' element={<ForgotPassword />} />

        <Route path='/reset-password' element={<ResetPassword />} />

        <Route
          path='/technician-pending'
          element={
            <ProtectedRoute>
              <TechnicianPending />
            </ProtectedRoute>
          }
        />

        <Route
          path='/profile'
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path='/my-bookings'
          element={
            <ProtectedRoute roles={['client']}>
              <MyBookings />
            </ProtectedRoute>
          }
        />

        <Route

          path='/worker'

          element={

            <ProtectedRoute roles={['worker', 'admin']}>

              <WorkerDashboard />

            </ProtectedRoute>

          }

        />

        <Route

          path='/admin'

          element={

            <ProtectedRoute roles={['admin']}>

              <AdminPanel />

            </ProtectedRoute>

          }

        />

        <Route
          path='/owner'
          element={
            <ProtectedRoute roles={['salon_owner']}>
              <OwnerPanel />
            </ProtectedRoute>
          }
        />

      </Routes>

      {!isWorkerApp && !isAdminApp && !isOwnerApp && <Footer />}

    </>

  )

}



const App = () => {

  return (

    <AuthProvider>

      <AppShell />

    </AuthProvider>

  )

}



export default App

