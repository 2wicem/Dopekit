import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayIso } from '../constants/slots'
import { apiFetch } from '../config/api'
import './css/Dashboard.css'

const DEFAULT_RANGE_DAYS = 30

const daysAgoIso = (days) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

const buildQuery = (from, to, salonQuery = '') => {
  const params = new URLSearchParams({ from, to })
  if (salonQuery) {
    const extra = new URLSearchParams(salonQuery)
    extra.forEach((value, key) => params.set(key, value))
  }
  return params.toString()
}

const parseJson = async (response) => {
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.')
  }
  return data
}

const ReportsPanel = ({ scope = 'technician', salonQuery = '' }) => {
  const [fromDate, setFromDate] = useState(daysAgoIso(DEFAULT_RANGE_DAYS))
  const [toDate, setToDate] = useState(todayIso())
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState(null)
  const [summary, setSummary] = useState(null)
  const [byService, setByService] = useState([])
  const [byVenue, setByVenue] = useState([])
  const [byWorker, setByWorker] = useState([])
  const [timeline, setTimeline] = useState([])

  const isAdminScope = scope === 'admin'

  const loadReports = useCallback(async () => {
    setLoading(true)
    setStatus(null)

    const query = buildQuery(fromDate, toDate, salonQuery)
    const requests = [
      apiFetch(`/products/reports/summary/?${query}`),
      apiFetch(`/products/reports/by-service/?${query}`),
      apiFetch(`/products/reports/by-venue/?${query}`),
      apiFetch(`/products/reports/timeline/?${query}`),
    ]

    if (isAdminScope) {
      requests.push(apiFetch(`/products/reports/by-worker/?${query}`))
    }

    try {
      const responses = await Promise.all(requests)
      const parsed = await Promise.all(responses.map(parseJson))

      setSummary(parsed[0])
      setByService(parsed[1].items || [])
      setByVenue(parsed[2].items || [])
      setTimeline(parsed[3].items || [])
      setByWorker(isAdminScope ? parsed[4]?.items || [] : [])
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, isAdminScope, salonQuery])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleExport = async () => {
    setExporting(true)
    setStatus(null)

    try {
      const query = buildQuery(fromDate, toDate, salonQuery)
      const response = await apiFetch(`/products/reports/export/?${query}`)

      if (!response.ok) {
        const text = await response.text()
        let message = 'Could not export report.'
        if (text) {
          try {
            message = JSON.parse(text).error || message
          } catch {
            message = text
          }
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bookings-${fromDate}-to-${toDate}.csv`
      link.click()
      URL.revokeObjectURL(url)
      setStatus({ type: 'success', message: 'Report downloaded.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setExporting(false)
    }
  }

  const scopeLabel = useMemo(
    () => (isAdminScope ? 'Salon-wide reports' : 'Your technician reports'),
    [isAdminScope]
  )

  return (
    <div className="reports-panel">
      <div className="reports-panel-header">
        <div>
          <h2 className="reports-panel-title">{scopeLabel}</h2>
          <p className="reports-panel-subtitle text-muted mb-0">
            Filter by appointment date range, then download a CSV for your records.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          onClick={handleExport}
          disabled={exporting || loading}
        >
          {exporting ? 'Exporting…' : 'Download CSV'}
        </button>
      </div>

      <div className="reports-filters">
        <div>
          <label htmlFor="reports-from" className="form-label">
            From
          </label>
          <input
            id="reports-from"
            type="date"
            className="form-control"
            value={fromDate}
            max={toDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="reports-to" className="form-label">
            To
          </label>
          <input
            id="reports-to"
            type="date"
            className="form-control"
            value={toDate}
            min={fromDate}
            max={todayIso()}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary reports-apply-btn"
          onClick={loadReports}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {status && (
        <div className={`alert alert-${status.type === 'error' ? 'danger' : 'success'} mb-3`}>
          {status.message}
        </div>
      )}

      {loading ? (
        <p className="text-center text-muted">Loading reports…</p>
      ) : (
        <>
          {summary && (
            <div className="dashboard-stats mb-4">
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{summary.total}</span>
                <span className="dashboard-stat-label">Total bookings</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{summary.pending}</span>
                <span className="dashboard-stat-label">Pending</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{summary.accepted}</span>
                <span className="dashboard-stat-label">Accepted</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{summary.cancelled}</span>
                <span className="dashboard-stat-label">Cancelled</span>
              </div>
            </div>
          )}

          <div className="reports-grid">
            <div className="reports-card">
              <h3 className="reports-card-title">By service</h3>
              {byService.length === 0 ? (
                <p className="text-muted reports-empty">No bookings in this period.</p>
              ) : (
                <table className="table reports-table mb-0">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th className="text-end">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byService.map((row) => (
                      <tr key={row.service}>
                        <td>{row.service}</td>
                        <td className="text-end">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="reports-card">
              <h3 className="reports-card-title">By venue</h3>
              {byVenue.length === 0 ? (
                <p className="text-muted reports-empty">No bookings in this period.</p>
              ) : (
                <table className="table reports-table mb-0">
                  <thead>
                    <tr>
                      <th>Venue</th>
                      <th className="text-end">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byVenue.map((row) => (
                      <tr key={row.venue}>
                        <td>{row.venue_label}</td>
                        <td className="text-end">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {isAdminScope && (
              <div className="reports-card">
                <h3 className="reports-card-title">By technician</h3>
                {byWorker.length === 0 ? (
                  <p className="text-muted reports-empty">No bookings in this period.</p>
                ) : (
                  <table className="table reports-table mb-0">
                    <thead>
                      <tr>
                        <th>Technician</th>
                        <th className="text-end">Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byWorker.map((row) => (
                        <tr key={row.worker_id ?? 'unassigned'}>
                          <td>{row.worker_name}</td>
                          <td className="text-end">{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="reports-card reports-card--wide">
              <h3 className="reports-card-title">Daily timeline</h3>
              {timeline.length === 0 ? (
                <p className="text-muted reports-empty">No bookings in this period.</p>
              ) : (
                <table className="table reports-table mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-end">Bookings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date ? new Date(`${row.date}T12:00:00`).toLocaleDateString() : '—'}</td>
                        <td className="text-end">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ReportsPanel
