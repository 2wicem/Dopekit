import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { todayIso } from '../constants/slots'
import { useAuth } from '../context/useAuth'
import { requestWorkerNotifications, useWorkerNotifications, getNotificationPermission } from '../hooks/useWorkerNotifications'
import BrandLogo from './BrandLogo'
import InstallPrompt from './InstallPrompt'
import ThemeToggle from './ThemeToggle'
import WorkerBookingList from './WorkerBookingList'
import WorkerSchedule from './WorkerSchedule'
import ReportsPanel from './ReportsPanel'
import { apiFetch } from '../config/api'
import './css/WorkerApp.css'

const WORKER_BOOKINGS_PATH = '/products/bookings/worker/'

const WorkerDashboard = () => {
  const { user, logout } = useAuth()
  const [bookings, setBookings] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('schedule')
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [notifyPermission, setNotifyPermission] = useState(getNotificationPermission)
  const [enablingAlerts, setEnablingAlerts] = useState(false)

  const loadBookings = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setStatus(null)

    try {
      const response = await apiFetch(WORKER_BOOKINGS_PATH)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not load bookings.')
      }

      setBookings(data.bookings || [])
      setPendingCount(data.pending_count || 0)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const openBookingFromAlert = useCallback((bookingId) => {
    setActiveTab('bookings')
    setHighlightId(bookingId)
    setTimeout(() => {
      document.getElementById(`worker-booking-${bookingId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
  }, [])

  useWorkerNotifications({
    bookings,
    enabled: true,
    onOpenBooking: openBookingFromAlert,
  })

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  useEffect(() => {
    if (!('permissions' in navigator) || typeof navigator.permissions.query !== 'function') {
      return undefined
    }

    let cancelled = false
    let permissionStatus = null

    navigator.permissions
      .query({ name: 'notifications' })
      .then((status) => {
        if (cancelled) {
          return
        }
        permissionStatus = status
        setNotifyPermission(getNotificationPermission())
        status.onchange = () => {
          setNotifyPermission(getNotificationPermission())
        }
      })
      .catch(() => {
        // Some browsers do not expose the notifications permission query.
      })

    return () => {
      cancelled = true
      if (permissionStatus) {
        permissionStatus.onchange = null
      }
    }
  }, [])

  const handleEnableNotifications = () => {
    if (enablingAlerts) {
      return
    }

    setStatus(null)

    if (notifyPermission === 'unsupported') {
      setStatus({
        type: 'error',
        message: 'This browser does not support booking alerts. Keep the staff app open to see new requests.',
      })
      return
    }

    if (notifyPermission === 'denied') {
      setStatus({
        type: 'error',
        message:
          'Notifications are blocked for this site. Open browser settings → Site settings → Notifications → Allow, then refresh.',
      })
      return
    }

    setEnablingAlerts(true)

    requestWorkerNotifications()
      .then((result) => {
        setNotifyPermission(result)
        if (result === 'granted') {
          setStatus({
            type: 'success',
            message: 'Alerts enabled. You will be notified when a client books.',
          })
          return
        }
        if (result === 'denied') {
          setStatus({
            type: 'error',
            message:
              'Notifications were blocked. Allow notifications in your browser site settings, then try again.',
          })
          return
        }
        setStatus({
          type: 'error',
          message: 'Could not enable alerts. Try again or check browser notification settings.',
        })
      })
      .catch(() => {
        setStatus({
          type: 'error',
          message: 'Could not enable alerts. Try again or check browser notification settings.',
        })
      })
      .finally(() => {
        setEnablingAlerts(false)
      })
  }

  const handleBookingAction = async (bookingId, action) => {
    setBusyId(bookingId)
    setStatus(null)

    try {
      const response = await apiFetch(`/products/bookings/${bookingId}/${action}/`, {
        method: 'POST',
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not update booking.')
      }

      setStatus({ type: 'success', message: data.message })
      await loadBookings(true)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setBusyId(null)
    }
  }

  const firstName = (user?.name || 'Staff').split(' ')[0]
  const today = todayIso()

  const bookingDate = (booking) => booking.slot?.date || booking.requested_date

  const todayBookings = useMemo(
    () =>
      bookings.filter(
        (booking) => bookingDate(booking) === today && booking.status !== 'cancelled'
      ),
    [bookings, today]
  )

  const upcomingBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        const date = bookingDate(booking)
        if (!date || booking.status === 'cancelled') {
          return false
        }
        return date >= today
      }),
    [bookings, today]
  )

  const formattedToday = new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // Session may already be cleared
    }
  }

  return (
    <div className="worker-app">
      <header className="worker-app-header">
        <BrandLogo size="sm" />
        <div className="worker-app-header-text">
          <h1 className="worker-app-greeting">Hi, {firstName}</h1>
          <p className="worker-app-date">{formattedToday}</p>
        </div>
        <div className="worker-app-header-actions">
          <ThemeToggle variant="icon" />
          <button
            type="button"
            className="worker-app-icon-btn"
            onClick={() => loadBookings(true)}
            aria-label="Refresh"
            disabled={refreshing}
          >
            {refreshing ? '…' : '↻'}
          </button>
          <Link to="/profile" className="worker-app-icon-btn" aria-label="My profile">
            <i className="fa-solid fa-user" aria-hidden="true" />
          </Link>
          <button type="button" className="worker-app-icon-btn" onClick={handleLogout} aria-label="Log out">
            <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="worker-app-body">
        <InstallPrompt />

        {notifyPermission !== 'granted' && notifyPermission !== 'unsupported' && (
          <div className="worker-notify-banner">
            <p>
              {notifyPermission === 'denied'
                ? 'Booking alerts are blocked in your browser. Allow notifications for this site to get alerts.'
                : 'Turn on alerts to get notified when a client books.'}
            </p>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleEnableNotifications}
              disabled={enablingAlerts}
            >
              {enablingAlerts
                ? 'Enabling…'
                : notifyPermission === 'denied'
                  ? 'How to unblock'
                  : 'Enable alerts'}
            </button>
          </div>
        )}

        {notifyPermission === 'unsupported' && (
          <div className="worker-notify-banner worker-notify-banner--muted">
            <p>
              Push alerts are not available in this browser. New bookings still appear when you
              refresh or keep this tab open.
            </p>
          </div>
        )}

        {status && (
          <div className={`alert alert-${status.type === 'error' ? 'danger' : 'success'} mb-3 py-2`}>
            {status.message}
          </div>
        )}

        <div className="worker-app-stats">
          <div className="worker-app-stat">
            <span className="worker-app-stat-value">{todayBookings.length}</span>
            <span className="worker-app-stat-label">Today</span>
          </div>
          <div className="worker-app-stat">
            <span className="worker-app-stat-value">{upcomingBookings.length}</span>
            <span className="worker-app-stat-label">Upcoming</span>
          </div>
          {pendingCount > 0 && (
            <div className="worker-app-stat worker-app-stat--pending">
              <span className="worker-app-stat-value">{pendingCount}</span>
              <span className="worker-app-stat-label">Need action</span>
            </div>
          )}
        </div>

        <div className="worker-app-tabs" role="tablist" aria-label="Worker dashboard">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'schedule'}
            className={`worker-app-tab${activeTab === 'schedule' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            My schedule
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bookings'}
            className={`worker-app-tab${activeTab === 'bookings' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            Bookings
            {pendingCount > 0 && <span className="worker-tab-badge">{pendingCount}</span>}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reports'}
            className={`worker-app-tab${activeTab === 'reports' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Reports
          </button>
        </div>

        {activeTab === 'schedule' ? (
          <div className="worker-app-panel" role="tabpanel">
            <WorkerSchedule onChanged={() => loadBookings(true)} />
          </div>
        ) : activeTab === 'reports' ? (
          <div className="worker-app-panel" role="tabpanel">
            <ReportsPanel scope={user?.role === 'admin' ? 'admin' : 'technician'} />
          </div>
        ) : (
          <div className="worker-app-panel" role="tabpanel">
            {loading ? (
              <p className="worker-app-loading">Loading bookings...</p>
            ) : (
              <WorkerBookingList
                bookings={bookings}
                highlightId={highlightId}
                busyId={busyId}
                onAccept={(id) => handleBookingAction(id, 'accept')}
                onCancel={(id) => handleBookingAction(id, 'cancel')}
              />
            )}
          </div>
        )}

        {user?.role === 'admin' && (
          <Link to="/admin" className="worker-app-admin-link">
            Open admin panel
          </Link>
        )}
      </main>
    </div>
  )
}

export default WorkerDashboard
