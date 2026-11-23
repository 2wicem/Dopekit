import { useCallback, useEffect, useMemo, useState } from 'react'
import { todayIso } from '../constants/slots'
import { apiFetch } from '../config/api'
import { PAYMENT_METHODS, paymentMethodLabel } from '../constants/paymentMethods'
import './css/Dashboard.css'

const DEFAULT_RANGE_DAYS = 30
const INVENTORY_RANGE_DAYS = 7
const RANGE_PRESETS = [
  { days: 0, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
]

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

const ReportsPanel = ({
  scope = 'technician',
  salonQuery = '',
  technicians = [],
  canViewInventory = false,
  canRecordExpenses = null,
  variant = 'full',
}) => {
  const inventoryFirst = variant === 'inventory'
  const [fromDate, setFromDate] = useState(
    daysAgoIso(inventoryFirst ? INVENTORY_RANGE_DAYS : DEFAULT_RANGE_DAYS),
  )
  const [toDate, setToDate] = useState(todayIso())
  const [loading, setLoading] = useState(true)
  const [loadingDay, setLoadingDay] = useState(null)
  const [exporting, setExporting] = useState(null)
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
  const [completingId, setCompletingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [completeMethod, setCompleteMethod] = useState('cash')
  const [workerId, setWorkerId] = useState('')

  const isSalonWide = scope === 'admin' || scope === 'owner'
  const isAdminScope = scope === 'admin'
  const showInventory = isSalonWide || canViewInventory
  const allowExpenses = canRecordExpenses == null ? isSalonWide : canRecordExpenses
  const showExtraReports = !inventoryFirst
  const filterQuery = [salonQuery, workerId ? `worker_id=${workerId}` : '']
    .filter(Boolean)
    .join('&')

  const loadReports = useCallback(async () => {
    setLoading(true)
    setStatus(null)

    const query = buildQuery(fromDate, toDate, filterQuery)
    try {
      if (showInventory) {
        const inventoryResponse = await apiFetch(`/products/reports/daily-inventory/?${query}`)
        const inventoryData = await parseJson(inventoryResponse)
        setInventory(inventoryData)
        if (!showExtraReports) {
          setLoading(false)
        }
      }

      if (!showExtraReports) {
        return
      }

      const extraRequests = [
        apiFetch(`/products/reports/summary/?${query}`),
        apiFetch(`/products/reports/by-service/?${query}`),
        apiFetch(`/products/reports/by-venue/?${query}`),
        apiFetch(`/products/reports/timeline/?${query}`),
      ]
      if (isSalonWide) {
        extraRequests.push(apiFetch(`/products/reports/by-worker/?${query}`))
      }

      const responses = await Promise.all(extraRequests)
      const parsed = await Promise.all(responses.map(parseJson))
      setSummary(parsed[0])
      setByService(parsed[1].items || [])
      setByVenue(parsed[2].items || [])
      setTimeline(parsed[3].items || [])
      setByWorker(isSalonWide ? parsed[4]?.items || [] : [])
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate, isSalonWide, showInventory, filterQuery, showExtraReports])

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

  const mergeInventoryDay = (dayPayload) => {
    setInventory((current) => {
      if (!current?.days) {
        return current
      }
      return {
        ...current,
        days: current.days.map((day) => (day.date === dayPayload.date ? { ...day, ...dayPayload } : day)),
      }
    })
  }

  const loadDayDetails = async (date) => {
    setLoadingDay(date)
    try {
      const query = buildQuery(date, date, filterQuery)
      const response = await apiFetch(`/products/reports/daily-inventory/?${query}&detail=1`)
      const data = await parseJson(response)
      const dayPayload = data.days?.[0]
      if (dayPayload) {
        mergeInventoryDay(dayPayload)
      }
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setLoadingDay(null)
    }
  }

  const toggleDayExpanded = (day) => {
    const nextOpen = !expandedDays[day.date]
    setExpandedDays((current) => ({ ...current, [day.date]: nextOpen }))
    if (nextOpen && !day.details_loaded) {
      loadDayDetails(day.date)
    }
  }

  const applyRangePreset = (days) => {
    setToDate(todayIso())
    setFromDate(days === 0 ? todayIso() : daysAgoIso(days))
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

  const handleCompleteService = async (bookingId, paymentMethod = 'cash') => {
    setStatus(null)
    try {
      const response = await apiFetch(`/products/bookings/${bookingId}/complete/`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: paymentMethod }),
      })
      const data = await parseJson(response)
      setCompletingId(null)
      await loadReports()
      setStatus({ type: 'success', message: data.message || 'Added to daily inventory.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    }
  }

  const handleCancelService = async (row) => {
    const label = row.service && row.service !== '—' ? row.service : 'this service'
    if (
      !window.confirm(
        `Remove ${label} for ${row.client_name} (${row.worker_name}) from inventory? Use this if the job was not legitimate.`,
      )
    ) {
      return
    }
    setCancellingId(row.booking_id)
    setStatus(null)
    try {
      const response = await apiFetch(`/products/bookings/${row.booking_id}/cancel/`, {
        method: 'POST',
      })
      const data = await parseJson(response)
      const openDates = Object.keys(expandedDays).filter((date) => expandedDays[date])
      await loadReports()
      await Promise.all(openDates.map((date) => loadDayDetails(date)))
      setStatus({ type: 'success', message: data.message || 'Service removed from inventory.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setCancellingId(null)
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

  const handleExport = async (format) => {
    setExporting(format)
    setStatus(null)

    try {
      const query = buildQuery(fromDate, toDate, salonQuery)
      const path =
        format === 'pdf' ? `/products/reports/export/pdf/?${query}` : `/products/reports/export/?${query}`
      const response = await apiFetch(path)

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
      link.download = `bookings-${fromDate}-to-${toDate}.${format}`
      link.click()
      URL.revokeObjectURL(url)
      setStatus({ type: 'success', message: format === 'pdf' ? 'PDF downloaded.' : 'CSV downloaded.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message })
    } finally {
      setExporting(null)
    }
  }

  const scopeLabel = useMemo(
    () => (isSalonWide ? 'Salon-wide reports' : 'Your technician reports'),
    [isSalonWide]
  )

  return (
    <div className="reports-panel">
      <div className="reports-panel-header">
        <div>
          <h2 className="reports-panel-title">{scopeLabel}</h2>
          <p className="reports-panel-subtitle text-muted mb-0">
            {inventoryFirst
              ? 'Filter by technician to see their jobs. Open a day to cancel any that were not legitimate.'
              : 'Filter by appointment date range, then download a CSV or PDF for your records.'}
          </p>
        </div>
        <div className="reports-export-actions">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => handleExport('csv')}
            disabled={Boolean(exporting) || loading}
          >
            {exporting === 'csv' ? 'Exporting…' : 'Download CSV'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => handleExport('pdf')}
            disabled={Boolean(exporting) || loading}
          >
            {exporting === 'pdf' ? 'Exporting…' : 'Download PDF'}
          </button>
        </div>
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
        {technicians.length > 0 && (
          <div>
            <label htmlFor="reports-technician" className="form-label">
              Technician
            </label>
            <select
              id="reports-technician"
              className="form-select site-select"
              value={workerId}
              onChange={(event) => setWorkerId(event.target.value)}
            >
              <option value="">All technicians</option>
              {technicians.map((tech) => (
                <option key={tech.id} value={String(tech.id)}>
                  {tech.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="reports-range-presets">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => applyRangePreset(preset.days)}
              disabled={loading}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary reports-apply-btn"
          onClick={loadReports}
          disabled={loading}
        >
          {loading ? 'Updating…' : 'Apply'}
        </button>
      </div>

      {status && (
        <div className={`alert alert-${status.type === 'error' ? 'danger' : 'success'} mb-3`}>
          {status.message}
        </div>
      )}

      {loading && !inventory && !summary ? (
        <p className="text-center text-muted">Loading inventory…</p>
      ) : (
        <>
          {loading && (inventory || summary) ? (
            <p className="text-muted small mb-3">Updating totals…</p>
          ) : null}
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

          {showInventory && !allowExpenses && (
            <p className="text-muted small mb-3">
              These services are the same records your salon owner sees. Branch expenses are recorded
              by the salon owner. Freelance technicians record their own expenses.
            </p>
          )}

          {showInventory && inventory?.totals && (
            <div className="dashboard-stats mb-4">
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(inventory.totals.cash_kes)}</span>
                <span className="dashboard-stat-label">Cash</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(inventory.totals.bank_kes)}</span>
                <span className="dashboard-stat-label">Bank / M-Pesa</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(inventory.totals.revenue_kes)}</span>
                <span className="dashboard-stat-label">Revenue (completed)</span>
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
                  {allowExpenses && !isAdminScope ? (
                    <span className="reports-premium-badge"> Expenses</span>
                  ) : null}
                </p>
              </div>
              {allowExpenses && (
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setShowExpenseForm((open) => !open)}
                >
                  {showExpenseForm ? 'Close expense form' : 'Record expense'}
                </button>
              )}
            </div>

            {allowExpenses && showExpenseForm && (
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
                        onClick={() => toggleDayExpanded(day)}
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
                          {(loadingDay === day.date || !day.details_loaded) && (
                            <p className="text-muted mb-0">Loading this day…</p>
                          )}
                          {day.details_loaded && day.by_worker?.length > 0 && (
                            <div className="mb-3">
                              <h4 className="reports-inventory-subtitle">By technician</h4>
                              <table className="table reports-table mb-0">
                                <thead>
                                  <tr>
                                    <th>Technician</th>
                                    <th className="text-end">Services</th>
                                    <th className="text-end">Cash</th>
                                    <th className="text-end">Bank</th>
                                    <th className="text-end">Revenue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {day.by_worker.map((row) => (
                                    <tr key={row.worker_name}>
                                      <td>{row.worker_name}</td>
                                      <td className="text-end">{row.count}</td>
                                      <td className="text-end">{formatKes(row.cash_kes)}</td>
                                      <td className="text-end">{formatKes(row.bank_kes)}</td>
                                      <td className="text-end">{formatKes(row.revenue_kes)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {day.details_loaded && day.services?.length > 0 && (
                            <div className="mb-3">
                              <h4 className="reports-inventory-subtitle">Services</h4>
                              <table className="table reports-table mb-0">
                                <thead>
                                  <tr>
                                    <th>Client</th>
                                    <th>Phone</th>
                                    <th>Service</th>
                                    <th>Technician</th>
                                    <th className="text-end">Price</th>
                                    <th>Paid</th>
                                    <th>Status</th>
                                    <th aria-label="Inventory" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {day.services.map((row) => (
                                    <tr key={row.booking_id}>
                                      <td>
                                        {row.client_name}
                                        {row.is_walk_in ? (
                                          <span className="text-muted d-block small">Walk-in</span>
                                        ) : null}
                                      </td>
                                      <td>
                                        {row.client_phone ? (
                                          <a href={`tel:${row.client_phone}`}>{row.client_phone}</a>
                                        ) : (
                                          '—'
                                        )}
                                      </td>
                                      <td>{row.service}</td>
                                      <td>{row.worker_name}</td>
                                      <td className="text-end">{formatKes(row.price_kes)}</td>
                                      <td>
                                        {row.payment_method
                                          ? paymentMethodLabel(row.payment_method)
                                          : '—'}
                                      </td>
                                      <td>{row.status_label}</td>
                                      <td className="text-end">
                                        {row.can_complete && completingId === row.booking_id ? (
                                          <div className="d-flex flex-column align-items-end gap-1">
                                            <select
                                              className="form-select form-select-sm"
                                              value={completeMethod}
                                              onChange={(event) => setCompleteMethod(event.target.value)}
                                              aria-label="Payment method"
                                            >
                                              {PAYMENT_METHODS.map((entry) => (
                                                <option key={entry.value} value={entry.value}>
                                                  {entry.label}
                                                </option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              className="btn btn-link btn-sm p-0"
                                              onClick={() => handleCompleteService(row.booking_id, completeMethod)}
                                            >
                                              Confirm
                                            </button>
                                          </div>
                                        ) : row.can_complete ? (
                                          <button
                                            type="button"
                                            className="btn btn-link btn-sm p-0"
                                            onClick={() => {
                                              setCompletingId(row.booking_id)
                                              setCompleteMethod('cash')
                                            }}
                                          >
                                            Add to inventory
                                          </button>
                                        ) : null}
                                        {row.can_cancel ? (
                                          <button
                                            type="button"
                                            className="btn btn-link btn-sm text-danger p-0"
                                            disabled={cancellingId === row.booking_id}
                                            onClick={() => handleCancelService(row)}
                                          >
                                            {cancellingId === row.booking_id ? 'Removing…' : 'Cancel'}
                                          </button>
                                        ) : null}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          {day.details_loaded && day.expenses?.length > 0 && (
                            <div>
                              <h4 className="reports-inventory-subtitle">Expenses</h4>
                              <table className="table reports-table mb-0">
                                <thead>
                                  <tr>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th className="text-end">Amount</th>
                                    {allowExpenses && <th aria-label="Actions" />}
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
                                      {allowExpenses && (
                                        <td className="text-end">
                                          {row.can_delete !== false ? (
                                            <button
                                              type="button"
                                              className="btn btn-link btn-sm text-danger p-0"
                                              onClick={() => handleDeleteExpense(row.id)}
                                            >
                                              Remove
                                            </button>
                                          ) : null}
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

          {showExtraReports && (
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

            {isSalonWide && (
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
          )}
        </>
      )}
    </div>
  )
}

export default ReportsPanel
