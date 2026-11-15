/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayIso } from '../constants/slots'
import { apiFetch } from '../config/api'
import './css/Dashboard.css'

const MANAGE_PATH = '/products/slots/manage/'
const TOGGLE_PATH = '/products/slots/toggle/'
const OFF_DAY_PATH = '/products/slots/off-day/'

const STATUS_LABELS = {
  available: 'Open',
  booked: 'Booked online',
  unavailable: 'Off',
}

const bookingStatusLabel = (slot) => {
  if (slot.status === 'booked' && slot.booking?.is_walk_in) {
    return 'Walk-in'
  }
  if (slot.status === 'booked' && slot.booking?.status === 'pending') {
    return 'Pending online'
  }
  return STATUS_LABELS[slot.status]
}

const DAY_KIND_LABELS = {
  off: 'Off day — no open hours',
  online: 'Has online bookings',
  walk_in: 'Has walk-in / manual bookings',
  mixed: 'Online and walk-in bookings',
  open: 'Working day',
}

const cloneSlots = (slots) => slots.map((slot) => ({ ...slot }))

const WorkerSchedule = ({ onChanged = null }) => {
  const [date, setDate] = useState(todayIso())
  const [savedSlots, setSavedSlots] = useState([])
  const [draftSlots, setDraftSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [offDayLoading, setOffDayLoading] = useState(false)
  const [walkIns, setWalkIns] = useState([])
  const [dayKind, setDayKind] = useState(null)

  const loadSlots = useCallback(async (signal) => {
    setLoading(true)
    setStatus(null)

    try {
      const response = await apiFetch(`${MANAGE_PATH}?date=${date}`, { signal })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not load schedule.')
      }

      const nextSlots = data.slots || []
      setSavedSlots(nextSlots)
      setDraftSlots(cloneSlots(nextSlots))
      setWalkIns(data.walk_ins || [])
      setDayKind(data.day || null)
    } catch (error) {
      if (signal?.aborted) {
        return
      }
      setStatus({ type: 'error', message: error.message })
      setSavedSlots([])
      setDraftSlots([])
      setWalkIns([])
      setDayKind(null)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [date])

  useEffect(() => {
    const controller = new AbortController()
    loadSlots(controller.signal)
    return () => controller.abort()
  }, [loadSlots])

  const hasChanges = useMemo(() => {
    if (savedSlots.length !== draftSlots.length) {
      return true
    }

    return draftSlots.some((slot, index) => {
      const saved = savedSlots[index]
      if (!saved || slot.start_hour !== saved.start_hour) {
        return true
      }
      if (slot.status === 'booked' || saved.status === 'booked') {
        return false
      }
      return slot.status !== saved.status
    })
  }, [draftSlots, savedSlots])

  const shiftDate = (days) => {
    if (hasChanges) {
      const leave = window.confirm('You have unsaved working hours. Discard changes and change day?')
      if (!leave) {
        return
      }
    }

    const next = new Date(`${date}T12:00:00`)
    next.setDate(next.getDate() + days)
    setDate(next.toISOString().slice(0, 10))
  }

  const handleDateChange = (nextDate) => {
    if (hasChanges) {
      const leave = window.confirm('You have unsaved working hours. Discard changes and change day?')
      if (!leave) {
        return
      }
    }
    setDate(nextDate)
  }

  const toggleDraftSlot = (slot) => {
    if (slot.status === 'booked') {
      return
    }

    setDraftSlots((current) =>
      current.map((item) => {
        if (item.start_hour !== slot.start_hour || item.status === 'booked') {
          return item
        }

        return {
          ...item,
          status: item.status === 'available' ? 'unavailable' : 'available',
        }
      })
    )
  }

  const handleCancelChanges = () => {
    setDraftSlots(cloneSlots(savedSlots))
    setStatus(null)
  }

  const handleSubmitSchedule = async () => {
    const changes = draftSlots.filter((slot, index) => {
      const saved = savedSlots[index]
      if (!saved || slot.status === 'booked' || saved.status === 'booked') {
        return false
      }
      return slot.status !== saved.status
    })

    if (changes.length === 0) {
      return
    }

    setSaving(true)
    setStatus(null)

    try {
      for (const slot of changes) {
        const response = await apiFetch(TOGGLE_PATH, {
          method: 'POST',
          body: JSON.stringify({
            date,
            start_hour: slot.start_hour,
            status: slot.status,
          }),
        })

        const text = await response.text()
        const data = text ? JSON.parse(text) : {}

        if (!response.ok) {
          throw new Error(data.error || `Could not update ${slot.label}.`)
        }
      }

      setStatus({ type: 'success', message: 'Working hours saved.' })
      await loadSlots()
      onChanged?.()
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  const markOffDay = async () => {
    const confirmed = window.confirm(
      `Mark all open slots off for ${formattedDate}? Existing bookings will stay.`
    )
    if (!confirmed) {
      return
    }

    setOffDayLoading(true)
    setStatus(null)

    try {
      const response = await apiFetch(OFF_DAY_PATH, {
        method: 'POST',
        body: JSON.stringify({ date }),
      })

      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not mark off day.')
      }

      setStatus({ type: 'success', message: data.message })
      await loadSlots()
      onChanged?.()
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setOffDayLoading(false)
    }
  }

  const formattedDate = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="worker-schedule mb-4">
      <div className="worker-schedule-header">
        <div>
          <h2 className="worker-schedule-title">Your 2-hour slots</h2>
          <p className="text-muted mb-0 worker-schedule-subtitle">
            Tap hours to open or mark off. Online and walk-in bookings stay locked.
          </p>
        </div>
        <div className="worker-schedule-nav">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => shiftDate(-1)}>
            ← Prev
          </button>
          <input
            type="date"
            className="form-control form-control-sm worker-schedule-date"
            value={date}
            min={todayIso()}
            onChange={(e) => handleDateChange(e.target.value)}
          />
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => shiftDate(1)}>
            Next →
          </button>
        </div>
      </div>

      <p className="worker-schedule-day text-center text-muted">{formattedDate}</p>
      {dayKind?.kind && (
        <p className={`worker-schedule-day-kind worker-schedule-day-kind--${dayKind.kind}`}>
          {DAY_KIND_LABELS[dayKind.kind] || 'Working day'}
        </p>
      )}

      <ul className="worker-schedule-legend" aria-label="Slot colours">
        <li><span className="worker-legend-swatch worker-legend-swatch--open" /> Open</li>
        <li><span className="worker-legend-swatch worker-legend-swatch--off" /> Off</li>
        <li><span className="worker-legend-swatch worker-legend-swatch--online" /> Booked online</li>
        <li><span className="worker-legend-swatch worker-legend-swatch--walkin" /> Walk-in</li>
      </ul>

      <div className="worker-schedule-offday-wrap">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary worker-offday-btn"
          onClick={markOffDay}
          disabled={offDayLoading || saving}
        >
          {offDayLoading ? 'Saving…' : 'Mark off day'}
        </button>
      </div>

      {status && (
        <div className={`alert alert-${status.type === 'error' ? 'danger' : 'success'} py-2`}>
          {status.message}
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted">Loading schedule...</p>
      ) : (
        <div className="worker-slot-grid">
          {draftSlots.map((slot) => {
            const saved = savedSlots.find((item) => item.start_hour === slot.start_hour)
            const isBooked = slot.status === 'booked'
            const isWalkIn = isBooked && Boolean(slot.booking?.is_walk_in)
            const isPending = isBooked && slot.booking?.status === 'pending' && !isWalkIn
            const isAvailable = slot.status === 'available'
            const isDirty =
              !isBooked &&
              saved &&
              saved.status !== 'booked' &&
              slot.status !== saved.status
            const cardStatus = isWalkIn ? 'walk_in' : isPending ? 'pending' : slot.status

            return (
              <button
                key={slot.start_hour}
                type="button"
                className={`worker-slot-card worker-slot-card--${cardStatus}${
                  isDirty ? ' worker-slot-card--dirty' : ''
                }`}
                onClick={() => toggleDraftSlot(slot)}
                disabled={isBooked || saving}
                title={
                  isPending
                    ? slot.booking
                      ? `Pending — ${slot.booking.name}`
                      : 'Pending booking'
                    : isBooked
                      ? slot.booking
                        ? `Booked by ${slot.booking.name}`
                        : 'Booked'
                      : isAvailable
                        ? 'Click to mark off'
                        : 'Click to mark available'
                }
              >
                <span className="worker-slot-time">{slot.label}</span>
                <span className="worker-slot-status">{bookingStatusLabel(slot)}</span>
                {isBooked && slot.booking && (
                  <span className="worker-slot-client">
                    {isWalkIn ? 'Walk-in' : 'Online'} · {slot.booking.name}
                    {slot.booking.service ? ` · ${slot.booking.service}` : ''}
                  </span>
                )}
                {!isBooked && (
                  <span className="worker-slot-hint">
                    {isDirty ? 'Changed — submit below' : 'Tap to toggle'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {!loading && walkIns.length > 0 && (
        <div className="worker-schedule-walkins">
          <h3 className="worker-schedule-walkins-title">Walk-ins this day (no clocked hour)</h3>
          <ul>
            {walkIns.map((entry) => (
              <li key={entry.id}>
                {entry.name} · {entry.service || 'Service'} · {entry.phone}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasChanges && !loading && (
        <div className="worker-schedule-submit-bar">
          <p className="worker-schedule-submit-note">You have unsaved working hours for this day.</p>
          <div className="worker-schedule-submit-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmitSchedule}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Submit working hours'}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleCancelChanges}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkerSchedule
