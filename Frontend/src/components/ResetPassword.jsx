import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PASSWORD_HINT, validatePassword } from '../utils/passwordRules'
import {
  clearResetSession,
  loadResetSession,
  saveResetSession,
} from '../utils/passwordResetSession'
import { apiFetch } from '../config/api'
import BrandLogo from './BrandLogo'
import PasswordInput from './PasswordInput'
import './css/Signup.css'

const RESET_PATH = '/products/auth/reset-password/'
const FORGOT_PATH = '/products/auth/forgot-password/'

const ResetPassword = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''
  const linkValid = useMemo(() => Boolean(uid && token), [uid, token])

  const [resetSession, setResetSession] = useState(() => loadResetSession())
  const otpMode = !linkValid && Boolean(resetSession.identifier)

  const [form, setForm] = useState({
    otp: '',
    password: '',
    confirm_password: '',
  })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!linkValid) {
      setResetSession(loadResetSession())
    }
  }, [linkValid, location.key])

  const maskedDestination =
    location.state?.maskedDestination || resetSession.maskedDestination || ''

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((current) => ({
      ...current,
      [name]: name === 'otp' ? value.replace(/\D/g, '').slice(0, 6) : value,
    }))
  }

  const handleResend = async () => {
    if (!resetSession.identifier) {
      return
    }

    setResending(true)
    setStatus(null)

    try {
      const response = await apiFetch(FORGOT_PATH, {
        method: 'POST',
        body: JSON.stringify({
          channel: resetSession.channel,
          identifier: resetSession.identifier,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not resend code.')
      }

      saveResetSession({
        identifier: resetSession.identifier,
        channel: resetSession.channel,
        maskedDestination: data.masked_destination || maskedDestination,
      })

      setStatus({
        type: 'success',
        message: data.message,
        debugOtp: data.debug_otp,
      })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)

    const passwordError = validatePassword(form.password)
    if (passwordError) {
      setStatus({ type: 'error', message: passwordError })
      setLoading(false)
      return
    }

    if (form.password !== form.confirm_password) {
      setStatus({ type: 'error', message: 'Passwords do not match.' })
      setLoading(false)
      return
    }

    if (otpMode && form.otp.length !== 6) {
      setStatus({ type: 'error', message: 'Enter the 6-digit code.' })
      setLoading(false)
      return
    }

    try {
      const payload = otpMode
        ? {
            channel: resetSession.channel,
            identifier: resetSession.identifier,
            otp: form.otp,
            password: form.password,
            confirm_password: form.confirm_password,
          }
        : {
            uid,
            token,
            password: form.password,
            confirm_password: form.confirm_password,
          }

      const response = await apiFetch(RESET_PATH, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not reset password.')
      }

      clearResetSession()
      setStatus({ type: 'success', message: data.message })
      setTimeout(() => navigate('/login'), 1200)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const title = linkValid ? 'Choose a new password' : 'Enter your reset code'
  const subtitle = linkValid
    ? PASSWORD_HINT
    : maskedDestination
      ? `We sent a 6-digit code to ${maskedDestination}.`
      : 'Enter the 6-digit code we sent you, then choose a new password.'

  return (
    <section className="section-band section-band--alt signup-page">
      <div className="container">
        <div className="signup-card mx-auto">
          <div className="signup-card-header text-center">
            <BrandLogo size="md" />
            <h1 className="signup-title">{title}</h1>
            <p className="signup-subtitle">{subtitle}</p>
          </div>

          <div className="signup-card-body">
            {!linkValid && !otpMode ? (
              <div className="alert alert-danger">
                Start from the forgot password page to request a reset code, or open the link from
                your email.
              </div>
            ) : (
              <>
                {status && (
                  <div className={`alert alert-${status.type === 'success' ? 'success' : 'danger'}`}>
                    {status.message}
                    {status.debugOtp && (
                      <p className="signup-debug-link mb-0 mt-2">Dev code: {status.debugOtp}</p>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="signup-form">
                  {otpMode && (
                    <div className="mb-3">
                      <label htmlFor="reset-otp" className="form-label">
                        Reset code
                      </label>
                      <input
                        id="reset-otp"
                        name="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="form-control signup-input reset-otp-input"
                        value={form.otp}
                        onChange={handleChange}
                        placeholder="000000"
                        minLength={6}
                        maxLength={6}
                        pattern="[0-9]{6}"
                        required
                      />
                      <div className="reset-resend-row">
                        <button
                          type="button"
                          className="btn btn-link signup-link reset-resend-btn"
                          onClick={handleResend}
                          disabled={resending || loading}
                        >
                          {resending ? 'Sending…' : 'Resend code'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="reset-password" className="form-label">
                      New password
                    </label>
                    <PasswordInput
                      id="reset-password"
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <p className="signup-password-hint">{PASSWORD_HINT}</p>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="reset-confirm" className="form-label">
                      Confirm password
                    </label>
                    <PasswordInput
                      id="reset-confirm"
                      name="confirm_password"
                      value={form.confirm_password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary w-100 signup-submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Update password'}
                  </button>
                </form>
              </>
            )}

            <p className="signup-footer-text text-center mb-0">
              <Link to="/forgot-password" className="signup-link">
                Request a new code
              </Link>
              {' · '}
              <Link to="/login" className="signup-link">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ResetPassword
