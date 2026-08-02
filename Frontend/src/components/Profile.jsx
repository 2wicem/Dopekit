import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../config/api'
import { ROLE_LABELS } from '../constants/roles'
import { useAuth } from '../context/useAuth'
import './css/Profile.css'

const formatDate = (isoDate) => {
  if (!isoDate) {
    return '—'
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const ProfileRow = ({ label, value, empty = '—' }) => (
  <div className="profile-row">
    <dt className="profile-label">{label}</dt>
    <dd className="profile-value">{value?.trim() ? value : empty}</dd>
  </div>
)

const emptyForm = {
  phone: '',
  default_location: '',
  technician_work_summary: '',
  technician_portfolio_urls: '',
}

const Profile = () => {
  const { user, loading, refreshUser, setUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    refreshUser({ silent: true })
  }, [refreshUser])

  useEffect(() => {
    if (!user) {
      return
    }

    setForm({
      phone: user.phone || '',
      default_location: user.default_location || '',
      technician_work_summary: user.technician_work_summary || '',
      technician_portfolio_urls: (user.technician_portfolio_urls || []).join('\n'),
    })
  }, [user])

  if (loading) {
    return (
      <section className="section-band section-band--base dashboard-page profile-page">
        <div className="container page-section text-center">
          <p className="text-muted mb-0">Loading your profile…</p>
        </div>
      </section>
    )
  }

  if (!user) {
    return null
  }

  const application = user.technician_application
  const showApplication =
    user.technician_approval && user.technician_approval !== 'na' && application
  const isTechnicianProfile = user.role === 'worker' || user.role === 'admin'

  const handleEdit = () => {
    setStatus(null)
    setForm({
      phone: user.phone || '',
      default_location: user.default_location || '',
      technician_work_summary: user.technician_work_summary || '',
      technician_portfolio_urls: (user.technician_portfolio_urls || []).join('\n'),
    })
    setEditing(true)
  }

  const handleCancel = () => {
    setStatus(null)
    setForm({
      phone: user.phone || '',
      default_location: user.default_location || '',
      technician_work_summary: user.technician_work_summary || '',
      technician_portfolio_urls: (user.technician_portfolio_urls || []).join('\n'),
    })
    setEditing(false)
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setStatus(null)

    try {
      const payload = {
        phone: form.phone.trim(),
        default_location: form.default_location.trim(),
      }

      if (isTechnicianProfile) {
        payload.technician_work_summary = form.technician_work_summary.trim()
        payload.technician_portfolio_urls = form.technician_portfolio_urls
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      }

      const response = await apiFetch('/products/auth/me/update/', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not update profile.')
      }

      setUser(data.user)
      setEditing(false)
      setStatus({ type: 'success', message: data.message || 'Profile updated.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="section-band section-band--base dashboard-page profile-page">
      <div className="container page-section profile-section">
        <div className="text-center mb-4">
          <h1>My profile</h1>
          <p className="text-muted mb-0">Your account details on Dopekit.</p>
        </div>

        {status && (
          <div className={`alert alert-${status.type === 'error' ? 'danger' : 'success'} profile-alert`}>
            {status.message}
          </div>
        )}

        <div className="profile-card">
          <div className="profile-card-header">
            <div>
              <h2 className="profile-name">{user.name || user.username}</h2>
              <span className={`nav-role-badge nav-role-badge--${user.role}`}>
                {user.role_label || ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
            {!editing && (
              <button
                type="button"
                className="profile-edit-btn"
                onClick={handleEdit}
                aria-label="Edit profile"
              >
                <i className="fa-solid fa-pen" aria-hidden="true" />
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="profile-form-field">
                <label htmlFor="profile-phone" className="profile-label">
                  Phone
                </label>
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  className="form-control profile-input"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="e.g. 0712345678"
                  required
                />
              </div>

              <div className="profile-form-field">
                <label htmlFor="profile-location" className="profile-label">
                  Default visit address
                </label>
                <input
                  id="profile-location"
                  name="default_location"
                  type="text"
                  className="form-control profile-input"
                  value={form.default_location}
                  onChange={handleChange}
                  placeholder="For outdoor appointments"
                  maxLength={200}
                />
                <p className="profile-field-hint">
                  Used when you book outdoor services — we come to you.
                </p>
              </div>

              {isTechnicianProfile && (
                <>
                  <div className="profile-form-field">
                    <label htmlFor="profile-work-summary" className="profile-label">
                      Your work (shown to clients)
                    </label>
                    <textarea
                      id="profile-work-summary"
                      name="technician_work_summary"
                      className="form-control profile-input"
                      rows={4}
                      value={form.technician_work_summary}
                      onChange={handleChange}
                      placeholder="Describe your nail styles, specialties, and experience."
                      maxLength={500}
                    />
                  </div>

                  <div className="profile-form-field">
                    <label htmlFor="profile-portfolio" className="profile-label">
                      Portfolio image URLs
                    </label>
                    <textarea
                      id="profile-portfolio"
                      name="technician_portfolio_urls"
                      className="form-control profile-input"
                      rows={4}
                      value={form.technician_portfolio_urls}
                      onChange={handleChange}
                      placeholder="One image URL per line (https://...)"
                    />
                  </div>
                </>
              )}

              <div className="profile-form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="profile-details">
              <ProfileRow label="Username" value={user.username || user.name} />
              <ProfileRow label="Email" value={user.email} />
              <ProfileRow label="Phone" value={user.phone} />
              <ProfileRow label="Member since" value={formatDate(user.date_joined)} />
              <ProfileRow label="Default visit address" value={user.default_location} />
              {isTechnicianProfile ? (
                <>
                  <ProfileRow label="Your work" value={user.technician_work_summary} />
                  <ProfileRow
                    label="Portfolio links"
                    value={(user.technician_portfolio_urls || []).join(', ')}
                  />
                </>
              ) : null}
              {user.technician_approval && user.technician_approval !== 'na' ? (
                <ProfileRow
                  label="Technician application"
                  value={user.technician_approval_label}
                />
              ) : null}
            </dl>
          )}
        </div>

        {showApplication ? (
          <div className="profile-card profile-card--secondary">
            <h3 className="profile-section-title">Team application</h3>
            <dl className="profile-details">
              <ProfileRow label="Specialty" value={application.specialty_label} />
              <ProfileRow
                label="Experience"
                value={
                  application.experience_years != null
                    ? `${application.experience_years} year${application.experience_years === 1 ? '' : 's'}`
                    : ''
                }
              />
              <ProfileRow label="Reference name" value={application.reference_name} />
              <ProfileRow label="Reference phone" value={application.reference_phone} />
              {application.application_note ? (
                <ProfileRow label="Application note" value={application.application_note} />
              ) : null}
            </dl>
          </div>
        ) : null}

        <div className="profile-actions">
          {user.role === 'client' && !user.technician_pending && (
            <Link to="/my-bookings" className="btn btn-outline-primary">
              My bookings
            </Link>
          )}
          {user.technician_pending && (
            <Link to="/technician-pending" className="btn btn-outline-primary">
              Application status
            </Link>
          )}
          {(user.role === 'worker' || user.role === 'admin') && (
            <Link to="/worker" className="btn btn-outline-primary">
              Staff dashboard
            </Link>
          )}
          {user.role === 'admin' && (
            <Link to="/admin" className="btn btn-outline-secondary">
              Admin panel
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

export default Profile
