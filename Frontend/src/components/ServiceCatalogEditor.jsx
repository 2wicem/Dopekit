import { useState } from 'react'
import { apiFetch, parseApiResponse } from '../config/api'
import './css/OwnerPanel.css'

const emptyForm = { name: '', price_kes: '' }

const ServiceCatalogEditor = ({
  title,
  lead,
  services = [],
  createPath,
  deletePath,
  onChanged,
  onStatus,
  idPrefix = 'service',
  emptyText = 'No services yet. Add your first one above.',
  disabled = false,
}) => {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (disabled || !createPath) {
      return
    }
    if (!form.name.trim()) {
      onStatus?.({ type: 'error', message: 'Enter a service name.' })
      return
    }

    setSaving(true)
    onStatus?.(null)
    try {
      const response = await apiFetch(createPath, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          price_kes: form.price_kes === '' ? null : Number(form.price_kes),
        }),
      })
      const data = await parseApiResponse(response, 'Add service')
      setForm(emptyForm)
      onStatus?.({ type: 'success', message: data.message })
      await onChanged?.(data.service || null)
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (service) => {
    if (!window.confirm(`Remove ${service.name} from your menu?`)) {
      return
    }
    setBusyId(service.id)
    onStatus?.(null)
    try {
      const response = await apiFetch(deletePath(service), {
        method: 'DELETE',
      })
      const data = await parseApiResponse(response, 'Remove service')
      onStatus?.({ type: 'success', message: data.message })
      await onChanged?.(null)
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="owner-salon-services">
      <h3 className="owner-staff-title">{title}</h3>
      {lead ? <p className="admin-panel-lead">{lead}</p> : null}

      <form className="owner-add-tech-form" onSubmit={handleCreate}>
        <div className="owner-add-tech-grid">
          <div>
            <label htmlFor={`${idPrefix}-name`}>Service name</label>
            <input
              id={`${idPrefix}-name`}
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Gel overlay"
              required
              disabled={disabled}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-price`}>Price (KES)</label>
            <input
              id={`${idPrefix}-price`}
              name="price_kes"
              type="number"
              min="0"
              inputMode="numeric"
              value={form.price_kes}
              onChange={handleChange}
              placeholder="Optional"
              disabled={disabled}
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary mt-3" disabled={saving || disabled}>
          {saving ? 'Adding…' : 'Add service'}
        </button>
      </form>

      {services.length === 0 ? (
        <p className="text-muted dashboard-empty">{emptyText}</p>
      ) : (
        <ul className="owner-staff-list">
          {services.map((service) => (
            <li key={service.id} className="owner-staff-item">
              <div>
                <strong>{service.name}</strong>
                <span>
                  {service.price_kes != null ? `KES ${service.price_kes}` : 'No set price'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                disabled={busyId === service.id}
                onClick={() => handleDelete(service)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default ServiceCatalogEditor
