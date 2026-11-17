import { useCallback, useEffect, useState } from 'react'
import { todayIso } from '../constants/slots'
import { apiFetch } from '../config/api'
import './css/Dashboard.css'

const formatKes = (amount) => `KSh ${Number(amount || 0).toLocaleString()}`

const OwnerPaymentsPanel = ({ salons, onStatus }) => {
  const [salonId, setSalonId] = useState('')
  const [fromDate, setFromDate] = useState(todayIso())
  const [toDate, setToDate] = useState(todayIso())
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)

  const loadPayments = useCallback(async () => {
    setLoading(true)
    onStatus?.(null)
    const params = new URLSearchParams({ from: fromDate, to: toDate })
    if (salonId) {
      params.set('salon_id', salonId)
    }
    try {
      const response = await apiFetch(`/products/owner/payments/?${params}`)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || 'Could not load payments.')
      }
      setReport(data)
    } catch (error) {
      setReport(null)
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, salonId, onStatus])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const totals = report?.totals

  return (
    <div>
      <p className="text-muted mb-3">
        Cash and bank / M-Pesa collected when technicians mark jobs done. Totals are per technician and for
        the salon.
      </p>
      <div className="d-flex flex-wrap gap-3 mb-3 align-items-end">
        {salons.length > 1 && (
          <label className="owner-branch-picker mb-0">
            Branch
            <select
              className="form-select site-select"
              value={salonId}
              onChange={(event) => setSalonId(event.target.value)}
            >
              <option value="">All branches</option>
              {salons.map((salon) => (
                <option key={salon.id} value={String(salon.id)}>
                  {salon.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          From
          <input
            type="date"
            className="form-control"
            value={fromDate}
            max={toDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            className="form-control"
            value={toDate}
            min={fromDate}
            max={todayIso()}
            onChange={(event) => setToDate(event.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <p className="text-muted">Loading payments…</p>
      ) : !totals ? (
        <p className="text-muted">No payment data yet.</p>
      ) : (
        <>
          <div className="dashboard-stats mb-4">
            <div className="dashboard-stat-card">
              <span className="dashboard-stat-value">{formatKes(totals.cash_kes)}</span>
              <span className="dashboard-stat-label">Cash</span>
            </div>
            <div className="dashboard-stat-card">
              <span className="dashboard-stat-value">{formatKes(totals.bank_kes)}</span>
              <span className="dashboard-stat-label">Bank / M-Pesa</span>
            </div>
            <div className="dashboard-stat-card">
              <span className="dashboard-stat-value">{formatKes(totals.collected_kes)}</span>
              <span className="dashboard-stat-label">Collected</span>
            </div>
            <div className="dashboard-stat-card">
              <span className="dashboard-stat-value">{totals.jobs}</span>
              <span className="dashboard-stat-label">Jobs</span>
            </div>
          </div>

          {(report.days || []).length === 0 ? (
            <p className="text-muted">No completed paid jobs in this range.</p>
          ) : (
            (report.days || []).map((day) => (
              <section key={day.date} className="reports-card reports-card--wide mb-3">
                <h3 className="reports-card-title">
                  {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </h3>
                <p className="text-muted small">
                  {formatKes(day.cash_kes)} cash · {formatKes(day.bank_kes)} bank · {day.jobs} job
                  {day.jobs === 1 ? '' : 's'}
                  {day.unpaid_kes > 0 ? ` · ${formatKes(day.unpaid_kes)} not recorded` : ''}
                </p>
                {day.by_worker.length > 0 && (
                  <table className="table reports-table mb-3">
                    <thead>
                      <tr>
                        <th>Technician</th>
                        <th className="text-end">Jobs</th>
                        <th className="text-end">Cash</th>
                        <th className="text-end">Bank</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.by_worker.map((row) => (
                        <tr key={row.worker_name}>
                          <td>{row.worker_name}</td>
                          <td className="text-end">{row.jobs}</td>
                          <td className="text-end">{formatKes(row.cash_kes)}</td>
                          <td className="text-end">{formatKes(row.bank_kes)}</td>
                          <td className="text-end">{formatKes(row.collected_kes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <table className="table reports-table mb-0">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Service</th>
                      <th>Technician</th>
                      <th>Paid</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.payments.map((row) => (
                      <tr key={row.booking_id}>
                        <td>
                          {row.client_name}
                          {row.is_walk_in ? (
                            <span className="text-muted d-block small">Walk-in</span>
                          ) : null}
                        </td>
                        <td>{row.service}</td>
                        <td>{row.worker_name}</td>
                        <td>{row.payment_method_label}</td>
                        <td className="text-end">{formatKes(row.amount_kes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}

export default OwnerPaymentsPanel
