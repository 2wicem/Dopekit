import { todayIso } from '../constants/slots'
import { SERVICE_VENUES } from '../constants/serviceVenue'
import { PAYMENT_METHODS } from '../constants/paymentMethods'
import './css/AdminShell.css'

const daysAgoIso = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const WalkInForm = ({
  form,
  onChange,
  onSubmit,
  saving = false,
  extraFields = null,
  serviceOptions = [],
}) => {
  const optionKey = (entry) => entry.catalog_id || `${entry.source || 'salon'}:${entry.id}`

  const handleServicePick = (event) => {
    const serviceId = event.target.value
    onChange({ target: { name: 'service_id', value: serviceId } })
    const picked = serviceOptions.find((entry) => optionKey(entry) === String(serviceId))
    if (picked) {
      onChange({ target: { name: 'service', value: picked.name } })
      onChange({
        target: {
          name: 'service_price_kes',
          value: picked.price_kes == null ? '' : String(picked.price_kes),
        },
      })
      return
    }
    if (serviceId === '') {
      onChange({ target: { name: 'service', value: '' } })
      onChange({ target: { name: 'service_price_kes', value: '' } })
    }
  }

  const usingCatalog = serviceOptions.length > 0
  const customService = !usingCatalog || !form.service_id

  return (
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
        <label htmlFor="walkin-phone">Phone (optional)</label>
        <input
          id="walkin-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={onChange}
          placeholder="Optional"
        />
      </div>
      {usingCatalog && (
        <div>
          <label htmlFor="walkin-service-id">Service menu</label>
          <select
            id="walkin-service-id"
            className="form-select site-select"
            name="service_id"
            value={form.service_id || ''}
            onChange={handleServicePick}
          >
            <option value="">Custom / other</option>
            {serviceOptions.map((entry) => (
              <option key={optionKey(entry)} value={optionKey(entry)}>
                {entry.group ? `${entry.group} · ` : ''}
                {entry.name}
                {entry.price_kes != null ? ` · KES ${entry.price_kes}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="walkin-service">{usingCatalog ? 'Service name' : 'Service'}</label>
        <input
          id="walkin-service"
          name="service"
          value={form.service}
          onChange={onChange}
          placeholder="e.g. Acrylics"
          readOnly={usingCatalog && !customService}
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
        <label htmlFor="walkin-payment">Payment</label>
        <select
          id="walkin-payment"
          className="form-select site-select"
          name="payment_method"
          value={form.payment_method || 'cash'}
          onChange={onChange}
          required
        >
          {PAYMENT_METHODS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="walkin-date">Date</label>
        <input
          id="walkin-date"
          type="date"
          name="requested_date"
          value={form.requested_date}
          min={daysAgoIso(30)}
          max={todayIso()}
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
}

export default WalkInForm
