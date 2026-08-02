import { useEffect, useState } from 'react'
import { apiFetch } from '../config/api'

const emptySalon = {
  name: '',
  phone_primary: '',
  phone_secondary: '',
  email: '',
  location: '',
  latitude: '',
  longitude: '',
  services_summary: '',
  page_lead: '',
  instagram_url: '',
  facebook_url: '',
  tiktok_url: '',
  whatsapp_url: '',
  is_active: true,
  is_primary: false,
}

const AdminSalonsPanel = ({ salons, onChanged, onStatus }) => {
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptySalon)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editingId && editingId !== 'new') {
      const salon = salons.find((entry) => entry.id === editingId)
      if (salon) {
        setForm({
          name: salon.name || '',
          phone_primary: salon.phone_primary || '',
          phone_secondary: salon.phone_secondary || '',
          email: salon.email || '',
          location: salon.location || '',
          latitude: salon.latitude ?? '',
          longitude: salon.longitude ?? '',
          services_summary: salon.services_summary || '',
          page_lead: salon.page_lead || '',
          instagram_url: salon.instagram_url || '',
          facebook_url: salon.facebook_url || '',
          tiktok_url: salon.tiktok_url || '',
          whatsapp_url: salon.whatsapp_url || '',
          is_active: salon.is_active !== false,
          is_primary: Boolean(salon.is_primary),
        })
      }
    }
  }, [editingId, salons])

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const startCreate = () => {
    setCreating(true)
    setEditingId('new')
    setForm({ ...emptySalon, is_primary: salons.length === 0 })
  }

  const cancelEdit = () => {
    setCreating(false)
    setEditingId(null)
    setForm(emptySalon)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    onStatus?.(null)

    try {
      const isNew = editingId === 'new'
      const response = await apiFetch(
        isNew ? '/products/admin/salons/create/' : `/products/admin/salons/${editingId}/`,
        {
          method: isNew ? 'POST' : 'PATCH',
          body: JSON.stringify(form),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not save salon.')
      }

      onStatus?.({ type: 'success', message: data.message })
      cancelEdit()
      await onChanged?.()
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-salons-panel">
      <div className="admin-panel-toolbar">
        <div>
          <h2 className="admin-panel-title">Salon locations</h2>
          <p className="admin-panel-lead">Manage each branch, contact details, and social links.</p>
        </div>
        {!editingId && (
          <button type="button" className="btn btn-primary btn-sm" onClick={startCreate}>
            Add salon
          </button>
        )}
      </div>

      {editingId ? (
        <form className="admin-salon-form" onSubmit={handleSubmit}>
          <div className="admin-salon-form-grid">
            <div className="admin-form-field">
              <label htmlFor="salon-name">Salon name</label>
              <input id="salon-name" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-location">Location</label>
              <input id="salon-location" name="location" value={form.location} onChange={handleChange} required />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-latitude">Latitude</label>
              <input
                id="salon-latitude"
                name="latitude"
                type="number"
                step="any"
                value={form.latitude}
                onChange={handleChange}
                placeholder="-1.246600"
              />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-longitude">Longitude</label>
              <input
                id="salon-longitude"
                name="longitude"
                type="number"
                step="any"
                value={form.longitude}
                onChange={handleChange}
                placeholder="36.664700"
              />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-phone-primary">Primary phone</label>
              <input id="salon-phone-primary" name="phone_primary" value={form.phone_primary} onChange={handleChange} required />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-phone-secondary">Secondary phone</label>
              <input id="salon-phone-secondary" name="phone_secondary" value={form.phone_secondary} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-email">Email</label>
              <input id="salon-email" type="email" name="email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="admin-form-field admin-form-field--wide">
              <label htmlFor="salon-services">Services summary</label>
              <input id="salon-services" name="services_summary" value={form.services_summary} onChange={handleChange} />
            </div>
            <div className="admin-form-field admin-form-field--wide">
              <label htmlFor="salon-lead">Contact page intro</label>
              <textarea id="salon-lead" name="page_lead" rows={3} value={form.page_lead} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-instagram">Instagram URL</label>
              <input id="salon-instagram" name="instagram_url" value={form.instagram_url} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-facebook">Facebook URL</label>
              <input id="salon-facebook" name="facebook_url" value={form.facebook_url} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-tiktok">TikTok URL</label>
              <input id="salon-tiktok" name="tiktok_url" value={form.tiktok_url} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="salon-whatsapp">WhatsApp URL</label>
              <input id="salon-whatsapp" name="whatsapp_url" value={form.whatsapp_url} onChange={handleChange} />
            </div>
          </div>

          <div className="admin-salon-form-checks">
            <label className="admin-check">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
              Active
            </label>
            <label className="admin-check">
              <input type="checkbox" name="is_primary" checked={form.is_primary} onChange={handleChange} />
              Primary salon (public contact page)
            </label>
          </div>

          <div className="admin-form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : creating ? 'Create salon' : 'Save changes'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="admin-salon-list">
          {salons.length === 0 ? (
            <p className="text-muted dashboard-empty">No salons yet. Add your first location.</p>
          ) : (
            salons.map((salon) => (
              <article key={salon.id} className="admin-salon-card">
                <div>
                  <h3 className="admin-salon-card__title">
                    {salon.name}
                    {salon.is_primary && <span className="admin-salon-badge">Primary</span>}
                    {!salon.is_active && <span className="admin-salon-badge admin-salon-badge--muted">Inactive</span>}
                  </h3>
                  <p className="admin-salon-card__meta">{salon.location}</p>
                  <p className="admin-salon-card__meta">
                    {salon.phone_primary} · {salon.email}
                  </p>
                  {salon.owner_name && (
                    <p className="admin-salon-card__meta">Owner: {salon.owner_name}</p>
                  )}
                </div>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEditingId(salon.id)}>
                  Edit
                </button>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default AdminSalonsPanel
