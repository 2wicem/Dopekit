/* eslint-disable react/prop-types */
import { venueLabel } from '../constants/serviceVenue'
import { formatBookingWhen } from '../utils/formatBookingWhen'
import './css/Dashboard.css'

const STATUS_LABELS = {
  pending: 'Awaiting you',
  accepted: 'Confirmed',
  completed: 'In inventory',
  cancelled: 'Cancelled',
}

const WorkerBookingList = ({
  bookings,
  highlightId = null,
  busyId = null,
  onAccept = null,
  onComplete = null,
  onCancel = null,
}) => {
  if (bookings.length === 0) {
    return <p className="worker-booking-empty">No bookings yet.</p>
  }

  return (
    <div className="worker-booking-list">
      {[...bookings]
        .sort((a, b) => {
          const rank = (status) => (status === 'pending' || status === 'accepted' ? 0 : 1)
          return rank(a.status) - rank(b.status)
        })
        .map((booking) => {
        const isPending = booking.status === 'pending'
        const isHighlighted = highlightId === booking.id
        const busy = busyId === booking.id

        return (
          <article
            key={booking.id}
            className={`worker-booking-card worker-booking-card--${booking.status || 'accepted'}${
              isHighlighted ? ' is-highlighted' : ''
            }`}
            id={`worker-booking-${booking.id}`}
          >
            <div className="worker-booking-card-top">
              <div>
                <h3 className="worker-booking-name">{booking.name}</h3>
                <span className={`worker-booking-status worker-booking-status--${booking.status}`}>
                  {STATUS_LABELS[booking.status] || booking.status}
                </span>
              </div>
              <span className="worker-booking-when">{formatBookingWhen(booking)}</span>
            </div>
          <p className="worker-booking-service">{booking.service || 'Service not specified'}</p>
          <p className="worker-booking-location">
            <span className={`booking-venue-pill booking-venue-pill--${booking.venue || 'indoor'}`}>
              {booking.venue_label || venueLabel(booking.venue)}
            </span>
            {booking.location}
          </p>
            <a className="worker-booking-phone" href={`tel:${booking.phone}`}>
              Call {booking.phone}
            </a>

            {(isPending || booking.status === 'accepted') && (
              <div className="worker-booking-actions">
                {isPending && onAccept && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => onAccept(booking.id)}
                    disabled={busy}
                  >
                    {busy ? 'Saving...' : 'Accept'}
                  </button>
                )}
                {onComplete && (booking.status === 'pending' || booking.status === 'accepted') && (
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={() => onComplete(booking.id)}
                    disabled={busy}
                  >
                    {busy ? 'Saving...' : 'Mark done (inventory)'}
                  </button>
                )}
                {booking.status !== 'cancelled' && onCancel && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => onCancel(booking.id)}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

export default WorkerBookingList
