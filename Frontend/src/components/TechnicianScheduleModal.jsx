/* eslint-disable react/prop-types */
import { useCallback, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { todayIso } from '../constants/slots'
import { apiFetch } from '../config/api'
import Bookservice from './Bookservice'
import './css/TechnicianSchedule.css'

const formatDayHeader = (isoDate) => {
  const date = new Date(`${isoDate}T12:00:00`)
  const today = todayIso()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowIso = tomorrow.toISOString().slice(0, 10)

  if (isoDate === today) {
    return 'Today'
  }
  if (isoDate === tomorrowIso) {
    return 'Tomorrow'
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

const slotStatusLabel = (status) => {
  if (status === 'available') {
    return 'Open'
  }
  if (status === 'booked') {
    return 'Booked'
  }
  return 'Off'
}

const TechnicianScheduleModal = ({ worker, salonId = null, onClose }) => {
  const modalId = `technician-schedule-${useId().replace(/:/g, '')}`
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scheduleData, setScheduleData] = useState(null)

  const loadSchedule = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiFetch(`/products/workers/${worker.id}/schedule/?days=14`)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not load schedule.')
      }

      setScheduleData(data)
    } catch (err) {
      setScheduleData(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [worker.id])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

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

  const visibleDays =
    scheduleData?.schedule?.filter((day) =>
      day.slots.some((slot) => slot.status === 'available' || slot.status === 'booked')
    ) ?? []

  const modal = (
    <>
      <div
        className="modal fade technician-schedule-modal show"
        id={modalId}
        tabIndex="-1"
        role="dialog"
        aria-labelledby={`${modalId}-label`}
        style={{ display: 'block' }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable technician-schedule-dialog">
          <div className="modal-content technician-schedule-content">
            <div className="modal-header">
              <div>
                <p className="technician-schedule-eyebrow">Availability</p>
                <h2 className="modal-title" id={`${modalId}-label`}>
                  {worker.name}&apos;s schedule
                </h2>
                <p className="technician-schedule-sub">
                  Next {scheduleData?.days ?? 14} days · no client details shown on booked slots
                </p>
              </div>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>

            <div className="modal-body">
              {loading && <p className="technician-schedule-status">Loading schedule…</p>}

              {!loading && error && (
                <div className="technician-schedule-status technician-schedule-status--error">
                  <p>{error}</p>
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadSchedule}>
                    Try again
                  </button>
                </div>
              )}

              {!loading && !error && scheduleData && (
                <>
                  <p className="technician-schedule-summary">
                    {scheduleData.open_slots > 0
                      ? `${scheduleData.open_slots} open slot${scheduleData.open_slots === 1 ? '' : 's'} in the next 2 weeks`
                      : 'No open slots in the next 2 weeks — check back soon'}
                  </p>

                  {visibleDays.length === 0 ? (
                    <p className="technician-schedule-empty">No upcoming sessions are scheduled yet.</p>
                  ) : (
                    <div className="technician-schedule-days">
                      {visibleDays.map((day) => (
                        <section key={day.date} className="technician-schedule-day">
                          <h3 className="technician-schedule-day-title">{formatDayHeader(day.date)}</h3>
                          <div className="technician-schedule-slots">
                            {day.slots
                              .filter((slot) => slot.status === 'available' || slot.status === 'booked')
                              .map((slot) => (
                                <span
                                  key={`${day.date}-${slot.start_hour}`}
                                  className={`technician-schedule-slot is-${slot.status}`}
                                >
                                  <span className="technician-schedule-slot-time">{slot.label}</span>
                                  <span className="technician-schedule-slot-status">
                                    {slotStatusLabel(slot.status)}
                                  </span>
                                </span>
                              ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer technician-schedule-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                Close
              </button>
              <Bookservice
                variant="card"
                workerId={worker.id}
                workerName={worker.name}
                salonId={salonId ?? worker.salon_id}
                label={`Book with ${worker.name}`}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" onClick={onClose} aria-hidden="true" />
    </>
  )

  return createPortal(modal, document.body)
}

export default TechnicianScheduleModal
