import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../config/api'

const OwnerTechniciansPanel = ({ salons, onStatus }) => {
  const [selectedSalonId, setSelectedSalonId] = useState('')
  const [staff, setStaff] = useState([])
  const [assignable, setAssignable] = useState([])
  const [loading, setLoading] = useState(true)
  const [assigningId, setAssigningId] = useState(null)

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

  return (
    <div className="owner-technicians-panel">
      <div className="admin-panel-toolbar">
        <div>
          <h2 className="admin-panel-title">Technicians</h2>
          <p className="admin-panel-lead">Assign approved technicians to each branch.</p>
        </div>
      </div>

      {salons.length === 0 ? (
        <p className="text-muted dashboard-empty">Add a branch first, then assign technicians here.</p>
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
                <h3 className="owner-staff-title">Add to this branch</h3>
                {availableToAdd.length === 0 ? (
                  <p className="text-muted dashboard-empty">
                    No available approved technicians. Ask your team to sign up or contact platform admin.
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
