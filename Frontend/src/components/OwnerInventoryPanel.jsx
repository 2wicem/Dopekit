import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { todayIso } from '../constants/slots'
import { apiFetch, parseApiResponse } from '../config/api'
import WalkInForm from './WalkInForm'
import OwnerSalonServices from './OwnerSalonServices'
import TechnicianServices from './TechnicianServices'

const ReportsPanel = lazy(() => import('./ReportsPanel'))

const catalogOptions = (entries, group) =>
  (entries || [])
    .filter((entry) => entry.is_active !== false)
    .map((entry) => ({
      ...entry,
      group,
      catalog_id: entry.catalog_id || `${entry.source || 'salon'}:${entry.id}`,
    }))

const WALK_IN_PATH = '/products/bookings/walk-in/'

const emptyWalkIn = {
  name: '',
  phone: '',
  service: '',
  service_price_kes: '',
  payment_method: 'cash',
  venue: 'indoor',
  location: '',
  requested_date: todayIso(),
  preferred_worker_id: '',
  service_id: '',
}

const OwnerInventoryPanel = ({ salons, onStatus, onChanged }) => {
  const [salonId, setSalonId] = useState(salons[0] ? String(salons[0].id) : '')
  const [showWalkIn, setShowWalkIn] = useState(false)
  const [walkInForm, setWalkInForm] = useState(emptyWalkIn)
  const [walkInSaving, setWalkInSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (!salonId && salons[0]) {
      setSalonId(String(salons[0].id))
    }
  }, [salonId, salons])

  useEffect(() => {
    setWalkInForm((current) => ({ ...current, service_id: '', service: '', service_price_kes: '' }))
  }, [salonId])

  const selectedSalon = salons.find((salon) => String(salon.id) === String(salonId))
  const technicians = selectedSalon?.technicians || []
  const selectedTechnician = technicians.find(
    (tech) => String(tech.id) === String(walkInForm.preferred_worker_id),
  )
  const serviceOptions = [
    ...catalogOptions(selectedSalon?.services, selectedSalon?.name || 'Salon'),
    ...catalogOptions(
      selectedTechnician?.services,
      selectedTechnician?.is_owner ? 'You' : selectedTechnician?.name,
    ),
  ]

  const salonQuery = useMemo(() => {
    if (!salonId) {
      return ''
    }
    return `salon_id=${salonId}`
  }, [salonId])

  const handleWalkInChange = (event) => {
    const { name, value } = event.target
    setWalkInForm((current) => {
      if (name === 'preferred_worker_id') {
        return {
          ...current,
          preferred_worker_id: value,
          service_id: '',
          service: '',
          service_price_kes: '',
        }
      }
      return { ...current, [name]: value }
    })
  }

  const handleWalkInSubmit = async (event) => {
    event.preventDefault()
    if (!salonId) {
      onStatus?.({ type: 'error', message: 'Choose a salon branch.' })
      return
    }
    if (!walkInForm.preferred_worker_id) {
      onStatus?.({ type: 'error', message: 'Choose the technician who did this service.' })
      return
    }
    if (walkInForm.venue === 'outdoor' && !walkInForm.location.trim()) {
      onStatus?.({ type: 'error', message: 'Enter an address for outdoor walk-ins.' })
      return
    }

    setWalkInSaving(true)
    onStatus?.(null)
    try {
      const response = await apiFetch(WALK_IN_PATH, {
        method: 'POST',
        body: JSON.stringify({
          ...walkInForm,
          service_price_kes: walkInForm.service_price_kes
            ? Number(walkInForm.service_price_kes)
            : null,
          preferred_worker_id: Number(walkInForm.preferred_worker_id),
          salon_id: Number(salonId),
        }),
      })
      const data = await parseApiResponse(response, 'Walk-in')
      setWalkInForm({ ...emptyWalkIn, requested_date: todayIso() })
      setShowWalkIn(false)
      setRefreshKey((current) => current + 1)
      onStatus?.({
        type: 'success',
        message: data.message || 'Walk-in saved against that technician.',
      })
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setWalkInSaving(false)
    }
  }

  return (
    <div>
      <TechnicianServices onStatus={onStatus} onChanged={onChanged} />
      <OwnerSalonServices salon={selectedSalon} onChanged={onChanged} onStatus={onStatus} />

      <div className="admin-walkin-toolbar">
        <p className="admin-walkin-lead mb-0">
          Log completed walk-ins for yourself or a technician. That same job appears on their
          inventory and yours — one record, not a copy.
        </p>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => setShowWalkIn((current) => !current)}
          disabled={technicians.length === 0}
        >
          {showWalkIn ? 'Close walk-in form' : 'Add completed service'}
        </button>
      </div>

      {salons.length > 1 && (
        <label className="owner-branch-picker mb-3">
          Branch
          <select
            className="form-select site-select"
            value={salonId}
            onChange={(event) => {
              setSalonId(event.target.value)
              setWalkInForm((current) => ({ ...current, preferred_worker_id: '' }))
            }}
          >
            {salons.map((salon) => (
              <option key={salon.id} value={String(salon.id)}>
                {salon.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {technicians.length === 0 && (
        <p className="text-muted">
          Assign an approved technician to this salon first, then you can log completed services
          against them.
        </p>
      )}

      {showWalkIn && (
        <WalkInForm
          form={walkInForm}
          onChange={handleWalkInChange}
          onSubmit={handleWalkInSubmit}
          saving={walkInSaving}
          serviceOptions={serviceOptions}
          extraFields={
            <div>
              <label htmlFor="walkin-technician">Who did this</label>
              <select
                id="walkin-technician"
                className="form-select site-select"
                name="preferred_worker_id"
                value={walkInForm.preferred_worker_id}
                onChange={handleWalkInChange}
                required
              >
                <option value="">You or a technician</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={String(tech.id)}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>
          }
        />
      )}

      <Suspense fallback={<p className="text-muted">Loading inventory…</p>}>
        <ReportsPanel
          key={`${salonQuery}-${refreshKey}`}
          scope="owner"
          variant="inventory"
          salonQuery={salonQuery}
          canViewInventory
          canRecordExpenses
        />
      </Suspense>
    </div>
  )
}

export default OwnerInventoryPanel
