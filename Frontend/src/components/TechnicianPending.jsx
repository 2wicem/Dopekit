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

  const application = user?.technician_application || {}
  const approvalStage = application.approval_stage || user?.technician_approval
  const isFreelance = application.is_freelance === true
  const isRejected = approvalStage === 'rejected'
  const isPendingOwner = approvalStage === 'pending_owner'
  const isPending = user?.technician_pending

  const pendingTitle = isRejected
    ? 'Application not approved'
    : isPendingOwner
      ? 'Waiting for salon review'
      : isFreelance
        ? 'Freelance application under review'
        : 'Waiting for platform review'

  const pendingSubtitle = isRejected
    ? 'Your technician application was not approved. You can still book services as a client.'
    : isPendingOwner
      ? `Thanks for applying to join ${application.application_salon_name || 'your salon branch'}. Your branch manager must review your application before it goes to platform admin.`
      : isFreelance
        ? 'Thanks for applying as a freelance technician. Platform admin is reviewing your profile and references.'
        : 'Your salon manager approved your application. Platform admin is doing the final verification before you can open the staff dashboard.'

  const pendingHint = isPendingOwner
    ? 'We notified your salon owner when you applied. Check back here after they review your details.'
    : isFreelance
      ? 'Freelance technicians are verified directly by platform admin. You will get access to the staff dashboard once approved.'
      : 'Final approval usually happens soon after your salon manager forwards your application.'

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
      const nextStage = account?.technician_application?.approval_stage || account?.technician_approval

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
      if (nextStage === 'pending_owner') {
        setStatus({
          type: 'info',
          text: 'Still waiting for your salon manager to review your application.',
        })
        return
      }
      setStatus({
        type: 'info',
        text: 'Still under platform review. Admin approval is the final step.',
      })
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
            <h1 className="signup-title">{pendingTitle}</h1>
            <p className="signup-subtitle">{pendingSubtitle}</p>
          </div>

          <div className="signup-card-body text-center">
            {!isRejected && (
              <p className="text-muted mb-4">{pendingHint}</p>
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
