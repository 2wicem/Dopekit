import { useEffect, useState } from 'react'
import { apiFetch } from '../config/api'

export const emptyBranchForm = {
  name: '',
  phone_primary: '',
  phone_secondary: '',
  email: '',
  location: '',
  services_summary: '',
  page_lead: '',
  instagram_url: '',
  facebook_url: '',
  tiktok_url: '',
  whatsapp_url: '',
  is_active: true,
}

const OwnerSalonsPanel = ({ salons, onChanged, onStatus }) => {
  const [editingId, setEditingId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(emptyBranchForm)
  const [saving, setSaving] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState(null)

  const handleCopyInviteCode = async (code) => {
    if (!code) {
      onStatus?.({ type: 'error', message: 'No invite code available for this branch yet.' })
      return
    }
    try {
      await navigator.clipboard.writeText(code)
      onStatus?.({ type: 'success', message: 'Invite code copied.' })
    } catch {
      onStatus?.({ type: 'error', message: 'Could not copy invite code.' })
    }
  }

  const handleRegenerateInviteCode = async (salonId) => {
    if (!window.confirm('Generate a new invite code? The old code will stop working immediately.')) {
      return
    }

    setRegeneratingId(salonId)
    onStatus?.(null)
    try {
      const response = await apiFetch(`/products/owner/salons/${salonId}/invite-code/`, {
        method: 'POST',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not regenerate invite code.')
      }
      onStatus?.({ type: 'success', message: data.message || 'Invite code regenerated.' })
      await onChanged?.()
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setRegeneratingId(null)
    }
  }

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
          services_summary: salon.services_summary || '',
          page_lead: salon.page_lead || '',
          instagram_url: salon.instagram_url || '',
          facebook_url: salon.facebook_url || '',
          tiktok_url: salon.tiktok_url || '',
          whatsapp_url: salon.whatsapp_url || '',
          is_active: salon.is_active !== false,
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
    setForm(emptyBranchForm)
  }

  const cancelEdit = () => {
    setCreating(false)
    setEditingId(null)
    setForm(emptyBranchForm)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    onStatus?.(null)

    try {
      const isNew = editingId === 'new'
      const response = await apiFetch(
        isNew ? '/products/owner/salons/create/' : `/products/owner/salons/${editingId}/`,
        {
          method: isNew ? 'POST' : 'PATCH',
          body: JSON.stringify(form),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not save branch.')
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
    <div className="owner-salons-panel">
      <div className="admin-panel-toolbar">
        <div>
          <h2 className="admin-panel-title">My branches</h2>
          <p className="admin-panel-lead">
            Add salon locations with address and contact details. Map coordinates are generated
            automatically when you save.
          </p>
        </div>
        {!editingId && (
          <button type="button" className="btn btn-primary btn-sm" onClick={startCreate}>
            Add branch
          </button>
        )}
      </div>

      {editingId ? (
        <form className="admin-salon-form" onSubmit={handleSubmit}>
          <div className="admin-salon-form-grid">
            <div className="admin-form-field">
              <label htmlFor="branch-name">Branch name</label>
              <input id="branch-name" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="admin-form-field admin-form-field--wide">
              <label htmlFor="branch-location">Location</label>
              <input id="branch-location" name="location" value={form.location} onChange={handleChange} required />
              <p className="admin-form-hint">
                Include area or town (e.g. Wangige, Kikuyu). Latitude and longitude are filled in
                automatically on save.
              </p>
            </div>
            <div className="admin-form-field">
              <label htmlFor="branch-phone-primary">Primary phone</label>
              <input
                id="branch-phone-primary"
                name="phone_primary"
                value={form.phone_primary}
                onChange={handleChange}
                required
              />
            </div>
            <div className="admin-form-field">
              <label htmlFor="branch-phone-secondary">Secondary phone</label>
              <input
                id="branch-phone-secondary"
                name="phone_secondary"
                value={form.phone_secondary}
                onChange={handleChange}
              />
            </div>
            <div className="admin-form-field">
              <label htmlFor="branch-email">Email</label>
              <input id="branch-email" type="email" name="email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="admin-form-field admin-form-field--wide">
              <label htmlFor="branch-services">Services summary</label>
              <input id="branch-services" name="services_summary" value={form.services_summary} onChange={handleChange} />
            </div>
            <div className="admin-form-field admin-form-field--wide">
              <label htmlFor="branch-lead">Public intro</label>
              <textarea id="branch-lead" name="page_lead" rows={3} value={form.page_lead} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="branch-instagram">Instagram URL</label>
              <input id="branch-instagram" name="instagram_url" value={form.instagram_url} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="branch-facebook">Facebook URL</label>
              <input id="branch-facebook" name="facebook_url" value={form.facebook_url} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="branch-tiktok">TikTok URL</label>
              <input id="branch-tiktok" name="tiktok_url" value={form.tiktok_url} onChange={handleChange} />
            </div>
            <div className="admin-form-field">
              <label htmlFor="branch-whatsapp">WhatsApp URL</label>
              <input id="branch-whatsapp" name="whatsapp_url" value={form.whatsapp_url} onChange={handleChange} />
            </div>
          </div>

          <div className="admin-salon-form-checks">
            <label className="admin-check">
              <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
              Active on the public site
            </label>
          </div>

          <div className="admin-form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : creating ? 'Create branch' : 'Save changes'}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="admin-salon-list">
          {salons.length === 0 ? (
            <p className="text-muted dashboard-empty">No branches yet. Add your first location.</p>
          ) : (
            salons.map((salon) => (
              <article key={salon.id} className="admin-salon-card">
                <div>
                  <h3 className="admin-salon-card__title">
                    {salon.name}
                    {!salon.is_active && (
                      <span className="admin-salon-badge admin-salon-badge--muted">Inactive</span>
                    )}
                  </h3>
                  <p className="admin-salon-card__meta">{salon.location}</p>
                  {salon.latitude != null && salon.longitude != null && (
                    <p className="admin-salon-card__meta">
                      Map: {Number(salon.latitude).toFixed(5)}, {Number(salon.longitude).toFixed(5)}
                    </p>
                  )}
                  <p className="admin-salon-card__meta">
                    {salon.phone_primary} · {salon.email}
                  </p>
                  <p className="admin-salon-card__meta">
                    {salon.technician_count ?? salon.technicians?.length ?? 0} technician(s)
                  </p>
                  <div className="owner-invite-code-row">
                    <span className="owner-invite-code-label">Team invite code</span>
                    <code className="owner-invite-code">{salon.technician_invite_code || 'Not set'}</code>
                    <div className="owner-invite-code-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleCopyInviteCode(salon.technician_invite_code)}
                        disabled={!salon.technician_invite_code}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => handleRegenerateInviteCode(salon.id)}
                        disabled={regeneratingId === salon.id}
                      >
                        {regeneratingId === salon.id ? 'Regenerating…' : 'Regenerate'}
                      </button>
                    </div>
                  </div>
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

export default OwnerSalonsPanel
