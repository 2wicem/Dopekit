import { useCallback, useEffect, useState } from 'react'
import { TECHNICIAN_SPECIALTIES } from '../constants/technicianSpecialties'
import { apiFetch } from '../config/api'

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
  specialty: '',
}

const OwnerTechniciansPanel = ({ salons, onStatus }) => {
  const [selectedSalonId, setSelectedSalonId] = useState('')
  const [staff, setStaff] = useState([])
  const [assignable, setAssignable] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const loadAssignable = useCallback(async () => {
    const response = await apiFetch('/products/owner/technicians/')
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Could not load technicians.')
    }
    setAssignable(data.technicians || [])
  }, [])

  const loadStaff = useCallback(async (salonId) => {
    if (!salonId) {
      setStaff([])
      return
    }

    const response = await apiFetch(`/products/owner/salons/${salonId}/staff/`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Could not load branch staff.')
    }
    setStaff(data.staff || [])
  }, [])

  useEffect(() => {
    setLoading(true)
    onStatus?.(null)
    Promise.all([loadAssignable(), loadStaff(selectedSalonId)])
      .catch((error) => onStatus?.({ type: 'error', message: error.message }))
      .finally(() => setLoading(false))
  }, [selectedSalonId, loadAssignable, loadStaff, onStatus])

  useEffect(() => {
    if (!selectedSalonId && salons.length > 0) {
      setSelectedSalonId(String(salons[0].id))
    }
  }, [salons, selectedSalonId])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (!selectedSalonId) {
      onStatus?.({ type: 'error', message: 'Choose a branch first.' })
      return
    }

    setSaving(true)
    onStatus?.(null)
    try {
      const response = await apiFetch('/products/owner/technicians/create/', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          salon_id: Number(selectedSalonId),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not add technician.')
      }
      onStatus?.({ type: 'success', message: data.message })
      setForm(emptyForm)
      setShowForm(false)
      await Promise.all([loadAssignable(), loadStaff(selectedSalonId)])
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async (technicianId, salonId) => {
    setAssigningId(technicianId)
    onStatus?.(null)

    try {
      const response = await apiFetch(`/products/owner/technicians/${technicianId}/salon/`, {
        method: 'PATCH',
        body: JSON.stringify({ salon_id: salonId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not update technician.')
      }

      onStatus?.({ type: 'success', message: data.message })
      await Promise.all([loadAssignable(), loadStaff(selectedSalonId)])
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setAssigningId(null)
    }
  }

  const branchStaff = staff.filter((entry) => entry.is_approved)
  const availableToAdd = assignable.filter(
    (entry) => entry.can_assign && String(entry.salon_id) !== selectedSalonId
  )
  const selectedSalon = salons.find((salon) => String(salon.id) === String(selectedSalonId))

  return (
    <div className="owner-technicians-panel">
      <div className="admin-panel-toolbar">
        <div>
          <h2 className="admin-panel-title">Technicians</h2>
          <p className="admin-panel-lead">
            Add salon staff yourself. They can log in immediately — platform admin only reviews
            freelance technicians.
          </p>
        </div>
        {salons.length > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => setShowForm((open) => !open)}
          >
            {showForm ? 'Close form' : 'Add technician'}
          </button>
        )}
      </div>

      {salons.length === 0 ? (
        <p className="text-muted dashboard-empty">Add a branch first, then add technicians here.</p>
      ) : (
        <>
          <div className="owner-branch-picker">
            <label htmlFor="owner-branch-select">Branch</label>
            <select
              id="owner-branch-select"
              className="form-select site-select"
              value={selectedSalonId}
              onChange={(event) => setSelectedSalonId(event.target.value)}
            >
              {salons.map((salon) => (
                <option key={salon.id} value={salon.id}>
                  {salon.name}
                </option>
              ))}
            </select>
          </div>

          {showForm && (
            <form className="owner-add-tech-form" onSubmit={handleCreate}>
              <p className="admin-panel-lead mb-3">
                Creating a login for {selectedSalon?.name || 'this branch'}. Share the password with
                them so they can open the staff app.
              </p>
              <div className="owner-add-tech-grid">
                <div>
                  <label htmlFor="owner-tech-name">Name</label>
                  <input
                    id="owner-tech-name"
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="owner-tech-phone">Phone</label>
                  <input
                    id="owner-tech-phone"
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="owner-tech-email">Email (login)</label>
                  <input
                    id="owner-tech-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="owner-tech-password">Password</label>
                  <input
                    id="owner-tech-password"
                    name="password"
                    type="text"
                    value={form.password}
                    onChange={handleFormChange}
                    placeholder="Min 8 chars, letters + numbers"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="owner-tech-specialty">Specialty</label>
                  <select
                    id="owner-tech-specialty"
                    name="specialty"
                    className="form-select site-select"
                    value={form.specialty}
                    onChange={handleFormChange}
                  >
                    <option value="">Optional</option>
                    {TECHNICIAN_SPECIALTIES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary mt-3" disabled={saving}>
                {saving ? 'Adding…' : 'Add to this branch'}
              </button>
            </form>
          )}

          {loading ? (
            <p className="text-muted dashboard-empty">Loading technicians…</p>
          ) : (
            <>
              <section className="owner-staff-section">
                <h3 className="owner-staff-title">At this branch</h3>
                {branchStaff.length === 0 ? (
                  <p className="text-muted dashboard-empty">No technicians assigned yet.</p>
                ) : (
                  <ul className="owner-staff-list">
                    {branchStaff.map((technician) => (
                      <li key={technician.id} className="owner-staff-item">
                        <div>
                          <strong>{technician.name}</strong>
                          <span>{technician.phone}</span>
                          {technician.specialty_label && <span>{technician.specialty_label}</span>}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          disabled={assigningId === technician.id}
                          onClick={() => handleAssign(technician.id, null)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="owner-staff-section">
                <h3 className="owner-staff-title">Move to this branch</h3>
                {availableToAdd.length === 0 ? (
                  <p className="text-muted dashboard-empty">
                    No other staff to move. Add a technician above, or share this branch invite code.
                  </p>
                ) : (
                  <ul className="owner-staff-list">
                    {availableToAdd.map((technician) => (
                      <li key={technician.id} className="owner-staff-item">
                        <div>
                          <strong>{technician.name}</strong>
                          <span>{technician.phone}</span>
                          {technician.salon_name ? (
                            <span>Currently at {technician.salon_name}</span>
                          ) : (
                            <span>Unassigned</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          disabled={assigningId === technician.id || !technician.can_assign}
                          onClick={() => handleAssign(technician.id, selectedSalonId)}
                        >
                          Assign
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default OwnerTechniciansPanel
