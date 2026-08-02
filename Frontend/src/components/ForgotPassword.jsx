import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { apiFetch } from '../config/api'
import { saveResetSession } from '../utils/passwordResetSession'
import './css/Signup.css'

const FORGOT_PATH = '/products/auth/forgot-password/'
const DEV_CONFIRM_REDIRECT_MS = 12000
const CONFIRM_REDIRECT_MS = 6000

const toResetPath = (url) => {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

const ForgotPassword = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialChannel = searchParams.get('channel') === 'email' ? 'email' : 'phone'
  const [channel, setChannel] = useState(initialChannel)
  const [identifier, setIdentifier] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const redirectTimerRef = useRef(null)

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current)
      redirectTimerRef.current = null
    }
  }, [])

  useEffect(() => clearRedirectTimer, [clearRedirectTimer])

  const continueToReset = useCallback(
    (maskedDestination) => {
      clearRedirectTimer()
      navigate('/reset-password', {
        state: {
          channel,
          maskedDestination,
        },
      })
    },
    [channel, clearRedirectTimer, navigate]
  )

  const handleChannelChange = (nextChannel) => {
    clearRedirectTimer()
    setChannel(nextChannel)
    setIdentifier('')
    setStatus(null)
    setCodeSent(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)
    setCodeSent(false)
    clearRedirectTimer()

    const trimmed = identifier.trim()
    const payload = {
      channel,
      identifier: channel === 'email' ? trimmed.toLowerCase() : trimmed,
    }

    try {
      const response = await apiFetch(FORGOT_PATH, {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not send reset code.')
      }

      saveResetSession({
        identifier: payload.identifier,
        channel,
        maskedDestination: data.masked_destination || '',
      })

      const isDevDelivery = Boolean(data.debug_otp || data.debug_reset_link)
      const maskedDestination = data.masked_destination || ''

      setStatus({
        type: 'success',
        message: data.message,
        debugOtp: data.debug_otp,
        debugLink: data.debug_reset_link,
        maskedDestination,
        redirectMs: isDevDelivery ? DEV_CONFIRM_REDIRECT_MS : CONFIRM_REDIRECT_MS,
      })
      setCodeSent(true)

      redirectTimerRef.current = setTimeout(() => {
        continueToReset(maskedDestination)
      }, isDevDelivery ? DEV_CONFIRM_REDIRECT_MS : CONFIRM_REDIRECT_MS)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="section-band section-band--alt signup-page">
      <div className="container">
        <div className="signup-card mx-auto">
          <div className="signup-card-header text-center">
            <BrandLogo size="md" />
            <h1 className="signup-title">Forgot password</h1>
            <p className="signup-subtitle">
              Enter the phone number on your account and we will text you a one-time code. Email
              reset is also available.
            </p>
          </div>

          <div className="signup-card-body">
            {status && (
              <div className={`alert alert-${status.type === 'success' ? 'success' : 'danger'}`}>
                {status.message}
                {status.maskedDestination && (
                  <p className="mb-0 mt-2">Sent to {status.maskedDestination}.</p>
                )}
                {status.debugOtp && (
                  <p className="signup-debug-link mb-0 mt-2">
                    <strong>Dev code:</strong> {status.debugOtp}
                  </p>
                )}
                {status.debugLink && (
                  <p className="signup-debug-link mb-0 mt-2">
                    Dev link:{' '}
                    <Link to={toResetPath(status.debugLink)} className="signup-link">
                      Reset password
                    </Link>
                  </p>
                )}
                {codeSent && status.type === 'success' && (
                  <>
                    <p className="signup-confirm-hint mb-0 mt-2">
                      {status.debugOtp
                        ? `You will be redirected in ${Math.round(status.redirectMs / 1000)} seconds. Copy the code first if you need it.`
                        : `Continuing in ${Math.round(status.redirectMs / 1000)} seconds…`}
                    </p>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-light mt-3"
                      onClick={() => continueToReset(status.maskedDestination)}
                    >
                      Enter code now
                    </button>
                  </>
                )}
              </div>
            )}

            {!codeSent && (
              <>
                <div className="reset-channel-toggle" role="tablist" aria-label="Reset method">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={channel === 'phone'}
                    className={`reset-channel-btn${channel === 'phone' ? ' is-active' : ''}`}
                    onClick={() => handleChannelChange('phone')}
                  >
                    SMS to phone
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={channel === 'email'}
                    className={`reset-channel-btn${channel === 'email' ? ' is-active' : ''}`}
                    onClick={() => handleChannelChange('email')}
                  >
                    Email code
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="signup-form">
                  <div className="mb-4">
                    <label htmlFor="forgot-identifier" className="form-label">
                      {channel === 'phone' ? 'Phone number' : 'Email'}
                    </label>
                    <input
                      type={channel === 'phone' ? 'tel' : 'email'}
                      className="form-control signup-input"
                      id="forgot-identifier"
                      name="identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete={channel === 'phone' ? 'tel' : 'email'}
                      placeholder={channel === 'phone' ? 'e.g. 0712345678' : 'you@example.com'}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary w-100 signup-submit" disabled={loading}>
                    {loading ? 'Sending...' : 'Send reset code'}
                  </button>
                </form>
              </>
            )}

            <p className="signup-footer-text text-center mb-0">
              Remembered it?{' '}
              <Link to="/login" className="signup-link">
                Back to log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ForgotPassword
