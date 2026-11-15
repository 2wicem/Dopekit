import { SERVICE_VENUES } from '../constants/serviceVenue'
import './css/AdminShell.css'

const WalkInForm = ({
  form,
  onChange,
  onSubmit,
  saving = false,
  extraFields = null,
}) => (
  <form className="admin-walkin-form" onSubmit={onSubmit}>
    <div className="admin-walkin-form-grid">
      <div>
        <label htmlFor="walkin-name">Client name</label>
        <input
          id="walkin-name"
          name="name"
          value={form.name}
          onChange={onChange}
          autoComplete="name"
          required
        />
      </div>
      <div>
        <label htmlFor="walkin-phone">Phone</label>
        <input
          id="walkin-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={onChange}
          required
        />
      </div>
      <div>
        <label htmlFor="walkin-service">Service</label>
        <input
          id="walkin-service"
          name="service"
          value={form.service}
          onChange={onChange}
          placeholder="e.g. Acrylics"
        />
      </div>
      <div>
        <label htmlFor="walkin-price">Price (KES)</label>
        <input
          id="walkin-price"
          name="service_price_kes"
          type="number"
          min="0"
          inputMode="numeric"
          value={form.service_price_kes}
          onChange={onChange}
          placeholder="Optional"
        />
      </div>
      <div>
        <label htmlFor="walkin-date">Date</label>
        <input
          id="walkin-date"
          type="date"
          name="requested_date"
          value={form.requested_date}
          onChange={onChange}
          required
        />
      </div>
      {extraFields}
      <div>
        <label htmlFor="walkin-venue">Venue</label>
        <select
          id="walkin-venue"
          className="form-select site-select"
          name="venue"
          value={form.venue}
          onChange={onChange}
        >
          {SERVICE_VENUES.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      {form.venue === 'outdoor' && (
        <div className="admin-walkin-form-span">
          <label htmlFor="walkin-location">Address</label>
          <input
            id="walkin-location"
            name="location"
            value={form.location}
            onChange={onChange}
            required
          />
        </div>
      )}
    </div>
    <div className="admin-walkin-actions">
      <button type="submit" className="btn btn-sm btn-success" disabled={saving}>
        {saving ? 'Saving…' : 'Save walk-in'}
      </button>
    </div>
  </form>
)

export default WalkInForm
