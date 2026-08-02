/* eslint-disable react/prop-types */
import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { todayIso } from '../constants/slots'
import { apiFetch } from '../config/api'
import './css/ClientReschedule.css'

const ClientRescheduleModal = ({ booking, onClose, onSuccess }) => {
  const modalId = `reschedule-modal-${useId().replace(/:/g, '')}`
  const initialDate = booking.slot?.date || booking.requested_date || todayIso()
  const initialWorkerId = booking.slot?.worker_id || booking.preferred_worker_id || null

  const [appointmentDate, setAppointmentDate] = useState(initialDate)
  const [selectedWorkerId, setSelectedWorkerId] = useState(initialWorkerId)
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [workers, setWorkers] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [workersLoading, setWorkersLoading] = useState(true)
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)

  const loadWorkers = useCallback(async () => {
    setWorkersLoading(true)

    try {
      const response = await apiFetch('/products/workers/')
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not load technicians.')
      }

      setWorkers(data.workers || [])
    } catch (error) {
      setWorkers([])
      setStatus({ type: 'error', message: error.message })
    } finally {
      setWorkersLoading(false)
    }
  }, [])

  const loadAvailableSlots = useCallback(async (date, workerId) => {
    setSlotsLoading(true)

    try {
      const params = new URLSearchParams({ date })
      if (workerId) {
        params.set('worker_id', String(workerId))
      }

      const response = await apiFetch(`/products/slots/?${params.toString()}`)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not load time slots.')
      }

      setAvailableSlots(data.slots || [])
    } catch (error) {
      setAvailableSlots([])
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorkers()
  }, [loadWorkers])

  useEffect(() => {
    setSelectedSlotId(null)
    loadAvailableSlots(appointmentDate, selectedWorkerId)
  }, [appointmentDate, selectedWorkerId, loadAvailableSlots])

  useEffect(() => {
    document.body.classList.add('modal-open')
    document.body.style.overflow = 'hidden'

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.classList.remove('modal-open')
      document.body.style.removeProperty('overflow')
    }
  }, [onClose])

  const selectedWorker = workers.find((entry) => entry.id === selectedWorkerId)
  const selectedWorkerLabel =
    selectedWorker?.name || (selectedWorkerId ? 'Selected technician' : 'Any available')

  const formattedAppointmentDate = new Date(`${appointmentDate}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: 'long', month: 'long', day: 'numeric' }
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setStatus(null)

    const payload = selectedSlotId
      ? { slot_id: selectedSlotId }
      : {
          requested_date: appointmentDate,
          ...(selectedWorkerId ? { preferred_worker_id: selectedWorkerId } : {}),
        }

    try {
      const response = await apiFetch(`/products/bookings/mine/${booking.id}/reschedule/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not reschedule booking.')
      }

      onSuccess(data.message, data.booking)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const today = todayIso()

  const modal = (
    <>
      <div
        className="modal fade client-reschedule-modal show"
        id={modalId}
        tabIndex="-1"
        role="dialog"
        aria-labelledby={`${modalId}-label`}
        style={{ display: 'block' }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content client-reschedule-content">
            <div className="modal-header">
              <h2 className="modal-title h5" id={`${modalId}-label`}>
                Reschedule {booking.service || 'appointment'}
              </h2>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
            </div>
            <div className="modal-body">
              {status && (
                <div className={`alert alert-${status.type === 'success' ? 'success' : 'danger'}`}>
                  {status.message}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <span className="form-label d-block">Technician (optional)</span>
                  {workersLoading ? (
                    <p className="client-reschedule-empty">Loading technicians…</p>
                  ) : (
                    <div className="client-reschedule-worker-grid">
                      <button
                        type="button"
                        className={`client-reschedule-chip${selectedWorkerId == null ? ' is-selected' : ''}`}
                        onClick={() => setSelectedWorkerId(null)}
                      >
                        Any available
                      </button>
                      {workers.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={`client-reschedule-chip${selectedWorkerId === entry.id ? ' is-selected' : ''}`}
                          onClick={() => setSelectedWorkerId(entry.id)}
                        >
                          {entry.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <label htmlFor={`${modalId}-date`} className="form-label">
                    New appointment date
                  </label>
                  <input
                    id={`${modalId}-date`}
                    type="date"
                    className="form-control"
                    value={appointmentDate}
                    min={today}
                    onChange={(event) => setAppointmentDate(event.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <span className="form-label d-block">
                    Time slot <span className="client-reschedule-optional">(optional)</span>
                  </span>
                  <p className="client-reschedule-date-note">{formattedAppointmentDate}</p>
                  {selectedWorkerId != null && (
                    <p className="client-reschedule-worker-note">
                      Showing times for <strong>{selectedWorkerLabel}</strong>
                    </p>
                  )}

                  {slotsLoading ? (
                    <p className="client-reschedule-empty">Loading available slots…</p>
                  ) : availableSlots.length === 0 ? (
                    <p className="client-reschedule-empty client-reschedule-empty--soft">
                      No open slots for this day. You can still send a date request — staff will
                      confirm your new time.
                    </p>
                  ) : (
                    <div className="client-reschedule-slot-grid">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          className={`client-reschedule-slot${selectedSlotId === slot.id ? ' is-selected' : ''}`}
                          onClick={() => setSelectedSlotId(slot.id)}
                        >
                          <span>{slot.label}</span>
                          {selectedWorkerId == null && (
                            <span className="client-reschedule-slot-worker">{slot.worker_name}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="client-reschedule-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                    Keep current time
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving…' : selectedSlotId ? 'Confirm new slot' : 'Send new date request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" aria-hidden="true" />
    </>
  )

  return createPortal(modal, document.body)
}

export default ClientRescheduleModal
