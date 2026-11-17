import { useCallback, useEffect, useMemo, useState } from 'react'
import { SLOT_HOURS, formatSlotLabel, todayIso } from '../constants/slots'
import { apiFetch, parseApiResponse } from '../config/api'

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
  specialty: '',
  salon_id: '',
  placement: 'salon',
  location: '',
  service_latitude: '',
  service_longitude: '',
}

const AdminStaffRoster = ({ salons, salonId, salonQuery = '', onStatus, onChanged }) => {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [slotDate, setSlotDate] = useState(todayIso())
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsSaving, setSlotsSaving] = useState(false)
  const [dayWalkIns, setDayWalkIns] = useState([])

  const staffQuery = salonQuery ? `?${salonQuery.replace(/^\?/, '')}` : ''

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`/products/admin/technicians/staff/${staffQuery}`)
      const data = await parseApiResponse(response, 'Technicians')
      const next = data.technicians || []
      setStaff(next)
      setSelectedId((current) => {
        if (current && next.some((entry) => String(entry.id) === String(current))) {
          return current
        }
        return next[0] ? String(next[0].id) : ''
      })
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
      setStaff([])
    } finally {
      setLoading(false)
    }
  }, [staffQuery, onStatus])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const loadSlots = useCallback(async () => {
    if (!selectedId) {
      setSlots([])
      setDayWalkIns([])
      return
    }
    setSlotsLoading(true)
    try {
      const response = await apiFetch(
        `/products/admin/technicians/${selectedId}/slots/?date=${slotDate}`
      )
      const data = await parseApiResponse(response, 'Availability')
      setSlots(data.slots || [])
      setDayWalkIns(data.walk_ins || [])
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
      setSlots([])
      setDayWalkIns([])
    } finally {
      setSlotsLoading(false)
    }
  }, [selectedId, slotDate, onStatus])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  const defaultSalonId = useMemo(() => {
    if (salonId && salonId !== 'all') {
      return String(salonId)
    }
    return form.salon_id || (salons[0] ? String(salons[0].id) : '')
  }, [salonId, form.salon_id, salons])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    setSaving(true)
    onStatus?.(null)
    const isFreelance = form.placement === 'freelance'
    const salon_id = Number(form.salon_id || defaultSalonId)
    if (!isFreelance && !Number.isFinite(salon_id)) {
      onStatus?.({ type: 'error', message: 'Choose a salon, or add them as a freelancer.' })
      setSaving(false)
      return
    }
    if (isFreelance && !form.location.trim() && !form.service_latitude && !form.service_longitude) {
      onStatus?.({
        type: 'error',
        message: 'Add a service area or GPS so this freelancer shows on the landing map.',
      })
      setSaving(false)
      return
    }
    try {
      const response = await apiFetch('/products/admin/technicians/create/', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          password: form.password,
          specialty: form.specialty,
          placement: form.placement,
          technician_is_freelance: isFreelance,
          salon_id: isFreelance ? null : salon_id,
          location: isFreelance ? form.location : undefined,
          service_latitude: isFreelance ? form.service_latitude || null : undefined,
          service_longitude: isFreelance ? form.service_longitude || null : undefined,
        }),
      })
      const data = await parseApiResponse(response, 'Add technician')
      setForm(emptyForm)
      setShowForm(false)
      onStatus?.({
        type: 'success',
        title: 'Technician added',
        message: data.message || 'The technician was saved to your list.',
      })
      await loadStaff()
      onChanged?.()
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  const toggleHour = (hour, status) => {
    if (status === 'booked') {
      return
    }
    setSlots((current) =>
      current.map((slot) => {
        if (slot.start_hour !== hour || slot.status === 'booked') {
          return slot
        }
        return {
          ...slot,
          status: slot.status === 'available' ? 'unavailable' : 'available',
        }
      })
    )
  }

  const handleSaveSlots = async () => {
    if (!selectedId) {
      return
    }
    setSlotsSaving(true)
    onStatus?.(null)
    const available_hours = slots
      .filter((slot) => slot.status === 'available' || slot.status === 'booked')
      .map((slot) => slot.start_hour)
    try {
      const response = await apiFetch(`/products/admin/technicians/${selectedId}/slots/save/`, {
        method: 'POST',
        body: JSON.stringify({ date: slotDate, available_hours }),
      })
      const data = await parseApiResponse(response, 'Save hours')
      setSlots(data.slots || [])
      onStatus?.({
        type: 'success',
        title: 'Hours saved',
        message: data.message || 'Availability was updated.',
      })
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setSlotsSaving(false)
    }
  }

  const selectedTech = staff.find((entry) => String(entry.id) === String(selectedId))
  const displaySlots = slots.length
    ? slots
    : SLOT_HOURS.map((hour) => ({
        start_hour: hour,
        status: 'available',
        label: formatSlotLabel(hour),
      }))

  return (
    <div className="admin-staff-roster">
      <div className="admin-walkin-toolbar">
        <p className="admin-walkin-lead mb-0">
          Add a salon team member or a freelancer. Hours stay open for clients unless you mark them
          off or they are booked.
        </p>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? 'Close form' : 'Add technician'}
        </button>
      </div>

      {showForm && (
        <form className="admin-walkin-form mb-4" onSubmit={handleCreate}>
          <div className="admin-walkin-form-grid">
            <div>
              <label htmlFor="staff-name">Name</label>
              <input
                id="staff-name"
                name="name"
                value={form.name}
                onChange={handleFormChange}
                required
              />
            </div>
            <div>
              <label htmlFor="staff-phone">Phone</label>
              <input
                id="staff-phone"
                name="phone"
                value={form.phone}
                onChange={handleFormChange}
                required
              />
            </div>
            <div>
              <label htmlFor="staff-email">Email (login)</label>
              <input
                id="staff-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleFormChange}
                required
              />
            </div>
            <div>
              <label htmlFor="staff-password">Password</label>
              <input
                id="staff-password"
                name="password"
                type="text"
                value={form.password}
                onChange={handleFormChange}
                placeholder="Min 8 chars, letters + numbers"
                required
              />
            </div>
            <div>
              <label htmlFor="staff-specialty">Specialty</label>
              <input
                id="staff-specialty"
                name="specialty"
                value={form.specialty}
                onChange={handleFormChange}
                placeholder="Optional"
              />
            </div>
            <div>
              <label htmlFor="staff-placement">Works at</label>
              <select
                id="staff-placement"
                name="placement"
                className="form-select site-select"
                value={form.placement}
                onChange={handleFormChange}
              >
                <option value="salon">Salon team</option>
                <option value="freelance">Freelancer</option>
              </select>
            </div>
            {form.placement !== 'freelance' && (
              <div>
                <label htmlFor="staff-salon">Salon</label>
                <select
                  id="staff-salon"
                  name="salon_id"
                  className="form-select site-select"
                  value={form.salon_id || defaultSalonId}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">Choose salon</option>
                  {salons.map((salon) => (
                    <option key={salon.id} value={String(salon.id)}>
                      {salon.name}
                    </option>
                  ))}
                </select>
                <p className="admin-walkin-lead mt-2 mb-0">
                  They use this salon’s map pin on the landing page.
                </p>
              </div>
            )}
            {form.placement === 'freelance' && (
              <>
                <div className="admin-walkin-form-span">
                  <label htmlFor="staff-location">Service area</label>
                  <input
                    id="staff-location"
                    name="location"
                    value={form.location}
                    onChange={handleFormChange}
                    placeholder="e.g. Kikuyu, Wangige"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="staff-lat">Latitude (optional)</label>
                  <input
                    id="staff-lat"
                    name="service_latitude"
                    value={form.service_latitude}
                    onChange={handleFormChange}
                    placeholder="-1.2466"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label htmlFor="staff-lng">Longitude (optional)</label>
                  <input
                    id="staff-lng"
                    name="service_longitude"
                    value={form.service_longitude}
                    onChange={handleFormChange}
                    placeholder="36.6647"
                    inputMode="decimal"
                  />
                </div>
                <p className="admin-walkin-lead admin-walkin-form-span mb-0">
                  Leave GPS blank to geocode the area, or paste coordinates so they appear next to
                  salons on the landing map.
                </p>
              </>
            )}
          </div>
          <div className="admin-walkin-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Save technician'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-muted dashboard-empty">Loading technicians…</p>
      ) : staff.length === 0 ? (
        <p className="text-muted dashboard-empty">
          No technicians on this salon yet. Add one above.
        </p>
      ) : (
        <>
          <ul className="admin-staff-list">
            {staff.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className={`admin-staff-chip${String(selectedId) === String(entry.id) ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(String(entry.id))}
                >
                  <strong>{entry.name}</strong>
                  <span>
                    {entry.technician_is_freelance || !entry.salon_id
                      ? 'Freelancer'
                      : entry.salon_name || 'Salon team'}
                  </span>
                  <span>{entry.phone || entry.email}</span>
                </button>
              </li>
            ))}
          </ul>

          {selectedTech && (
            <section className="admin-staff-slots">
              <div className="admin-staff-slots-header">
                <h3 className="reports-card-title mb-0">{selectedTech.name} — availability</h3>
                <input
                  type="date"
                  className="form-control"
                  value={slotDate}
                  min={todayIso()}
                  onChange={(event) => setSlotDate(event.target.value)}
                  aria-label="Availability date"
                />
              </div>
              <p className="text-muted small mb-2">
                Hours are open by default. Uncheck an hour to mark it off. Booked online and walk-in
                hours stay locked.
              </p>
              {slotsLoading ? (
                <p className="text-muted">Loading hours…</p>
              ) : (
                <div className="admin-slot-toggles">
                  {displaySlots.map((slot) => {
                    const checked = slot.status === 'available' || slot.status === 'booked'
                    const booked = slot.status === 'booked'
                    const walkIn = booked && Boolean(slot.booking?.is_walk_in)
                    const isOff = slot.status === 'unavailable'
                    let lockLabel = null
                    if (walkIn) {
                      lockLabel = 'Walk-in'
                    } else if (booked) {
                      lockLabel = 'Online'
                    } else if (isOff) {
                      lockLabel = 'Off'
                    }
                    return (
                      <label
                        key={slot.start_hour}
                        className={`admin-slot-toggle${booked ? ' is-booked' : ''}${
                          walkIn ? ' is-walk-in' : ''
                        }${isOff ? ' is-off' : ''}${checked && !booked ? ' is-on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={booked}
                          onChange={() => toggleHour(slot.start_hour, slot.status)}
                        />
                        <span>{slot.label || formatSlotLabel(slot.start_hour)}</span>
                        {lockLabel ? <em>{lockLabel}</em> : null}
                      </label>
                    )
                  })}
                </div>
              )}
              {dayWalkIns.length > 0 && (
                <p className="text-muted small mt-3 mb-0">
                  Walk-ins this day without a clocked hour:{' '}
                  {dayWalkIns.map((entry) => entry.name).join(', ')}
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary mt-3"
                disabled={slotsSaving || slotsLoading || !selectedId}
                onClick={handleSaveSlots}
              >
                {slotsSaving ? 'Saving…' : 'Save hours'}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  )
}

export default AdminStaffRoster
