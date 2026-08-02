/* eslint-disable react/prop-types */
import { ROLE_LABELS } from '../constants/roles'
import { venueLabel } from '../constants/serviceVenue'
import './css/Dashboard.css'

const formatDate = (value) => new Date(value).toLocaleString()

const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  cancelled: 'Cancelled',
}

const BookingsTable = ({
  bookings,
  showDelete = false,
  onDelete = null,
  deletingId = null,
  showStatus = false,
  showActions = false,
  onAccept = null,
  onCancel = null,
  busyId = null,
  showSalon = false,
}) => {
  if (bookings.length === 0) {
    return <p className="text-center text-muted dashboard-empty">No bookings yet.</p>
  }

  return (
    <div className="dashboard-table-wrap table-responsive">
      <table className="table dashboard-table table-hover mb-0">
        <thead>
          <tr>
            <th>Client</th>
            <th>Phone</th>
            <th>Service</th>
            {showSalon && <th>Salon</th>}
            <th>Type</th>
            {showStatus && <th>Status</th>}
            <th>Location</th>
            <th>Appointment</th>
            <th>Booked</th>
            {(showDelete || showActions) && <th aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td>{booking.name}</td>
              <td>
                <a href={`tel:${booking.phone}`}>{booking.phone}</a>
              </td>
              <td>{booking.service || '—'}</td>
              {showSalon && <td>{booking.salon_name || '—'}</td>}
              <td>
                <span className={`booking-venue-pill booking-venue-pill--${booking.venue || 'indoor'}`}>
                  {booking.venue_label || venueLabel(booking.venue)}
                </span>
              </td>
              {showStatus && (
                <td>
                  <span className={`booking-status-pill booking-status-pill--${booking.status || 'pending'}`}>
                    {STATUS_LABELS[booking.status] || booking.status}
                  </span>
                </td>
              )}
              <td>{booking.location}</td>
              <td>
                {booking.slot ? (
                  <>
                    {new Date(`${booking.slot.date}T12:00:00`).toLocaleDateString()}
                    <br />
                    <span className="dashboard-slot-label">{booking.slot.label}</span>
                    {booking.slot.worker_name && (
                      <>
                        <br />
                        <span className="text-muted">{booking.slot.worker_name}</span>
                      </>
                    )}
                  </>
                ) : booking.requested_date ? (
                  <>
                    {new Date(`${booking.requested_date}T12:00:00`).toLocaleDateString()}
                    <br />
                    <span className="dashboard-slot-label">Time TBC</span>
                    {booking.preferred_worker_name && (
                      <>
                        <br />
                        <span className="text-muted">{booking.preferred_worker_name}</span>
                      </>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td>{formatDate(booking.created_at)}</td>
              {(showDelete || showActions) && (
                <td className="dashboard-row-actions">
                  <div className="dashboard-confirm-actions">
                    {showActions && booking.status === 'pending' && onAccept && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onAccept(booking.id)}
                        disabled={busyId === booking.id}
                      >
                        Accept
                      </button>
                    )}
                    {showActions && booking.status !== 'cancelled' && onCancel && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onCancel(booking.id)}
                        disabled={busyId === booking.id}
                      >
                        Cancel
                      </button>
                    )}
                    {showDelete && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => onDelete?.(booking.id)}
                        disabled={deletingId === booking.id}
                      >
                        {deletingId === booking.id ? 'Removing...' : 'Delete'}
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const RoleBadge = ({ role }) => (
  <span className={`dashboard-role-pill dashboard-role-pill--${role}`}>
    {ROLE_LABELS[role] || role}
  </span>
)

export default BookingsTable
