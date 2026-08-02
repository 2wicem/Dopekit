import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ClientBookingList from './ClientBookingList'
import { apiFetch } from '../config/api'
import {
  BOOKING_HISTORY_TABS,
  countBookingsByHistoryTab,
  emptyHistoryMessage,
  filterBookingsByHistoryTab,
} from '../utils/bookingHistory'
import './css/Dashboard.css'

const MY_BOOKINGS_PATH = '/products/bookings/mine/'

const MyBookings = () => {
  const [bookings, setBookings] = useState([])
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [activeTab, setActiveTab] = useState('upcoming')

  const loadBookings = useCallback(async () => {
    setLoading(true)

    try {
      const response = await apiFetch(MY_BOOKINGS_PATH)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not load your bookings.')
      }

      setBookings(data.bookings || [])
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const tabCounts = useMemo(() => countBookingsByHistoryTab(bookings), [bookings])

  const visibleBookings = useMemo(
    () => filterBookingsByHistoryTab(bookings, activeTab),
    [bookings, activeTab]
  )

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Cancel this booking? This cannot be undone.')) {
      return
    }

    setBusyId(bookingId)
    setStatus(null)

    try {
      const response = await apiFetch(`/products/bookings/mine/${bookingId}/cancel/`, {
        method: 'POST',
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not cancel booking.')
      }

      setBookings((current) =>
        current.map((booking) => (booking.id === bookingId ? data.booking : booking))
      )
      setStatus({ type: 'success', message: data.message })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setBusyId(null)
    }
  }

  const handleReschedule = (message, updatedBooking) => {
    setBookings((current) =>
      current.map((booking) => (booking.id === updatedBooking.id ? updatedBooking : booking))
    )
    setStatus({ type: 'success', message })
  }

  return (
    <section className="section-band section-band--base dashboard-page my-bookings-page">
      <div className="container page-section my-bookings-section">
        <div className="text-center mb-4">
          <h1>My bookings</h1>
          <p className="text-muted mb-0">
            View your full booking history — upcoming, past, and cancelled appointments.
          </p>
        </div>

        {status && (
          <div className={`alert alert-${status.type === 'error' ? 'danger' : 'success'} mb-4`}>
            {status.message}
          </div>
        )}

        <div className="dashboard-actions d-flex flex-wrap justify-content-center gap-2 mb-4">
          <Link to="/Services" className="btn btn-primary">
            Book another service
          </Link>
        </div>

        <div className="my-bookings-tabs" role="tablist" aria-label="Booking history filters">
          {BOOKING_HISTORY_TABS.map(({ id, label }) => {
            const isActive = activeTab === id

            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`my-bookings-tab-${id}`}
                aria-selected={isActive}
                aria-controls={`my-bookings-panel-${id}`}
                className={`my-bookings-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <span>{label}</span>
                <span className="my-bookings-tab-count">{tabCounts[id]}</span>
              </button>
            )
          })}
        </div>

        <div
          id={`my-bookings-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`my-bookings-tab-${activeTab}`}
        >
          {loading ? (
            <p className="text-center text-muted">Loading your bookings...</p>
          ) : (
            <ClientBookingList
              bookings={visibleBookings}
              emptyMessage={emptyHistoryMessage(activeTab)}
              onCancel={handleCancel}
              onReschedule={handleReschedule}
              busyId={busyId}
            />
          )}
        </div>
      </div>
    </section>
  )
}

export default MyBookings
