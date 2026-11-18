import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../config/api'

const OwnerApplicationsPanel = ({ onStatus, onChanged }) => {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState(null)

  const loadApplications = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/products/owner/applications/')
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not load applications.')
      }
      setApplications(data.applications || [])
      onChanged?.()
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [onStatus, onChanged])

  useEffect(() => {
    loadApplications()
  }, [loadApplications])

  const handleReview = async (userId, action) => {
    const label = action === 'approve' ? 'add this person to your salon' : 'reject'
    if (!window.confirm(`Are you sure you want to ${label} this application?`)) {
      return
    }

    setReviewingId(userId)
    onStatus?.(null)
    try {
      const response = await apiFetch(`/products/owner/applications/${userId}/${action}/`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not update application.')
      }
      onStatus?.({ type: 'success', message: data.message })
      await loadApplications()
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="owner-applications-panel">
      <div className="admin-panel-toolbar">
        <div>
          <h2 className="admin-panel-title">Invite signups</h2>
          <p className="admin-panel-lead">
            Prefer adding staff yourself from Technicians. If someone used a branch invite code
            before this change, you can still activate them here — no platform admin step.
          </p>
        </div>
      </div>

      {loading && <p className="text-muted dashboard-empty">Loading applications…</p>}

      {!loading && applications.length === 0 && (
        <p className="text-muted dashboard-empty">No pending salon team applications.</p>
      )}

      {!loading && applications.length > 0 && (
        <div className="technician-review-list">
          {applications.map((entry) => {
            const application = entry.technician_application || {}
            return (
              <article key={entry.id} className="technician-review-card">
                <div className="technician-review-card-top">
                  <div>
                    <h3 className="technician-review-name">{entry.name}</h3>
                    <p className="technician-review-meta">
                      {entry.email} · {entry.phone || 'No phone'}
                    </p>
                    <p className="technician-review-meta">
                      {application.application_salon_name || 'Salon team'} · Applied{' '}
                      {new Date(entry.date_joined).toLocaleString()}
                    </p>
                  </div>
                  <div className="technician-review-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-success me-2"
                      disabled={reviewingId === entry.id}
                      onClick={() => handleReview(entry.id, 'approve')}
                    >
                      Activate
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      disabled={reviewingId === entry.id}
                      onClick={() => handleReview(entry.id, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <dl className="technician-review-details">
                  <div>
                    <dt>Specialty</dt>
                    <dd>{application.specialty_label || '—'}</dd>
                  </div>
                  <div>
                    <dt>Experience</dt>
                    <dd>
                      {application.experience_years != null
                        ? `${application.experience_years} year(s)`
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Reference</dt>
                    <dd>
                      {application.reference_name || '—'}
                      {application.reference_phone ? ` · ${application.reference_phone}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Phone verified</dt>
                    <dd>{application.phone_verified ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>

                {application.application_note && (
                  <p className="technician-review-note">
                    <strong>Note:</strong> {application.application_note}
                  </p>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default OwnerApplicationsPanel
