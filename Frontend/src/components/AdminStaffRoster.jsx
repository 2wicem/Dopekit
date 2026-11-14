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
      return
    }
    setSlotsLoading(true)
    try {
      const response = await apiFetch(
        `/products/admin/technicians/${selectedId}/slots/?date=${slotDate}`
      )
      const data = await parseApiResponse(response, 'Availability')
      setSlots(data.slots || [])
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
      setSlots([])
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
    const salon_id = Number(form.salon_id || defaultSalonId)
    try {
      const response = await apiFetch('/products/admin/technicians/create/', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          salon_id: Number.isFinite(salon_id) ? salon_id : null,
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
        status: 'unavailable',
        label: formatSlotLabel(hour),
      }))

  return (
    <div className="admin-staff-roster">
      <div className="admin-walkin-toolbar">
        <p className="admin-walkin-lead mb-0">
          Add salon technicians yourself, then tick the hours they can take bookings.
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
              <label htmlFor="staff-salon">Salon</label>
              <select
                id="staff-salon"
                name="salon_id"
                className="form-select site-select"
                value={form.salon_id || defaultSalonId}
                onChange={handleFormChange}
                required
              >
                {salons.map((salon) => (
                  <option key={salon.id} value={String(salon.id)}>
                    {salon.name}
                  </option>
                ))}
              </select>
            </div>
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
                Tick hours they can take bookings. Booked hours stay locked.
              </p>
              {slotsLoading ? (
                <p className="text-muted">Loading hours…</p>
              ) : (
                <div className="admin-slot-toggles">
                  {displaySlots.map((slot) => {
                    const checked = slot.status === 'available' || slot.status === 'booked'
                    const booked = slot.status === 'booked'
                    return (
                      <label
                        key={slot.start_hour}
                        className={`admin-slot-toggle${booked ? ' is-booked' : ''}${
                          checked && !booked ? ' is-on' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={booked}
                          onChange={() => toggleHour(slot.start_hour, slot.status)}
                        />
                        <span>{slot.label || formatSlotLabel(slot.start_hour)}</span>
                        {booked ? <em>Booked</em> : null}
                      </label>
                    )
                  })}
                </div>
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
