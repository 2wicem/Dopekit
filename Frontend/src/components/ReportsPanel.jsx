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

const formatKes = (amount) => `KSh ${Number(amount || 0).toLocaleString()}`

const EXPENSE_CATEGORIES = [
  { value: 'supplies', label: 'Supplies' },
  { value: 'transport', label: 'Transport' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'rent', label: 'Rent' },
  { value: 'wages', label: 'Wages' },
  { value: 'other', label: 'Other' },
]

const emptyExpenseForm = {
  business_date: todayIso(),
  label: '',
  category: 'other',
  amount_kes: '',
  notes: '',
}

const ReportsPanel = ({ scope = 'technician', salonQuery = '', canViewInventory = false }) => {
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
  const [inventory, setInventory] = useState(null)
  const [expandedDays, setExpandedDays] = useState({})
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm)
  const [expenseSaving, setExpenseSaving] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)

  const isAdminScope = scope === 'admin'
  const showInventory = isAdminScope || canViewInventory

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

    if (showInventory) {
      requests.push(apiFetch(`/products/reports/daily-inventory/?${query}`))
    }

    if (isAdminScope) {
      requests.push(apiFetch(`/products/reports/by-worker/?${query}`))
    }

    try {
      const responses = await Promise.all(requests)
      const parsed = await Promise.all(responses.map(parseJson))

      let index = 0
      setSummary(parsed[index++])
      setByService(parsed[index].items || [])
      index += 1
      setByVenue(parsed[index].items || [])
      index += 1
      setTimeline(parsed[index].items || [])
      index += 1
      if (showInventory) {
        setInventory(parsed[index] || null)
        index += 1
      } else {
        setInventory(null)
      }
      setByWorker(isAdminScope ? parsed[index]?.items || [] : [])
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, isAdminScope, showInventory, salonQuery])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const salonIdFromQuery = useMemo(() => {
    if (!salonQuery) {
      return null
    }
    const params = new URLSearchParams(salonQuery)
    const raw = params.get('salon_id')
    if (!raw) {
      return null
    }
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }, [salonQuery])

  const toggleDayExpanded = (date) => {
    setExpandedDays((current) => ({ ...current, [date]: !current[date] }))
  }

  const handleExpenseChange = (event) => {
    const { name, value } = event.target
    setExpenseForm((current) => ({ ...current, [name]: value }))
  }

  const handleExpenseSubmit = async (event) => {
    event.preventDefault()
    setExpenseSaving(true)
    setStatus(null)

    const payload = {
      ...expenseForm,
      amount_kes: Number(expenseForm.amount_kes),
    }
    if (salonIdFromQuery) {
      payload.salon_id = salonIdFromQuery
    }

    try {
      const response = await apiFetch('/products/reports/daily-expenses/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await parseJson(response)
      setExpenseForm({ ...emptyExpenseForm, business_date: toDate })
      setShowExpenseForm(false)
      await loadReports()
      setStatus({ type: 'success', message: 'Daily expense recorded.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setExpenseSaving(false)
    }
  }

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Remove this expense from your daily records?')) {
      return
    }
    setStatus(null)
    try {
      const response = await apiFetch(`/products/reports/daily-expenses/${expenseId}/`, {
        method: 'DELETE',
      })
      await parseJson(response)
      await loadReports()
      setStatus({ type: 'success', message: 'Expense removed.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    }
  }

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

          {!showInventory && !isAdminScope && (
            <div className="reports-premium-upsell mb-4">
              <h3 className="reports-card-title mb-1">Daily inventory (Premium)</h3>
              <p className="text-muted mb-0">
                Track services, prices, technician performance, and daily expenses for your salon.
                Ask your admin to enable <strong>Premium inventory</strong> on your account to unlock
                this view.
              </p>
            </div>
          )}

          {showInventory && inventory?.totals && (
            <div className="dashboard-stats mb-4">
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(inventory.totals.revenue_kes)}</span>
                <span className="dashboard-stat-label">Revenue (accepted)</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(inventory.totals.expenses_kes)}</span>
                <span className="dashboard-stat-label">Expenses</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(inventory.totals.net_kes)}</span>
                <span className="dashboard-stat-label">Net</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{inventory.totals.services_count}</span>
                <span className="dashboard-stat-label">Services logged</span>
              </div>
            </div>
          )}

          {showInventory && (
          <div className="reports-card reports-card--wide mb-4">
            <div className="reports-inventory-header">
              <div>
                <h3 className="reports-card-title mb-1">Daily inventory</h3>
                <p className="text-muted reports-panel-subtitle mb-0">
                  Per-day services, prices, technician, and expenses for your selected range.
                  {!isAdminScope && canViewInventory ? (
                    <span className="reports-premium-badge"> Premium</span>
                  ) : null}
                </p>
              </div>
              {isAdminScope && (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setShowExpenseForm((open) => !open)}
                >
                  {showExpenseForm ? 'Close expense form' : 'Record expense'}
                </button>
              )}
            </div>

            {isAdminScope && showExpenseForm && (
              <form className="reports-expense-form" onSubmit={handleExpenseSubmit}>
                <div>
                  <label htmlFor="expense-date" className="form-label">
                    Date
                  </label>
                  <input
                    id="expense-date"
                    type="date"
                    name="business_date"
                    className="form-control"
                    value={expenseForm.business_date}
                    max={todayIso()}
                    onChange={handleExpenseChange}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="expense-label" className="form-label">
                    Description
                  </label>
                  <input
                    id="expense-label"
                    name="label"
                    className="form-control"
                    value={expenseForm.label}
                    onChange={handleExpenseChange}
                    placeholder="e.g. Acrylic powder restock"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="expense-category" className="form-label">
                    Category
                  </label>
                  <select
                    id="expense-category"
                    name="category"
                    className="form-select site-select"
                    value={expenseForm.category}
                    onChange={handleExpenseChange}
                  >
                    {EXPENSE_CATEGORIES.map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="expense-amount" className="form-label">
                    Amount (KES)
                  </label>
                  <input
                    id="expense-amount"
                    name="amount_kes"
                    type="number"
                    min="1"
                    className="form-control"
                    value={expenseForm.amount_kes}
                    onChange={handleExpenseChange}
                    required
                  />
                </div>
                <div className="reports-expense-form-notes">
                  <label htmlFor="expense-notes" className="form-label">
                    Notes
                  </label>
                  <input
                    id="expense-notes"
                    name="notes"
                    className="form-control"
                    value={expenseForm.notes}
                    onChange={handleExpenseChange}
                    placeholder="Optional"
                  />
                </div>
                <button type="submit" className="btn btn-primary" disabled={expenseSaving}>
                  {expenseSaving ? 'Saving…' : 'Save expense'}
                </button>
              </form>
            )}

            {!inventory?.days?.some(
              (day) => day.services_count > 0 || day.expenses_kes > 0
            ) ? (
              <p className="text-muted reports-empty mb-0">
                No services or expenses recorded in this period.
              </p>
            ) : (
              <div className="reports-inventory-days">
                {[...inventory.days].reverse().map((day) => {
                  const hasActivity = day.services_count > 0 || day.expenses_kes > 0
                  if (!hasActivity) {
                    return null
                  }
                  const expanded = Boolean(expandedDays[day.date])
                  return (
                    <div key={day.date} className="reports-inventory-day">
                      <button
                        type="button"
                        className="reports-inventory-day-toggle"
                        onClick={() => toggleDayExpanded(day.date)}
                        aria-expanded={expanded}
                      >
                        <span>
                          {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="reports-inventory-day-meta">
                          {day.services_count} service{day.services_count === 1 ? '' : 's'} ·{' '}
                          {formatKes(day.revenue_kes)} revenue · {formatKes(day.expenses_kes)} expenses ·{' '}
                          <strong>{formatKes(day.net_kes)} net</strong>
                        </span>
                      </button>
                      {expanded && (
                        <div className="reports-inventory-day-body">
                          {day.by_worker?.length > 0 && (
                            <div className="mb-3">
                              <h4 className="reports-inventory-subtitle">By technician</h4>
                              <table className="table reports-table mb-0">
                                <thead>
                                  <tr>
                                    <th>Technician</th>
                                    <th className="text-end">Services</th>
                                    <th className="text-end">Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {day.by_worker.map((row) => (
                                    <tr key={row.worker_name}>
                                      <td>{row.worker_name}</td>
                                      <td className="text-end">{row.count}</td>
                                      <td className="text-end">{formatKes(row.revenue_kes)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {day.services.length > 0 && (
                            <div className="mb-3">
                              <h4 className="reports-inventory-subtitle">Services</h4>
                              <table className="table reports-table mb-0">
                                <thead>
                                  <tr>
                                    <th>Client</th>
                                    <th>Service</th>
                                    <th>Technician</th>
                                    <th className="text-end">Price</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {day.services.map((row) => (
                                    <tr key={row.booking_id}>
                                      <td>{row.client_name}</td>
                                      <td>{row.service}</td>
                                      <td>{row.worker_name}</td>
                                      <td className="text-end">{formatKes(row.price_kes)}</td>
                                      <td>{row.status_label}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {day.expenses.length > 0 && (
                            <div>
                              <h4 className="reports-inventory-subtitle">Expenses</h4>
                              <table className="table reports-table mb-0">
                                <thead>
                                  <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th className="text-end">Amount</th>
                                    {isAdminScope && <th aria-label="Actions" />}
                                  </tr>
                                </thead>
                                <tbody>
                                  {day.expenses.map((row) => (
                                    <tr key={row.id}>
                                      <td>
                                        {row.label}
                                        {row.notes ? (
                                          <span className="text-muted d-block small">{row.notes}</span>
                                        ) : null}
                                      </td>
                                      <td>{row.category_label}</td>
                                      <td className="text-end">{formatKes(row.amount_kes)}</td>
                                      {isAdminScope && (
                                        <td className="text-end">
                                          <button
                                            type="button"
                                            className="btn btn-link btn-sm text-danger p-0"
                                            onClick={() => handleDeleteExpense(row.id)}
                                          >
                                            Remove
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
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
