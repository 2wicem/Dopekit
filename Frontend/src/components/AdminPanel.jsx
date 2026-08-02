import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { todayIso } from '../constants/slots'
import { ROLE_LABELS } from '../constants/roles'
import { SERVICE_VENUES } from '../constants/serviceVenue'
import { useAuth } from '../context/useAuth'
import { useAdminSalon } from '../hooks/useAdminSalon'
import { apiFetch } from '../config/api'
import AdminSalonsPanel from './AdminSalonsPanel'
import BookingsTable, { RoleBadge } from './BookingsTable'
import ReportsPanel from './ReportsPanel'
import './css/Dashboard.css'
import './css/AdminShell.css'

const STATS_PATH = '/products/admin/stats/'
const USERS_PATH = '/products/admin/users/'
const BOOKINGS_PATH = '/products/bookings/list/'
const MESSAGES_PATH = '/products/admin/messages/'
const PENDING_TECHNICIANS_PATH = '/products/admin/technicians/pending/'
const SALONS_PATH = '/products/admin/salons/'
const WALK_IN_PATH = '/products/admin/bookings/create/'

const emptyWalkIn = {
  name: '',
  phone: '',
  service: '',
  venue: 'indoor',
  location: '',
  requested_date: todayIso(),
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'today', label: 'Today' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'salons', label: 'Salons' },
  { id: 'reports', label: 'Reports' },
  { id: 'messages', label: 'Messages' },
  { id: 'technicians', label: 'Technicians' },
  { id: 'users', label: 'Users' },
]

const AdminPanel = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [bookings, setBookings] = useState([])
  const [messages, setMessages] = useState([])
  const [pendingTechnicians, setPendingTechnicians] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatingUserId, setUpdatingUserId] = useState(null)
  const [reviewingUserId, setReviewingUserId] = useState(null)
  const [deletingBookingId, setDeletingBookingId] = useState(null)
  const [pendingRoles, setPendingRoles] = useState({})
  const [salons, setSalons] = useState([])
  const [bookingBusyId, setBookingBusyId] = useState(null)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [walkInForm, setWalkInForm] = useState(emptyWalkIn)
  const [walkInSalonId, setWalkInSalonId] = useState('')
  const [walkInSaving, setWalkInSaving] = useState(false)
  const [updatingSalonUserId, setUpdatingSalonUserId] = useState(null)
  const { salonId, setSalonId, salonQuery, withSalonQuery, activeSalon } = useAdminSalon(salons)

  const loadSalons = useCallback(async () => {
    const response = await apiFetch(SALONS_PATH)
    const text = await response.text()
    const data = text ? JSON.parse(text) : {}
    if (!response.ok) {
      throw new Error(data.error || 'Could not load salons.')
    }
    setSalons(data.salons || [])
    return data.salons || []
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setStatus(null)

    try {
      const [statsRes, usersRes, bookingsRes, messagesRes, pendingRes] = await Promise.all([
        apiFetch(withSalonQuery(STATS_PATH)),
        apiFetch(USERS_PATH),
        apiFetch(withSalonQuery(BOOKINGS_PATH)),
        apiFetch(MESSAGES_PATH),
        apiFetch(PENDING_TECHNICIANS_PATH),
      ])

      const parse = async (response) => {
        const text = await response.text()
        const data = text ? JSON.parse(text) : {}
        if (!response.ok) {
          throw new Error(data.error || 'Request failed.')
        }
        return data
      }

      const [statsData, usersData, bookingsData, messagesData, pendingData] = await Promise.all([
        parse(statsRes),
        parse(usersRes),
        parse(bookingsRes),
        parse(messagesRes),
        parse(pendingRes),
      ])

      setStats(statsData)
      setUsers(usersData.users || [])
      setBookings(bookingsData.bookings || [])
      setMessages(messagesData.messages || [])
      setPendingTechnicians(pendingData.technicians || [])
      setPendingRoles({})
      if ((pendingData.technicians || []).length > 0) {
        setActiveTab('technicians')
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }, [withSalonQuery])

  useEffect(() => {
    loadSalons().catch(() => setSalons([]))
  }, [loadSalons])

  useEffect(() => {
    loadData()
  }, [loadData])

  const todayBookings = useMemo(() => {
    const today = todayIso()
    return bookings.filter((booking) => {
      if (booking.slot?.date === today) {
        return true
      }
      return !booking.slot && booking.requested_date === today
    })
  }, [bookings])

  const pendingTodayCount = useMemo(
    () => todayBookings.filter((booking) => booking.status === 'pending').length,
    [todayBookings]
  )

  const getDisplayRole = (entry) => pendingRoles[entry.id] ?? entry.role

  const hasPendingRoleChange = (entry) => {
    const pendingRole = pendingRoles[entry.id]
    return pendingRole != null && pendingRole !== entry.role
  }

  const handleRoleSelect = (userId, role) => {
    setPendingRoles((current) => {
      const savedRole = users.find((entry) => entry.id === userId)?.role
      if (savedRole === role) {
        const next = { ...current }
        delete next[userId]
        return next
      }
      return { ...current, [userId]: role }
    })
    setStatus(null)
  }

  const handleCancelRoleChange = (userId) => {
    setPendingRoles((current) => {
      const next = { ...current }
      delete next[userId]
      return next
    })
  }

  const handleConfirmRoleChange = async (userId) => {
    const role = pendingRoles[userId]
    if (!role) {
      return
    }

    const saved = await handleRoleChange(userId, role)
    if (saved) {
      setPendingRoles((current) => {
        const next = { ...current }
        delete next[userId]
        return next
      })
    }
  }

  const handleRoleChange = async (userId, role) => {
    setUpdatingUserId(userId)
    setStatus(null)

    try {
      const response = await apiFetch(`/products/admin/users/${userId}/role/`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not update role.')
      }

      setUsers((current) =>
        current.map((entry) => (entry.id === userId ? data.user : entry))
      )
      setStatus({ type: 'success', message: data.message })
      const statsRes = await apiFetch(withSalonQuery(STATS_PATH))
      const statsText = await statsRes.text()
      if (statsRes.ok && statsText) {
        setStats(JSON.parse(statsText))
      }
      return true
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
      return false
    } finally {
      setUpdatingUserId(null)
    }
  }

  const handleTechnicianReview = async (userId, action) => {
    const actionLabel = action === 'approve' ? 'approve' : 'reject'
    if (!window.confirm(`Are you sure you want to ${actionLabel} this technician application?`)) {
      return
    }

    setReviewingUserId(userId)
    setStatus(null)

    try {
      const response = await apiFetch(`/products/admin/technicians/${userId}/${action}/`, {
        method: 'POST',
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not update application.')
      }

      setPendingTechnicians((current) => current.filter((entry) => entry.id !== userId))
      setUsers((current) => {
        const exists = current.some((entry) => entry.id === userId)
        if (!exists) {
          return [data.user, ...current]
        }
        return current.map((entry) => (entry.id === userId ? data.user : entry))
      })
      setStatus({ type: 'success', message: data.message })

      const statsRes = await apiFetch(withSalonQuery(STATS_PATH))
      const statsText = await statsRes.text()
      if (statsRes.ok && statsText) {
        setStats(JSON.parse(statsText))
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setReviewingUserId(null)
    }
  }

  const resolvedWalkInSalonId = useMemo(() => {
    if (salonId !== 'all') {
      return salonId
    }
    return walkInSalonId
  }, [salonId, walkInSalonId])

  const handleWalkInChange = (event) => {
    const { name, value } = event.target
    setWalkInForm((current) => ({ ...current, [name]: value }))
  }

  const handleWalkInSubmit = async (event) => {
    event.preventDefault()

    if (!resolvedWalkInSalonId) {
      setStatus({ type: 'error', message: 'Choose a salon for this walk-in.' })
      return
    }

    if (walkInForm.venue === 'outdoor' && !walkInForm.location.trim()) {
      setStatus({ type: 'error', message: 'Enter an address for outdoor walk-ins.' })
      return
    }

    setWalkInSaving(true)
    setStatus(null)

    try {
      const response = await apiFetch(WALK_IN_PATH, {
        method: 'POST',
        body: JSON.stringify({
          ...walkInForm,
          salon_id: Number(resolvedWalkInSalonId),
        }),
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || 'Could not add walk-in.')
      }

      setWalkInForm({ ...emptyWalkIn, requested_date: todayIso() })
      setShowWalkIn(false)
      await loadData()
      setStatus({ type: 'success', message: data.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setWalkInSaving(false)
    }
  }

  const handleUserSalonChange = async (userId, nextSalonId) => {
    setUpdatingSalonUserId(userId)
    setStatus(null)

    try {
      const response = await apiFetch(`/products/admin/users/${userId}/salon/`, {
        method: 'PATCH',
        body: JSON.stringify({ salon_id: nextSalonId || null }),
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || 'Could not update home salon.')
      }

      setUsers((current) => current.map((entry) => (entry.id === userId ? data.user : entry)))
      setStatus({ type: 'success', message: data.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setUpdatingSalonUserId(null)
    }
  }

  const handleDeleteBooking = async (bookingId) => {
    if (!window.confirm('Delete this booking permanently?')) {
      return
    }

    setDeletingBookingId(bookingId)
    setStatus(null)

    try {
      const response = await apiFetch(`/products/admin/bookings/${bookingId}/`, {
        method: 'DELETE',
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not delete booking.')
      }

      setBookings((current) => current.filter((booking) => booking.id !== bookingId))
      setStats((current) =>
        current ? { ...current, total_bookings: Math.max(0, current.total_bookings - 1) } : current
      )
      setStatus({ type: 'success', message: data.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setDeletingBookingId(null)
    }
  }

  const handleBookingAction = async (bookingId, action) => {
    if (action === 'cancel' && !window.confirm('Cancel this booking?')) {
      return
    }

    setBookingBusyId(bookingId)
    setStatus(null)

    try {
      const response = await apiFetch(`/products/bookings/${bookingId}/${action}/`, {
        method: 'POST',
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || `Could not ${action} booking.`)
      }

      await loadData()
      setStatus({ type: 'success', message: data.message || 'Booking updated.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setBookingBusyId(null)
    }
  }

  const salonScopeLabel =
    salonId === 'all' ? 'All salons' : activeSalon?.name || 'Selected salon'

  return (
    <div className="admin-app">
      <aside className="admin-app-sidebar">
        <div>
          <div className="admin-app-brand">Salon dashboard</div>
          <p className="admin-app-subtitle">Signed in as {user?.name}</p>
        </div>

        <div className="admin-salon-switcher">
          <label htmlFor="admin-salon-filter">Viewing</label>
          <select
            id="admin-salon-filter"
            className="form-select site-select"
            value={salonId}
            onChange={(event) => setSalonId(event.target.value)}
          >
            <option value="all">All salons</option>
            {salons.map((salon) => (
              <option key={salon.id} value={String(salon.id)}>
                {salon.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="admin-nav" aria-label="Admin sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`admin-nav-btn${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.label}</span>
              {tab.id === 'technicians' && pendingTechnicians.length > 0 && (
                <span className="dashboard-tab-badge">{pendingTechnicians.length}</span>
              )}
              {tab.id === 'today' && pendingTodayCount > 0 && (
                <span className="dashboard-tab-badge">{pendingTodayCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-app-links">
          <Link to="/worker" className="btn btn-sm btn-outline-secondary w-100">
            Staff app
          </Link>
          <Link to="/Services" className="btn btn-sm btn-primary w-100">
            Public site
          </Link>
        </div>
      </aside>

      <main className="admin-app-main dashboard-page">
        <div className="admin-panel-toolbar">
          <div>
            <h1 className="admin-panel-title">
              {TABS.find((tab) => tab.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <p className="admin-panel-lead">{salonScopeLabel}</p>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadData} disabled={loading}>
            Refresh
          </button>
        </div>

        {status && (
          <div className={`alert alert-${status.type === 'error' ? 'danger' : 'success'} mb-4`}>
            {status.message}
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted">Loading admin data...</p>
        ) : (
          <>
            {activeTab === 'overview' && stats && (
              <div className="dashboard-stats mb-4">
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-value">{stats.total_bookings}</span>
                  <span className="dashboard-stat-label">Bookings</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-value">{stats.pending_bookings ?? 0}</span>
                  <span className="dashboard-stat-label">Pending action</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-value">{stats.total_messages ?? 0}</span>
                  <span className="dashboard-stat-label">Contact notes</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-value">{salons.length}</span>
                  <span className="dashboard-stat-label">Salon locations</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-value">{stats.total_users}</span>
                  <span className="dashboard-stat-label">Users</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-value">{stats.clients}</span>
                  <span className="dashboard-stat-label">{ROLE_LABELS.client}s</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-value">{stats.workers}</span>
                  <span className="dashboard-stat-label">{ROLE_LABELS.worker}s</span>
                </div>
                <div className="dashboard-stat-card">
                  <span className="dashboard-stat-value">{stats.pending_technicians ?? 0}</span>
                  <span className="dashboard-stat-label">Pending technicians</span>
                </div>
              </div>
            )}

            {activeTab === 'today' && (
              <>
                <div className="admin-walkin-toolbar">
                  <p className="admin-walkin-lead">
                    {todayBookings.length} appointment{todayBookings.length === 1 ? '' : 's'} today
                    {pendingTodayCount > 0 ? ` · ${pendingTodayCount} pending` : ''}
                  </p>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => setShowWalkIn((current) => !current)}
                  >
                    {showWalkIn ? 'Close walk-in form' : 'Add walk-in'}
                  </button>
                </div>

                {showWalkIn && (
                  <form className="admin-walkin-form" onSubmit={handleWalkInSubmit}>
                    <div className="admin-walkin-form-grid">
                      <div>
                        <label htmlFor="walkin-name">Client name</label>
                        <input
                          id="walkin-name"
                          name="name"
                          value={walkInForm.name}
                          onChange={handleWalkInChange}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="walkin-phone">Phone</label>
                        <input
                          id="walkin-phone"
                          name="phone"
                          value={walkInForm.phone}
                          onChange={handleWalkInChange}
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="walkin-service">Service</label>
                        <input
                          id="walkin-service"
                          name="service"
                          value={walkInForm.service}
                          onChange={handleWalkInChange}
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label htmlFor="walkin-date">Date</label>
                        <input
                          id="walkin-date"
                          type="date"
                          name="requested_date"
                          value={walkInForm.requested_date}
                          min={todayIso()}
                          onChange={handleWalkInChange}
                          required
                        />
                      </div>
                      {salonId === 'all' && (
                        <div>
                          <label htmlFor="walkin-salon">Salon</label>
                          <select
                            id="walkin-salon"
                            className="form-select site-select"
                            value={walkInSalonId}
                            onChange={(event) => setWalkInSalonId(event.target.value)}
                            required
                          >
                            <option value="">Choose salon</option>
                            {salons.map((salon) => (
                              <option key={salon.id} value={String(salon.id)}>
                                {salon.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label htmlFor="walkin-venue">Venue</label>
                        <select
                          id="walkin-venue"
                          className="form-select site-select"
                          name="venue"
                          value={walkInForm.venue}
                          onChange={handleWalkInChange}
                        >
                          {SERVICE_VENUES.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {entry.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {walkInForm.venue === 'outdoor' && (
                        <div className="admin-walkin-form-span">
                          <label htmlFor="walkin-location">Address</label>
                          <input
                            id="walkin-location"
                            name="location"
                            value={walkInForm.location}
                            onChange={handleWalkInChange}
                            required
                          />
                        </div>
                      )}
                    </div>
                    <div className="admin-walkin-actions">
                      <button type="submit" className="btn btn-sm btn-success" disabled={walkInSaving}>
                        {walkInSaving ? 'Saving…' : 'Save walk-in'}
                      </button>
                    </div>
                  </form>
                )}

                <BookingsTable
                  bookings={todayBookings}
                  showStatus
                  showActions
                  showSalon={salonId === 'all'}
                  onAccept={(id) => handleBookingAction(id, 'accept')}
                  onCancel={(id) => handleBookingAction(id, 'cancel')}
                  busyId={bookingBusyId}
                />
              </>
            )}

            {activeTab === 'salons' && (
              <AdminSalonsPanel
                salons={salons}
                onChanged={loadSalons}
                onStatus={setStatus}
              />
            )}

            {activeTab === 'technicians' && (
              <div className="technician-review-list">
                {pendingTechnicians.length === 0 ? (
                  <p className="text-center text-muted dashboard-empty">
                    No pending technician applications.
                  </p>
                ) : (
                  pendingTechnicians.map((entry) => {
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
                              Applied {new Date(entry.date_joined).toLocaleString()}
                            </p>
                          </div>
                          <div className="technician-review-actions">
                            <button
                              type="button"
                              className="btn btn-sm btn-success me-2"
                              disabled={reviewingUserId === entry.id}
                              onClick={() => handleTechnicianReview(entry.id, 'approve')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              disabled={reviewingUserId === entry.id}
                              onClick={() => handleTechnicianReview(entry.id, 'reject')}
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
                              {application.reference_phone
                                ? ` · ${application.reference_phone}`
                                : ''}
                            </dd>
                          </div>
                          <div>
                            <dt>Invite code</dt>
                            <dd>{application.invite_verified ? 'Verified' : 'Not verified'}</dd>
                          </div>
                        </dl>

                        {application.application_note && (
                          <p className="technician-review-note">
                            <strong>Note:</strong> {application.application_note}
                          </p>
                        )}
                      </article>
                    )
                  })
                )}
              </div>
            )}

            {activeTab === 'bookings' && (
              <BookingsTable
                bookings={bookings}
                showDelete
                showStatus
                showActions
                showSalon={salonId === 'all'}
                onDelete={handleDeleteBooking}
                deletingId={deletingBookingId}
                onAccept={(id) => handleBookingAction(id, 'accept')}
                onCancel={(id) => handleBookingAction(id, 'cancel')}
                busyId={bookingBusyId}
              />
            )}

            {activeTab === 'reports' && <ReportsPanel scope="admin" salonQuery={salonQuery} />}

            {activeTab === 'messages' && (
              <div className="dashboard-table-wrap table-responsive">
                {messages.length === 0 ? (
                  <p className="text-center text-muted dashboard-empty">No contact notes yet.</p>
                ) : (
                  <table className="table dashboard-table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>From</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Message</th>
                        <th>Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messages.map((entry) => (
                        <tr key={entry.id}>
                          <td>{entry.name || 'Anonymous'}</td>
                          <td>{entry.phone || '—'}</td>
                          <td>{entry.email || entry.user?.email || '—'}</td>
                          <td className="dashboard-message-cell">{entry.message}</td>
                          <td>{new Date(entry.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="dashboard-table-wrap table-responsive">
                {users.length === 0 ? (
                  <p className="text-center text-muted dashboard-empty">No users yet.</p>
                ) : (
                  <table className="table dashboard-table table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Home salon</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((entry) => {
                        const displayRole = getDisplayRole(entry)
                        const pendingChange = hasPendingRoleChange(entry)

                        return (
                        <tr key={entry.id} className={pendingChange ? 'dashboard-row-pending' : undefined}>
                          <td>{entry.name}</td>
                          <td>{entry.email}</td>
                          <td>{entry.phone || '—'}</td>
                          <td>
                            {entry.id === user?.id ? (
                              <RoleBadge role={entry.role} />
                            ) : (
                              <select
                                className={`form-select form-select-sm site-select site-select--sm dashboard-role-select dashboard-role-select--${displayRole}`}
                                value={displayRole}
                                disabled={updatingUserId === entry.id}
                                onChange={(e) => handleRoleSelect(entry.id, e.target.value)}
                                aria-label={`Change role for ${entry.name}`}
                              >
                                <option value="client">{ROLE_LABELS.client}</option>
                                <option value="worker">{ROLE_LABELS.worker}</option>
                                <option value="salon_owner">{ROLE_LABELS.salon_owner}</option>
                                <option value="admin">{ROLE_LABELS.admin}</option>
                              </select>
                            )}
                          </td>
                          <td>
                            {entry.role === 'worker' || entry.role === 'admin' ? (
                              <select
                                className="form-select form-select-sm site-select site-select--sm"
                                value={entry.salon_id ?? ''}
                                disabled={updatingSalonUserId === entry.id}
                                onChange={(event) =>
                                  handleUserSalonChange(
                                    entry.id,
                                    event.target.value ? Number(event.target.value) : null
                                  )
                                }
                                aria-label={`Home salon for ${entry.name}`}
                              >
                                <option value="">All salons</option>
                                {salons.map((salon) => (
                                  <option key={salon.id} value={String(salon.id)}>
                                    {salon.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {entry.technician_approval === 'pending'
                              ? 'Pending approval'
                              : entry.technician_approval === 'rejected'
                                ? 'Rejected'
                                : entry.technician_approval === 'approved' &&
                                    entry.role === 'worker'
                                  ? 'Approved'
                                  : '—'}
                          </td>
                          <td>{new Date(entry.date_joined).toLocaleDateString()}</td>
                          <td className="dashboard-row-actions">
                            {entry.id !== user?.id && pendingChange && (
                              <div className="dashboard-confirm-actions">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  disabled={updatingUserId === entry.id}
                                  onClick={() => handleConfirmRoleChange(entry.id)}
                                >
                                  {updatingUserId === entry.id ? 'Saving…' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary"
                                  disabled={updatingUserId === entry.id}
                                  onClick={() => handleCancelRoleChange(entry.id)}
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default AdminPanel
