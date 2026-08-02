import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ACCOUNT_TYPES, parseSignupAccountType } from '../constants/accountTypes'
import { TECHNICIAN_SPECIALTIES } from '../constants/technicianSpecialties'
import { useAuth } from '../context/useAuth'
import { resolvePostAuthDestination, withRedirect } from '../utils/redirect'
import { PASSWORD_HINT, validatePassword } from '../utils/passwordRules'
import { validateUsername } from '../utils/usernameRules'
import { apiFetch } from '../config/api'
import BrandLogo from './BrandLogo'
import PasswordInput from './PasswordInput'
import './css/Signup.css'

const SIGNUP_CONFIG_PATH = '/products/auth/signup-config/'

const emptyTechnicianFields = {
  technician_invite_code: '',
  technician_specialty: '',
  technician_experience_years: '',
  technician_reference_name: '',
  technician_reference_phone: '',
  technician_application_note: '',
  staff_authorized: false,
}

const Signup = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const { register } = useAuth()
  const prefilledType = parseSignupAccountType(searchParams.get('type'))
  const [allowTechnicianSignup, setAllowTechnicianSignup] = useState(true)
  const [requireTechnicianApproval, setRequireTechnicianApproval] = useState(true)
  const [requireTechnicianInviteCode, setRequireTechnicianInviteCode] = useState(true)
  const [accountType, setAccountType] = useState('client')
  const [form, setForm] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    ...emptyTechnicianFields,
  })
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiFetch(SIGNUP_CONFIG_PATH)
      .then((response) => response.json())
      .then((data) => {
        const allowed = data.allow_technician_signup !== false
        setAllowTechnicianSignup(allowed)
        setRequireTechnicianApproval(data.require_technician_approval === true)
        setRequireTechnicianInviteCode(data.require_technician_invite_code === true)
        const nextType =
          prefilledType === 'salon_owner'
            ? 'salon_owner'
            : allowed && prefilledType === 'technician'
              ? 'technician'
              : 'client'
        setAccountType(nextType)
      })
      .catch(() => {
        setAllowTechnicianSignup(true)
        setAccountType(prefilledType === 'salon_owner' ? 'salon_owner' : prefilledType)
      })
  }, [prefilledType])

  const accountMeta = ACCOUNT_TYPES[accountType]
  const accountOptions = allowTechnicianSignup
    ? Object.values(ACCOUNT_TYPES)
    : [ACCOUNT_TYPES.client, ACCOUNT_TYPES.salon_owner]
  const isTechnicianSignup = accountType === 'technician'

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleAccountTypeChange = (nextType) => {
    setAccountType(nextType)
    setStatus(null)
    if (nextType !== 'technician') {
      setForm((current) => ({ ...current, ...emptyTechnicianFields }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)

    const usernameError = validateUsername(form.username)
    if (usernameError) {
      setStatus({ type: 'error', message: usernameError })
      setLoading(false)
      return
    }

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

    if (isTechnicianSignup) {
      if (requireTechnicianInviteCode && !form.technician_invite_code.trim()) {
        setStatus({ type: 'error', message: 'Enter the salon invite code from your manager.' })
        setLoading(false)
        return
      }
      if (!form.staff_authorized) {
        setStatus({
          type: 'error',
          message: 'Confirm that you are an authorized salon team member.',
        })
        setLoading(false)
        return
      }
    }

    const payload = {
      username: form.username.trim(),
      email: form.email,
      phone: form.phone,
      password: form.password,
      confirm_password: form.confirm_password,
      account_type: accountType,
    }

    if (isTechnicianSignup) {
      Object.assign(payload, {
        technician_invite_code: form.technician_invite_code.trim(),
        technician_specialty: form.technician_specialty,
        technician_experience_years: form.technician_experience_years,
        technician_reference_name: form.technician_reference_name.trim(),
        technician_reference_phone: form.technician_reference_phone.trim(),
        technician_application_note: form.technician_application_note.trim(),
        staff_authorized: form.staff_authorized,
      })
    }

    try {
      const data = await register(payload)
      setStatus({ type: 'success', message: data.message })
      setTimeout(() => navigate(resolvePostAuthDestination(data.user, redirectTo)), 1200)
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
            <h1 className="signup-title">Welcome to the studio</h1>
            <p className="signup-subtitle">{accountMeta.signupSubtitle}</p>
          </div>

          <div className="signup-card-body">
            {allowTechnicianSignup && (
              <div
                className="signup-account-switch"
                role="group"
                aria-label="Choose account type"
              >
                {accountOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`signup-account-option${
                      accountType === option.value ? ' is-active' : ''
                    }`}
                    aria-pressed={accountType === option.value}
                    onClick={() => handleAccountTypeChange(option.value)}
                  >
                    <span className="signup-account-option-label">{option.label}</span>
                    <span className="signup-account-option-hint">{option.shortLabel}</span>
                  </button>
                ))}
              </div>
            )}

            {status && (
              <div className={`alert alert-${status.type === 'success' ? 'success' : 'danger'}`}>
                {status.message}
              </div>
            )}

            <form onSubmit={handleSubmit} className="signup-form">
              <div className="mb-3">
                <label htmlFor="signup-username" className="form-label">
                  Username
                </label>
                <input
                  type="text"
                  className="form-control signup-input"
                  id="signup-username"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  placeholder="e.g. jane_doe"
                  minLength={3}
                  maxLength={30}
                  pattern="[a-zA-Z0-9._]{3,30}"
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="signup-email" className="form-label">
                  Email
                </label>
                <input
                  type="email"
                  className="form-control signup-input"
                  id="signup-email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="signup-phone" className="form-label">
                  Phone
                </label>
                <input
                  type="tel"
                  className="form-control signup-input"
                  id="signup-phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="e.g. 0790331108"
                  required
                />
              </div>

              {isTechnicianSignup && (
                <div className="signup-verification-block">
                  <h2 className="signup-verification-title">Team verification</h2>
                  <p className="signup-verification-lead">
                    Only authorized Dopekit salon staff can apply. Your manager will review these
                    details before your account is activated.
                  </p>

                  {requireTechnicianInviteCode && (
                    <div className="mb-3">
                      <label htmlFor="signup-invite-code" className="form-label">
                        Salon invite code
                      </label>
                      <input
                        type="text"
                        className="form-control signup-input"
                        id="signup-invite-code"
                        name="technician_invite_code"
                        value={form.technician_invite_code}
                        onChange={handleChange}
                        autoComplete="off"
                        placeholder="From your salon manager"
                        required
                      />
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="signup-specialty" className="form-label">
                      Primary specialty
                    </label>
                    <select
                      id="signup-specialty"
                      name="technician_specialty"
                      className="form-select signup-input site-select"
                      value={form.technician_specialty}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select your specialty</option>
                      {TECHNICIAN_SPECIALTIES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="signup-experience" className="form-label">
                      Years of experience
                    </label>
                    <input
                      type="number"
                      className="form-control signup-input"
                      id="signup-experience"
                      name="technician_experience_years"
                      value={form.technician_experience_years}
                      onChange={handleChange}
                      min="0"
                      max="50"
                      inputMode="numeric"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="signup-reference-name" className="form-label">
                      Salon reference name
                    </label>
                    <input
                      type="text"
                      className="form-control signup-input"
                      id="signup-reference-name"
                      name="technician_reference_name"
                      value={form.technician_reference_name}
                      onChange={handleChange}
                      placeholder="Supervisor or salon manager"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="signup-reference-phone" className="form-label">
                      Reference phone
                    </label>
                    <input
                      type="tel"
                      className="form-control signup-input"
                      id="signup-reference-phone"
                      name="technician_reference_phone"
                      value={form.technician_reference_phone}
                      onChange={handleChange}
                      inputMode="tel"
                      placeholder="e.g. 0790331108"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="signup-application-note" className="form-label">
                      Short note <span className="signup-optional">(optional)</span>
                    </label>
                    <textarea
                      id="signup-application-note"
                      name="technician_application_note"
                      className="form-control signup-input"
                      value={form.technician_application_note}
                      onChange={handleChange}
                      rows={3}
                      maxLength={500}
                      placeholder="Training, previous salon, or anything that helps us verify you"
                    />
                  </div>

                  <label className="signup-checkbox">
                    <input
                      type="checkbox"
                      name="staff_authorized"
                      checked={form.staff_authorized}
                      onChange={handleChange}
                      required
                    />
                    <span>
                      I confirm I am an authorized Dopekit salon team member applying for a
                      technician account.
                    </span>
                  </label>
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="signup-password" className="form-label">
                  Password
                </label>
                <PasswordInput
                  id="signup-password"
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
                <label htmlFor="signup-confirm" className="form-label">
                  Confirm password
                </label>
                <PasswordInput
                  id="signup-confirm"
                  name="confirm_password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              {isTechnicianSignup && requireTechnicianApproval && (
                <p className="signup-team-note">
                  Applications are reviewed manually. You cannot access the staff dashboard until
                  an admin approves your details.
                </p>
              )}

              <button type="submit" className="btn btn-primary w-100 signup-submit" disabled={loading}>
                {loading ? 'Creating account...' : accountMeta.submitLabel}
              </button>
            </form>

            <p className="signup-footer-text text-center mb-0">
              Already have an account?{' '}
              <Link to={withRedirect('/login', redirectTo)} className="signup-link">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Signup
