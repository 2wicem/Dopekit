import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import BrandLogo from './BrandLogo'
import './css/Signup.css'

const TechnicianPending = () => {
  const navigate = useNavigate()
  const { user, logout, refreshUser } = useAuth()
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState(null)

  const isRejected = user?.technician_approval === 'rejected'
  const isPending = user?.technician_pending

  useEffect(() => {
    if (!user) {
      return
    }

    if (user.role === 'worker' && user.technician_approval === 'approved') {
      navigate('/worker', { replace: true })
      return
    }

    if (user.role === 'admin') {
      navigate('/admin', { replace: true })
      return
    }

    if (!isPending && !isRejected) {
      navigate('/Services', { replace: true })
    }
  }, [user, isPending, isRejected, navigate])

  const handleCheckStatus = async () => {
    setChecking(true)
    setStatus(null)

    try {
      const account = await refreshUser()
      if (account?.role === 'worker' && account.technician_approval === 'approved') {
        setStatus({ type: 'success', text: 'Approved! Opening your staff dashboard…' })
        setTimeout(() => navigate('/worker', { replace: true }), 800)
        return
      }
      if (account?.technician_approval === 'rejected') {
        setStatus({
          type: 'error',
          text: 'Your application was not approved. You can still book services as a client.',
        })
        return
      }
      setStatus({ type: 'info', text: 'Still under review. The salon admin will approve you soon.' })
    } catch (error) {
      setStatus({ type: 'error', text: error.message || 'Could not refresh your application status.' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="section-band section-band--alt signup-page">
      <div className="container">
        <div className="signup-card mx-auto">
          <div className="signup-card-header text-center">
            <BrandLogo size="md" />
            <h1 className="signup-title">
              {isRejected ? 'Application not approved' : 'Application under review'}
            </h1>
            <p className="signup-subtitle">
              {isRejected
                ? 'Your technician application was not approved. You can still book services as a client.'
                : 'Thanks for applying to join the Dopekit team. A salon admin must approve your account before you can manage schedules and bookings.'}
            </p>
          </div>

          <div className="signup-card-body text-center">
            {!isRejected && (
              <p className="text-muted mb-4">
                We will notify the salon when you apply. Once approved, you can open the staff
                dashboard from here or after logging in again.
              </p>
            )}

            {status && (
              <div
                className={`alert alert-${
                  status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'danger'
                }`}
              >
                {status.text}
              </div>
            )}

            <div className="d-flex flex-column flex-sm-row gap-2 justify-content-center">
              {!isRejected && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCheckStatus}
                  disabled={checking}
                >
                  {checking ? 'Checking…' : 'Check approval status'}
                </button>
              )}
              <Link to="/Services" className="btn btn-outline-primary">
                Browse services
              </Link>
              <button type="button" className="btn btn-outline-secondary" onClick={() => logout()}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default TechnicianPending
