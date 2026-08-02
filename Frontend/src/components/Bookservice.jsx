/* eslint-disable react/prop-types */
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { todayIso } from '../constants/slots'
import {
  SERVICE_VENUES,
  SALON_LOCATION,
  resolveBookingLocation,
  venueLocationLabel,
  venueLocationPlaceholder,
} from '../constants/serviceVenue'
import { useAuth } from '../context/useAuth'
import { apiFetch } from '../config/api'
import { withRedirect } from '../utils/redirect'
import BrandLogo from './BrandLogo'
import TechnicianPicker from './TechnicianPicker'
import { priceList } from './servicesData'
import './css/Bookservice.css'

const emptyForm = { name: '', phone: '', location: '', service: '', venue: 'indoor' }

const parseWorkerId = (value) => {
  if (value == null || value === '') {
    return null
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const formFromUser = (user, service = '') => {
  const base = {
    name: '',
    phone: '',
    location: '',
    service,
    venue: 'indoor',
  }

  if (!user) {
    return base
  }

  return {
    ...base,
    name: user.name || '',
    phone: user.phone || '',
    location: user.default_location || '',
  }
}

const isOutdoorVenue = (venue) => venue === 'outdoor'

const Bookservice = ({
  serviceName = '',
  variant = 'cta',
  label = '',
  workerId = null,
  workerName = '',
  salonId = null,
}) => {
  const modalId = `booking-modal-${useId().replace(/:/g, '')}`
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [appointmentDate, setAppointmentDate] = useState(todayIso())
  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlotId, setSelectedSlotId] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [workers, setWorkers] = useState([])
  const [workersLoading, setWorkersLoading] = useState(false)
  const [selectedWorkerId, setSelectedWorkerId] = useState(null)
  const [salons, setSalons] = useState([])
  const [salonsLoading, setSalonsLoading] = useState(false)
  const [selectedSalonId, setSelectedSalonId] = useState(null)

  const prefilledWorkerId = useMemo(
    () =>
      parseWorkerId(workerId) ??
      parseWorkerId(searchParams.get('worker')) ??
      parseWorkerId(searchParams.get('technician')),
    [workerId, searchParams]
  )

  const prefilledSalonId = useMemo(
    () => parseWorkerId(salonId) ?? parseWorkerId(searchParams.get('salon')),
    [salonId, searchParams]
  )

  const prefilledService =
    serviceName || searchParams.get('service') || searchParams.get('serviceName') || ''

  const hasFixedService = Boolean(serviceName)

  const canBook = Boolean(user && user.role === 'client' && !user.technician_pending)
  const returnPath = `${location.pathname}${location.search}`
  const loginPath = withRedirect('/login', returnPath)
  const signupPath = withRedirect('/signup', returnPath)
  const selectedWorker = workers.find((entry) => entry.id === selectedWorkerId)
  const selectedWorkerLabel =
    selectedWorker?.name || workerName || (selectedWorkerId ? 'Selected technician' : 'Any available')
  const isFreelanceBooking = Boolean(selectedWorker?.is_freelance)
  const selectedSalon = useMemo(() => {
    if (!salons.length) {
      return null
    }
    if (selectedSalonId != null) {
      return salons.find((entry) => entry.id === selectedSalonId) || salons[0]
    }
    return salons.find((entry) => entry.is_primary) || salons[0]
  }, [salons, selectedSalonId])
  const indoorSalonLocation = selectedSalon?.location || SALON_LOCATION
  const showSalonPicker = salons.length > 0 && !isFreelanceBooking

  const closeModal = useCallback(() => {
    setIsOpen(false)
  }, [])

  const openModal = useCallback(() => {
    setIsOpen(true)
  }, [])

  const loadSalons = useCallback(async (applyInitialSelection = false, initialSalonId = null) => {
    setSalonsLoading(true)

    try {
      const response = await apiFetch('/products/salons/')
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not load salon locations.')
      }

      const nextSalons = data.salons || []
      setSalons(nextSalons)

      if (applyInitialSelection) {
        const preferredSalon =
          (initialSalonId && nextSalons.find((entry) => entry.id === initialSalonId)) ||
          (prefilledSalonId && nextSalons.find((entry) => entry.id === prefilledSalonId)) ||
          nextSalons.find((entry) => entry.is_primary) ||
          nextSalons[0]
        setSelectedSalonId(preferredSalon?.id ?? null)
      }
    } catch {
      setSalons([])
      if (applyInitialSelection) {
        setSelectedSalonId(null)
      }
    } finally {
      setSalonsLoading(false)
    }
  }, [prefilledSalonId])

  const loadWorkers = useCallback(async (filterSalonId) => {
    setWorkersLoading(true)

    try {
      const params = new URLSearchParams()
      if (filterSalonId) {
        params.set('salon_id', String(filterSalonId))
      }
      const query = params.toString()
      const response = await apiFetch(query ? `/products/workers/?${query}` : '/products/workers/')
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

  const loadAvailableSlots = useCallback(async (date, filterWorkerId) => {
    setSlotsLoading(true)

    try {
      const params = new URLSearchParams({ date })
      if (filterWorkerId) {
        params.set('worker_id', String(filterWorkerId))
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
    if (!isOpen || !canBook) {
      return undefined
    }

    setStatus(null)
    setForm(formFromUser(user, prefilledService))
    setAppointmentDate(todayIso())
    setSelectedSlotId(null)
    setSelectedWorkerId(prefilledWorkerId)
    loadSalons(true, prefilledSalonId)
  }, [isOpen, canBook, user, prefilledService, prefilledWorkerId, loadSalons, prefilledSalonId])

  useEffect(() => {
    if (!isOpen || !canBook || salonsLoading) {
      return undefined
    }

    loadWorkers(selectedSalonId)
  }, [selectedSalonId, isOpen, canBook, salonsLoading, loadWorkers])

  useEffect(() => {
    if (!isOpen || !canBook || workersLoading) {
      return undefined
    }

    if (selectedWorkerId != null && !workers.some((entry) => entry.id === selectedWorkerId)) {
      setSelectedWorkerId(null)
    }
  }, [workers, workersLoading, selectedWorkerId, isOpen, canBook])

  useEffect(() => {
    if (!isOpen || !canBook || workersLoading) {
      return undefined
    }

    if (prefilledWorkerId && workers.some((entry) => entry.id === prefilledWorkerId)) {
      setSelectedWorkerId(prefilledWorkerId)
    }
  }, [isOpen, canBook, workers, workersLoading, prefilledWorkerId])

  useEffect(() => {
    if (!isOpen || !canBook || !isFreelanceBooking) {
      return undefined
    }

    setForm((current) => ({
      ...current,
      venue: 'outdoor',
      location: current.location || user?.default_location || '',
    }))
  }, [isOpen, canBook, isFreelanceBooking, selectedWorkerId, user?.default_location])

  useEffect(() => {
    if (!isOpen || !canBook) {
      return undefined
    }

    setSelectedSlotId(null)
    loadAvailableSlots(appointmentDate, selectedWorkerId)
  }, [appointmentDate, selectedWorkerId, isOpen, canBook, loadAvailableSlots])

  useEffect(() => {
    if (!isOpen) {
      document.body.classList.remove('modal-open')
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('padding-right')
      return undefined
    }

    document.body.classList.add('modal-open')
    document.body.style.overflow = 'hidden'

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.classList.remove('modal-open')
      document.body.style.removeProperty('overflow')
      document.body.style.removeProperty('padding-right')
    }
  }, [isOpen, closeModal])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleVenueSelect = (venue) => {
    setForm((current) => ({
      ...current,
      venue,
      location: isOutdoorVenue(venue) ? current.location : '',
    }))
  }

  const handleWorkerSelect = (id) => {
    setSelectedWorkerId(id)
    setSelectedSlotId(null)
    const worker = workers.find((entry) => entry.id === id)
    if (worker?.is_freelance) {
      setForm((current) => ({
        ...current,
        venue: 'outdoor',
        location: current.location || user?.default_location || '',
      }))
    }
  }

  const handleServiceSelect = (event) => {
    setForm({ ...form, service: event.target.value })
  }

  const handleSalonSelect = (event) => {
    setSelectedSalonId(Number(event.target.value))
    setSelectedSlotId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const requiresAddress = isFreelanceBooking || isOutdoorVenue(form.venue)
    if (requiresAddress && !form.location.trim()) {
      setStatus({
        type: 'error',
        message: isFreelanceBooking
          ? 'Please enter your address for the freelance visit.'
          : 'Please enter your address for outdoor service.',
      })
      return
    }

    if (!hasFixedService && !form.service.trim()) {
      setStatus({ type: 'error', message: 'Please choose a service.' })
      return
    }

    setLoading(true)
    setStatus(null)

    const service = form.service.trim() || serviceName
    const bookingVenue = isFreelanceBooking ? 'outdoor' : form.venue
    const bookingLocation = isFreelanceBooking
      ? form.location.trim()
      : bookingVenue === 'indoor'
        ? indoorSalonLocation
        : resolveBookingLocation(form.venue, form.location)
    const payload = {
      ...form,
      service,
      venue: bookingVenue,
      location: bookingLocation,
      requested_date: appointmentDate,
    }

    if (selectedSalon?.id && !isFreelanceBooking) {
      payload.salon_id = selectedSalon.id
    }

    if (selectedSlotId) {
      payload.slot_id = selectedSlotId
    } else if (selectedWorkerId) {
      payload.preferred_worker_id = selectedWorkerId
    }

    try {
      const response = await apiFetch('/products/bookings/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      const text = await response.text()
      let data = {}

      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          throw new Error(
            response.ok
              ? 'Invalid response from server.'
              : `Server error (${response.status}). Make sure Django is running on port 8000.`
          )
        }
      } else if (!response.ok) {
        throw new Error(
          'Cannot reach the booking server. Start the backend: python manage.py runserver 0.0.0.0:8000'
        )
      }

      if (!response.ok) {
        throw new Error(data.error || 'Booking failed.')
      }

      setStatus({ type: 'success', message: data.message })
      setForm(formFromUser(user, prefilledService))
      setSelectedSlotId(null)
      loadAvailableSlots(appointmentDate, selectedWorkerId)
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const displayService = form.service || prefilledService
  const today = todayIso()
  const isTodaySelected = appointmentDate === today
  const formattedAppointmentDate = new Date(`${appointmentDate}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: 'long', month: 'long', day: 'numeric' }
  )
  const triggerLabel =
    label ||
    (workerName
      ? `Book with ${workerName}`
      : variant === 'cta'
        ? 'Book now'
        : variant === 'table'
          ? prefilledService || serviceName
          : 'Book service')

  const handleClose = (event) => {
    event.preventDefault()
    event.stopPropagation()
    closeModal()
  }

  const handleOpen = (event) => {
    event.stopPropagation()
    openModal()
  }

  if (!isOpen) {
    return (
      <div className={`booking-trigger${variant === 'table' ? ' booking-trigger--table' : ''}`}>
        <button
          type="button"
          className={`btn btn-primary booking-btn booking-btn--${variant}`}
          onClick={handleOpen}
          data-booking-trigger
        >
          {triggerLabel}
        </button>
      </div>
    )
  }

  const modal = (
    <>
      <div
        className="modal fade booking-modal show"
        id={modalId}
        tabIndex="-1"
        aria-labelledby={`${modalId}-label`}
        aria-hidden={false}
        style={{ display: 'block' }}
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable booking-modal-dialog">
          <div className="modal-content booking-modal-content">
            <div className="modal-header booking-modal-header">
              <div className="booking-modal-header-main">
                <BrandLogo size="sm" />
                <h2 className="modal-title booking-modal-title" id={`${modalId}-label`}>
                  Book{displayService ? ` — ${displayService}` : ''}
                </h2>
              </div>
              <button
                type="button"
                className="btn-close booking-modal-close"
                onClick={handleClose}
                aria-label="Close"
              />
            </div>
            <div className="modal-body booking-modal-body">
            {authLoading ? (
              <p className="text-muted mb-0">Checking your account…</p>
            ) : !canBook ? (
              <div className="booking-auth-gate">
                <p className="booking-auth-gate__lead">
                  Create a free client account to book and manage your appointments in one place.
                </p>
                {user && user.role !== 'client' && (
                  <p className="text-muted booking-auth-gate__note">
                    Staff and admin accounts cannot book here. Use your dashboard instead.
                  </p>
                )}
                <div className="booking-auth-gate__actions">
                  <Link to={loginPath} className="btn btn-primary" onClick={closeModal}>
                    Log in
                  </Link>
                  <Link to={signupPath} className="btn btn-outline-primary" onClick={closeModal}>
                    Create account
                  </Link>
                </div>
              </div>
            ) : (
              <>
            {user && (
              <p className="booking-prefill-note">
                Booking as <strong>{user.name}</strong>
              </p>
            )}

            {status && (
              <div className={`alert alert-${status.type === 'success' ? 'success' : 'danger'}`}>
                {status.message}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor={`${modalId}-service`} className="form-label">
                  Service
                </label>
                {hasFixedService ? (
                  <input
                    type="text"
                    className="form-control"
                    id={`${modalId}-service`}
                    name="service"
                    value={form.service}
                    onChange={handleChange}
                    readOnly
                    required
                  />
                ) : (
                  <select
                    id={`${modalId}-service`}
                    className="form-select site-select booking-service-select"
                    name="service"
                    value={form.service}
                    onChange={handleServiceSelect}
                    required
                  >
                    <option value="">Select a service</option>
                    {priceList.map(({ id, name, price }) => (
                      <option key={id} value={name}>
                        {name} — KSh {price.toLocaleString()}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mb-3">
                <label htmlFor={`${modalId}-name`} className="form-label">
                  Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  id={`${modalId}-name`}
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  readOnly={Boolean(user)}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor={`${modalId}-phone`} className="form-label">
                  Phone
                </label>
                <input
                  type="tel"
                  className="form-control"
                  id={`${modalId}-phone`}
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  inputMode="tel"
                  readOnly={Boolean(user)}
                  required
                />
              </div>

              {showSalonPicker && (
                <div className="mb-3">
                  <label htmlFor={`${modalId}-salon`} className="form-label">
                    Salon location
                  </label>
                  {salonsLoading ? (
                    <p className="booking-worker-empty">Loading salon locations...</p>
                  ) : (
                    <select
                      id={`${modalId}-salon`}
                      className="form-select site-select"
                      value={selectedSalonId ?? ''}
                      onChange={handleSalonSelect}
                      required
                    >
                      {salons.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} — {entry.location}
                        </option>
                      ))}
                    </select>
                  )}
                  {salons.length > 1 && (
                    <p className="booking-salon-picker-note">
                      Choose a different salon anytime — available technicians update automatically.
                    </p>
                  )}
                </div>
              )}

              <div className="mb-3">
                <TechnicianPicker
                  modalId={modalId}
                  workers={workers}
                  selectedWorkerId={selectedWorkerId}
                  onChange={handleWorkerSelect}
                  loading={workersLoading}
                />
                {selectedWorkerId != null && (
                  <p className="booking-worker-note">
                    Showing times for <strong>{selectedWorkerLabel}</strong>
                  </p>
                )}
              </div>

              <div className="mb-3">
                <label htmlFor={`${modalId}-date`} className="form-label">
                  Appointment date
                </label>
                <div className="booking-date-row">
                  <input
                    type="date"
                    className="form-control"
                    id={`${modalId}-date`}
                    value={appointmentDate}
                    min={today}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className={`booking-date-today-btn${isTodaySelected ? ' is-selected' : ''}`}
                    onClick={() => setAppointmentDate(today)}
                    aria-label="Set appointment date to today"
                    aria-pressed={isTodaySelected}
                  >
                    Today
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <span className="form-label d-block">
                  2-hour time slot <span className="booking-slot-optional">(optional)</span>
                </span>
                <p className="booking-slot-date-note">{formattedAppointmentDate}</p>

                {slotsLoading ? (
                  <p className="booking-slot-empty">Loading available slots...</p>
                ) : availableSlots.length === 0 ? (
                  <p className="booking-slot-empty booking-slot-empty--soft">
                    No open slots for this day
                    {selectedWorkerId ? ` with ${selectedWorkerLabel}` : ''}. You can still send
                    your request — we will confirm a time with you.
                  </p>
                ) : (
                  <div className="booking-slot-grid">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        className={`booking-slot-btn${selectedSlotId === slot.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedSlotId(slot.id)}
                      >
                        <span className="booking-slot-time">{slot.label}</span>
                        {selectedWorkerId == null && (
                          <span className="booking-slot-worker">{slot.worker_name}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isFreelanceBooking ? (
                <div className="mb-3">
                  <label htmlFor={`${modalId}-location`} className="form-label">
                    Your address
                  </label>
                  <p className="booking-freelance-note">
                    Freelance technicians come to you — enter where you want to be seen.
                  </p>
                  <input
                    type="text"
                    className="form-control"
                    id={`${modalId}-location`}
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder={venueLocationPlaceholder('outdoor')}
                    autoComplete="street-address"
                    required
                  />
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <span className="form-label d-block">Service location</span>
                    <div className="booking-venue-grid">
                      {SERVICE_VENUES.map(({ value, label, hint, icon }) => (
                        <button
                          key={value}
                          type="button"
                          className={`booking-venue-btn${form.venue === value ? ' is-selected' : ''}`}
                          onClick={() => handleVenueSelect(value)}
                        >
                          <i className={icon} aria-hidden="true" />
                          <span className="booking-venue-label">{label}</span>
                          <span className="booking-venue-hint">{hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    {isOutdoorVenue(form.venue) ? (
                      <>
                        <label htmlFor={`${modalId}-location`} className="form-label">
                          {venueLocationLabel(form.venue)}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          id={`${modalId}-location`}
                          name="location"
                          value={form.location}
                          onChange={handleChange}
                          placeholder={venueLocationPlaceholder(form.venue)}
                          autoComplete="street-address"
                          required
                        />
                      </>
                    ) : (
                      <div className="booking-salon-info">
                        <span className="form-label d-block">{venueLocationLabel(form.venue)}</span>
                        <p className="booking-salon-info__address">
                          <i className="fa-solid fa-location-dot" aria-hidden="true" />
                          {indoorSalonLocation}
                        </p>
                        {selectedSalon?.name && (
                          <p className="booking-salon-info__hint">
                            {selectedSalon.name} — your appointment will be at our salon.
                          </p>
                        )}
                        {!selectedSalon?.name && (
                          <p className="booking-salon-info__hint">
                            Your appointment will be at our salon — no address needed.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="booking-modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={handleClose}>
                  Quit
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Sending...' : selectedSlotId ? 'Send' : 'Send request'}
                </button>
              </div>
            </form>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" aria-hidden="true" />
    </>
  )

  return (
    <div className={`booking-trigger${variant === 'table' ? ' booking-trigger--table' : ''}`}>
      <button
        type="button"
        className={`btn btn-primary booking-btn booking-btn--${variant}`}
        onClick={handleOpen}
        data-booking-trigger
      >
        {triggerLabel}
      </button>
      {createPortal(modal, document.body)}
    </div>
  )
}

export default Bookservice
