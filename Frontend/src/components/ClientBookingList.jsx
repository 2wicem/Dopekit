/* eslint-disable react/prop-types */
import { useState } from 'react'
import { venueLabel } from '../constants/serviceVenue'
import { formatBookingWhen } from '../utils/formatBookingWhen'
import { canModifyBooking } from '../utils/canModifyBooking'
import ClientRescheduleModal from './ClientRescheduleModal'
import './css/Dashboard.css'
import './css/ClientReschedule.css'

const ClientBookingList = ({ bookings, emptyMessage, onCancel, onReschedule, busyId }) => {
  const [rescheduleBooking, setRescheduleBooking] = useState(null)

  if (bookings.length === 0) {
    return (
      <p className="text-center text-muted dashboard-empty">
        {emptyMessage || 'No bookings yet.'}
      </p>
    )
  }

  const handleRescheduleSuccess = (message, updatedBooking) => {
    setRescheduleBooking(null)
    onReschedule?.(message, updatedBooking)
  }

  return (
    <>
      <div className="client-booking-list">
        {bookings.map((booking) => {
          const modifiable = canModifyBooking(booking)
          const isBusy = busyId === booking.id

          return (
            <article
              key={booking.id}
              className={`client-booking-card${booking.status === 'cancelled' ? ' is-cancelled' : ''}`}
            >
              <div className="client-booking-card-top">
                <h3 className="client-booking-service">{booking.service || 'Service not specified'}</h3>
                <span className="client-booking-when">{formatBookingWhen(booking)}</span>
              </div>
              <p className="client-booking-location">
                <span className={`booking-venue-pill booking-venue-pill--${booking.venue || 'indoor'}`}>
                  {booking.venue_label || venueLabel(booking.venue)}
                </span>
                {booking.location}
              </p>
              {booking.slot?.worker_name && (
                <p className="client-booking-worker">With {booking.slot.worker_name}</p>
              )}
              {!booking.slot?.worker_name && booking.preferred_worker_name && (
                <p className="client-booking-worker">Preferred: {booking.preferred_worker_name}</p>
              )}
              <p className="client-booking-meta">
                {booking.status === 'pending' && (
                  <span className="client-booking-status client-booking-status--pending">
                    Awaiting confirmation ·{' '}
                  </span>
                )}
                {booking.status === 'accepted' && (
                  <span className="client-booking-status client-booking-status--accepted">
                    Confirmed ·{' '}
                  </span>
                )}
                {booking.status === 'cancelled' && (
                  <span className="client-booking-status client-booking-status--cancelled">
                    Cancelled ·{' '}
                  </span>
                )}
                Requested {new Date(booking.created_at).toLocaleString()}
              </p>

              {modifiable && (
                <div className="client-booking-actions">
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    disabled={isBusy}
                    onClick={() => setRescheduleBooking(booking)}
                  >
                    Reschedule
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    disabled={isBusy}
                    onClick={() => onCancel?.(booking.id)}
                  >
                    {isBusy ? 'Cancelling…' : 'Cancel'}
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {rescheduleBooking && (
        <ClientRescheduleModal
          booking={rescheduleBooking}
          onClose={() => setRescheduleBooking(null)}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </>
  )
}

export default ClientBookingList
