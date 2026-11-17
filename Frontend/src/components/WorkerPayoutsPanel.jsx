import { useCallback, useEffect, useState } from 'react'
import { todayIso, weekStartIso } from '../constants/slots'
import { apiFetch } from '../config/api'
import './css/Dashboard.css'

const formatKes = (amount) => `KSh ${Number(amount || 0).toLocaleString()}`

const WorkerPayoutsPanel = () => {
  const [fromDate, setFromDate] = useState(weekStartIso())
  const [toDate, setToDate] = useState(todayIso())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [report, setReport] = useState(null)

  const loadPayouts = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ from: fromDate, to: toDate })
    try {
      const response = await apiFetch(`/products/worker/payouts/?${params}`)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || 'Could not load your pay.')
      }
      setReport(data)
    } catch (err) {
      setReport(null)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => {
    loadPayouts()
  }, [loadPayouts])

  return (
    <div>
      <p className="text-muted mb-3">
        Your salon sets wage and commission. This is what you earned minus advances already given.
      </p>
      <div className="d-flex flex-wrap gap-3 mb-3 align-items-end">
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
      {loading && <p className="worker-app-loading">Loading pay…</p>}
      {error && <p className="text-danger">{error}</p>}
      {!loading && !error && report && (
        <>
          <div className="worker-app-stats">
            <div className="worker-app-stat">
              <span className="worker-app-stat-value">{formatKes(report.commission_kes)}</span>
              <span className="worker-app-stat-label">Commission</span>
            </div>
            <div className="worker-app-stat">
              <span className="worker-app-stat-value">{formatKes(report.wage_kes)}</span>
              <span className="worker-app-stat-label">Wage</span>
            </div>
            <div className="worker-app-stat">
              <span className="worker-app-stat-value">{formatKes(report.advances_kes)}</span>
              <span className="worker-app-stat-label">Advances</span>
            </div>
            <div className="worker-app-stat">
              <span className="worker-app-stat-value">{formatKes(report.net_pay_kes)}</span>
              <span className="worker-app-stat-label">To be paid</span>
            </div>
          </div>
          <p className="text-muted small">
            {report.compensation.commission_percent}% of {formatKes(report.collected_kes)} collected
            {report.compensation.wage_type !== 'none'
              ? ` · ${report.compensation.wage_type_label} ${formatKes(report.compensation.wage_kes)}`
              : ''}
            {' · '}
            {report.jobs} job{report.jobs === 1 ? '' : 's'}
          </p>
          {report.advances?.length > 0 && (
            <table className="table reports-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Note</th>
                  <th className="text-end">Advance</th>
                </tr>
              </thead>
              <tbody>
                {report.advances.map((advance) => (
                  <tr key={advance.id}>
                    <td>{advance.business_date}</td>
                    <td>{advance.notes || '—'}</td>
                    <td className="text-end">{formatKes(advance.amount_kes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

export default WorkerPayoutsPanel
