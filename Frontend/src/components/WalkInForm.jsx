import { todayIso } from '../constants/slots'
import { SERVICE_VENUES } from '../constants/serviceVenue'
import { PAYMENT_METHODS } from '../constants/paymentMethods'
import './css/AdminShell.css'

const daysAgoIso = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

export const emptyWalkInLine = (workerId = '') => ({
  service_id: '',
  service: '',
  service_price_kes: '',
  payment_method: 'cash',
  mpesa_code: '',
  preferred_worker_id: workerId || '',
})

export const walkInLines = (form) => {
  if (form.services?.length) {
    return form.services
  }
  return [
    {
      service_id: form.service_id || '',
      service: form.service || '',
      service_price_kes: form.service_price_kes || '',
      payment_method: form.payment_method || 'cash',
      mpesa_code: form.mpesa_code || '',
      preferred_worker_id: form.preferred_worker_id || '',
    },
  ]
}

export const walkInPayload = (form) => ({
  name: form.name,
  phone: form.phone,
  venue: form.venue,
  location: form.location,
  requested_date: form.requested_date,
  preferred_worker_id: form.preferred_worker_id,
  services: walkInLines(form).map((line) => ({
    service_id: line.service_id || '',
    service: (line.service || '').trim(),
    service_price_kes: line.service_price_kes === '' ? null : Number(line.service_price_kes),
    payment_method: line.payment_method || 'cash',
    mpesa_code: (line.mpesa_code || '').trim(),
    preferred_worker_id: line.preferred_worker_id || form.preferred_worker_id || '',
  })),
})

const optionKey = (entry) => entry.catalog_id || `${entry.source || 'salon'}:${entry.id}`

const WalkInForm = ({
  form,
  onChange,
  onSubmit,
  saving = false,
  extraFields = null,
  serviceOptions = [],
  technicians = [],
  salonServices = [],
}) => {
  const lines = walkInLines(form)
  const visitTotal = lines.reduce((sum, line) => sum + (Number(line.service_price_kes) || 0), 0)
  const catalogForLine = (line) => {
    const workerId = line.preferred_worker_id || form.preferred_worker_id
    const tech = technicians.find((entry) => String(entry.id) === String(workerId))
    const salonRows = salonServices.length ? salonServices : []
    const techRows = (tech?.services || [])
      .filter((entry) => entry.is_active !== false)
      .map((entry) => ({
        ...entry,
        group: tech?.is_owner ? 'You' : tech?.name,
        catalog_id: entry.catalog_id || `tech:${entry.id}`,
      }))
    if (technicians.length) {
      return [...salonRows, ...techRows]
    }
    return serviceOptions
  }

  const setLines = (nextLines) => {
    onChange({ target: { name: 'services', value: nextLines } })
  }

  const updateLine = (index, patch) => {
    setLines(lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)))
  }

  const handleServicePick = (index, event) => {
    const serviceId = event.target.value
    const picked = catalogForLine(lines[index]).find((entry) => optionKey(entry) === String(serviceId))
    if (picked) {
      updateLine(index, {
        service_id: serviceId,
        service: picked.name,
        service_price_kes: picked.price_kes == null ? '' : String(picked.price_kes),
      })
      return
    }
    updateLine(index, {
      service_id: '',
      service: serviceId === '' ? '' : lines[index].service,
      service_price_kes: serviceId === '' ? '' : lines[index].service_price_kes,
    })
  }

  const addService = () => {
    if (lines.length >= 12) {
      return
    }
    const lastWorker = lines[lines.length - 1]?.preferred_worker_id || form.preferred_worker_id || ''
    setLines([...lines, emptyWalkInLine(lastWorker)])
  }

  const removeService = (index) => {
    if (lines.length === 1) {
      setLines([emptyWalkInLine()])
      return
    }
    setLines(lines.filter((_, lineIndex) => lineIndex !== index))
  }

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
        <label htmlFor="walkin-phone">Phone</label>
        <input
          id="walkin-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={onChange}
          placeholder="07xx so cash visits are not entered twice"
          required
        />
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

    <div className="admin-walkin-services">
      <div className="admin-walkin-services-head">
        <h3 className="admin-walkin-services-title">Services this visit</h3>
        <p className="admin-walkin-services-hint">
          Add every service this client took today. Choose who did each one if different
          technicians worked on the same client. Bank / M-Pesa jobs need the real till receipt
          code so the same visit cannot be logged twice.
        </p>
      </div>
      {lines.map((line, index) => {
        const lineOptions = catalogForLine(line)
        const usingCatalog = lineOptions.length > 0
        const customService = !usingCatalog || !line.service_id
        return (
          <div key={index} className="admin-walkin-service-line">
            <div className="admin-walkin-service-line-head">
              <span>Service {index + 1}</span>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => removeService(index)}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="admin-walkin-form-grid">
              {technicians.length > 0 && (
                <div>
                  <label htmlFor={`walkin-line-tech-${index}`}>Who did this</label>
                  <select
                    id={`walkin-line-tech-${index}`}
                    className="form-select site-select"
                    value={line.preferred_worker_id || form.preferred_worker_id || ''}
                    onChange={(event) => {
                      const workerId = event.target.value
                      const nextIds = new Set(
                        catalogForLine({ ...line, preferred_worker_id: workerId }).map((entry) =>
                          String(optionKey(entry)),
                        ),
                      )
                      updateLine(index, {
                        preferred_worker_id: workerId,
                        service_id:
                          line.service_id && nextIds.has(String(line.service_id)) ? line.service_id : '',
                      })
                    }}
                    required
                  >
                    <option value="">Choose technician</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={String(tech.id)}>
                        {tech.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {usingCatalog && (
                <div>
                  <label htmlFor={`walkin-service-id-${index}`}>Service menu</label>
                  <select
                    id={`walkin-service-id-${index}`}
                    className="form-select site-select"
                    value={line.service_id || ''}
                    onChange={(event) => handleServicePick(index, event)}
                  >
                    <option value="">Custom / other</option>
                    {lineOptions.map((entry) => (
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
                <label htmlFor={`walkin-service-${index}`}>
                  {usingCatalog ? 'Service name' : 'Service'}
                </label>
                <input
                  id={`walkin-service-${index}`}
                  value={line.service}
                  onChange={(event) => updateLine(index, { service: event.target.value })}
                  placeholder="e.g. Acrylics"
                  readOnly={usingCatalog && !customService}
                  required
                />
              </div>
              <div>
                <label htmlFor={`walkin-price-${index}`}>Price (KES)</label>
                <input
                  id={`walkin-price-${index}`}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={line.service_price_kes}
                  onChange={(event) => updateLine(index, { service_price_kes: event.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor={`walkin-payment-${index}`}>Payment</label>
                <select
                  id={`walkin-payment-${index}`}
                  className="form-select site-select"
                  value={line.payment_method || 'cash'}
                  onChange={(event) => updateLine(index, { payment_method: event.target.value })}
                  required
                >
                  {PAYMENT_METHODS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
              {(line.payment_method || 'cash') === 'bank' && (
                <div className="admin-walkin-form-span">
                  <label htmlFor={`walkin-mpesa-${index}`}>M-Pesa receipt code</label>
                  <input
                    id={`walkin-mpesa-${index}`}
                    value={line.mpesa_code || ''}
                    onChange={(event) => updateLine(index, { mpesa_code: event.target.value.toUpperCase() })}
                    placeholder="e.g. TGH7K2M91P"
                    autoComplete="off"
                    required
                  />
                  <p className="admin-walkin-services-hint mb-0 mt-1">
                    Copy the code from the customer message. One payment for several services: paste
                    the same code on each M-Pesa line.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      })}
      <div className="admin-walkin-services-footer">
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={addService}
          disabled={lines.length >= 12}
        >
          Add another service
        </button>
        {visitTotal > 0 ? (
          <span className="admin-walkin-visit-total">Visit total KES {visitTotal.toLocaleString()}</span>
        ) : null}
      </div>
    </div>
    <div className="admin-walkin-actions">
      <button type="submit" className="btn btn-sm btn-success" disabled={saving}>
        {saving
          ? 'Saving…'
          : lines.length > 1
            ? `Save ${lines.length} services`
            : 'Save walk-in'}
      </button>
    </div>
  </form>
  )
}

export default WalkInForm
