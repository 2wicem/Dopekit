import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { todayIso } from '../constants/slots'
import { useAuth } from '../context/useAuth'
import { requestWorkerNotifications, useWorkerNotifications, getNotificationPermission } from '../hooks/useWorkerNotifications'
import BrandLogo from './BrandLogo'
import InstallPrompt from './InstallPrompt'
import ThemeToggle from './ThemeToggle'
import WorkerBookingList from './WorkerBookingList'
import WorkerSchedule from './WorkerSchedule'
import { apiFetch, parseApiResponse } from '../config/api'
import WalkInForm, { emptyWalkInLine, walkInPayload } from './WalkInForm'
import TechnicianServices from './TechnicianServices'
import PaymentCollectForm from './PaymentCollectForm'
import WorkerPayoutsPanel from './WorkerPayoutsPanel'
import './css/WorkerApp.css'

const ReportsPanel = lazy(() => import('./ReportsPanel'))

const WALK_IN_PATH = '/products/bookings/walk-in/'

const emptyWalkIn = {
  name: '',
  phone: '',
  venue: 'indoor',
  location: '',
  requested_date: todayIso(),
  services: [emptyWalkInLine()],
}

const WORKER_BOOKINGS_PATH = '/products/bookings/worker/'

const WorkerDashboard = () => {
  const { user, logout } = useAuth()
  const [bookings, setBookings] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingIds, setPendingIds] = useState([])
  const [inboxReady, setInboxReady] = useState(false)
  const [todayCount, setTodayCount] = useState(0)
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('schedule')
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [highlightId, setHighlightId] = useState(null)
  const [notifyPermission, setNotifyPermission] = useState(getNotificationPermission)
  const [enablingAlerts, setEnablingAlerts] = useState(false)
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [walkInForm, setWalkInForm] = useState(emptyWalkIn)
  const [walkInSaving, setWalkInSaving] = useState(false)
  const [salonServices, setSalonServices] = useState([])
  const [myServices, setMyServices] = useState([])
  const [paymentTarget, setPaymentTarget] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMpesaCode, setPaymentMpesaCode] = useState('')

  const canRecordWalkIn = true
  const serviceOptions = [
    ...salonServices
      .filter((entry) => entry.is_active !== false)
      .map((entry) => ({
        ...entry,
        group: 'Salon',
        catalog_id: entry.catalog_id || `salon:${entry.id}`,
      })),
    ...myServices
      .filter((entry) => entry.is_active !== false)
      .map((entry) => ({
        ...entry,
        group: 'You',
        catalog_id: entry.catalog_id || `tech:${entry.id}`,
      })),
  ]

  const applyCounts = (data) => {
    if (typeof data.pending_count === 'number') {
      setPendingCount(data.pending_count)
    }
    if (typeof data.today_count === 'number') {
      setTodayCount(data.today_count)
    }
    if (typeof data.upcoming_count === 'number') {
      setUpcomingCount(data.upcoming_count)
    }
    if (Array.isArray(data.pending_ids)) {
      setPendingIds(data.pending_ids)
    }
  }

  const loadSummary = useCallback(async (silent = false) => {
    if (!silent) {
      setRefreshing(true)
    }
    try {
      const response = await apiFetch(`${WORKER_BOOKINGS_PATH}?light=1`)
      const data = await parseApiResponse(response, 'Staff summary')
      applyCounts(data)
    } catch (error) {
      if (!silent) {
        setStatus({ type: 'error', message: error.message })
      }
    } finally {
      setInboxReady(true)
      setRefreshing(false)
    }
  }, [])

  const loadBookings = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setStatus(null)

    try {
      const response = await apiFetch(WORKER_BOOKINGS_PATH)
      const data = await parseApiResponse(response, 'Bookings')
      setBookings(data.bookings || [])
      applyCounts(data)
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
    pendingIds,
    enabled: inboxReady,
    onOpenBooking: openBookingFromAlert,
  })

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  useEffect(() => {
    const salonId = user?.salon_id
    if (!salonId) {
      setSalonServices([])
      return undefined
    }

    let cancelled = false
    apiFetch(`/products/salons/${salonId}/services/`)
      .then((response) => parseApiResponse(response, 'Salon services'))
      .then((data) => {
        if (!cancelled) {
          setSalonServices(data.services || [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSalonServices([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [user?.salon_id])

  useEffect(() => {
    if (activeTab === 'bookings') {
      loadBookings()
    }
  }, [activeTab, loadBookings])

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

  const handleBookingAction = async (bookingId, action, extra = null) => {
    setBusyId(bookingId)
    setStatus(null)

    try {
      const response = await apiFetch(`/products/bookings/${bookingId}/${action}/`, {
        method: 'POST',
        body: extra ? JSON.stringify(extra) : undefined,
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not update booking.')
      }

      setStatus({ type: 'success', message: data.message })
      await loadBookings(true)
      await loadSummary(true)
      return true
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
      return false
    } finally {
      setBusyId(null)
    }
  }

  const openCompletePayment = (booking) => {
    setPaymentTarget(booking)
    setPaymentMethod('cash')
    setPaymentMpesaCode('')
    setPaymentAmount(
      booking.service_price_kes != null ? String(booking.service_price_kes) : ''
    )
  }

  const submitCompletePayment = async (event) => {
    event.preventDefault()
    if (!paymentTarget) {
      return
    }
    const saved = await handleBookingAction(paymentTarget.id, 'complete', {
      payment_method: paymentMethod,
      payment_amount_kes: paymentAmount === '' ? null : Number(paymentAmount),
      mpesa_code: paymentMethod === 'bank' ? paymentMpesaCode : '',
    })
    if (saved) {
      setPaymentTarget(null)
    }
  }

  const handleWalkInChange = (event) => {
    const { name, value } = event.target
    setWalkInForm((current) => ({ ...current, [name]: value }))
  }

  const handleWalkInSubmit = async (event) => {
    event.preventDefault()
    if (walkInForm.venue === 'outdoor' && !walkInForm.location.trim()) {
      setStatus({ type: 'error', message: 'Enter an address for outdoor walk-ins.' })
      return
    }

    setWalkInSaving(true)
    setStatus(null)
    try {
      const response = await apiFetch(WALK_IN_PATH, {
        method: 'POST',
        body: JSON.stringify(walkInPayload(walkInForm)),
      })
      const data = await parseApiResponse(response, 'Walk-in')
      setWalkInForm((current) => ({
        ...current,
        services: [emptyWalkInLine()],
        requested_date: current.requested_date || todayIso(),
      }))
      await loadSummary(true)
      if (activeTab === 'bookings') {
        await loadBookings(true)
      }
      setStatus({
        type: 'success',
        message: data.message || 'Walk-in saved. It counts in today’s income.',
      })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setWalkInSaving(false)
    }
  }

  const firstName = (user?.name || 'Staff').split(' ')[0]
  const today = todayIso()

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
            onClick={() => {
              loadSummary()
              if (activeTab === 'bookings') {
                loadBookings(true)
              }
            }}
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
            <span className="worker-app-stat-value">{todayCount}</span>
            <span className="worker-app-stat-label">Today</span>
          </div>
          <div className="worker-app-stat">
            <span className="worker-app-stat-value">{upcomingCount}</span>
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
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'payouts'}
            className={`worker-app-tab${activeTab === 'payouts' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('payouts')}
          >
            My pay
          </button>
        </div>

        {activeTab === 'schedule' ? (
          <div className="worker-app-panel" role="tabpanel">
            <WorkerSchedule onChanged={() => loadSummary(true)} />
          </div>
        ) : activeTab === 'reports' ? (
          <div className="worker-app-panel" role="tabpanel">
            <Suspense fallback={<p className="worker-app-loading">Loading inventory…</p>}>
              <ReportsPanel
                scope={user?.role === 'admin' ? 'admin' : 'technician'}
                variant="inventory"
                canViewInventory
                canRecordExpenses={Boolean(user?.can_record_expenses)}
              />
            </Suspense>
          </div>
        ) : activeTab === 'payouts' ? (
          <div className="worker-app-panel" role="tabpanel">
            <WorkerPayoutsPanel />
          </div>
        ) : (
          <div className="worker-app-panel" role="tabpanel">
            {canRecordWalkIn && (
              <TechnicianServices onStatus={setStatus} onServicesChange={setMyServices} />
            )}
            {canRecordWalkIn && (
              <div className="admin-walkin-toolbar">
                <p className="admin-walkin-lead">
                  Log extra walk-ins and mark jobs complete. Always enter the client phone so a
                  cash visit is not logged twice. M-Pesa jobs also need the real receipt code.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowWalkIn((current) => !current)}
                >
                  {showWalkIn ? 'Close walk-in form' : 'Add walk-in'}
                </button>
              </div>
            )}
            {canRecordWalkIn && showWalkIn && (
              <WalkInForm
                form={walkInForm}
                onChange={handleWalkInChange}
                onSubmit={handleWalkInSubmit}
                saving={walkInSaving}
                serviceOptions={serviceOptions}
              />
            )}
            {loading ? (
              <p className="worker-app-loading">Loading bookings...</p>
            ) : (
              <WorkerBookingList
                bookings={bookings}
                highlightId={highlightId}
                busyId={busyId}
                onAccept={(id) => handleBookingAction(id, 'accept')}
                onComplete={openCompletePayment}
                onCancel={(id) => handleBookingAction(id, 'cancel')}
              />
            )}
          </div>
        )}

        {paymentTarget && (
          <div className="worker-payment-overlay" role="dialog" aria-modal="true" aria-labelledby="worker-payment-title">
            <form className="worker-payment-card" onSubmit={submitCompletePayment}>
              <h2 id="worker-payment-title">Record payment</h2>
              <p>
                {paymentTarget.name}
                {paymentTarget.service ? ` · ${paymentTarget.service}` : ''}
              </p>
              <PaymentCollectForm
                method={paymentMethod}
                amount={paymentAmount}
                onMethodChange={setPaymentMethod}
                onAmountChange={setPaymentAmount}
                mpesaCode={paymentMpesaCode}
                onMpesaCodeChange={setPaymentMpesaCode}
              />
              <div className="worker-payment-actions">
                <button type="submit" className="btn btn-success" disabled={busyId === paymentTarget.id}>
                  {busyId === paymentTarget.id ? 'Saving…' : 'Save to inventory'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setPaymentTarget(null)}
                  disabled={busyId === paymentTarget.id}
                >
                  Cancel
                </button>
              </div>
            </form>
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
