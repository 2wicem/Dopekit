import { useCallback, useEffect, useState } from 'react'
import { todayIso, weekStartIso } from '../constants/slots'
import { apiFetch } from '../config/api'
import './css/Dashboard.css'

const formatKes = (amount) => `KSh ${Number(amount || 0).toLocaleString()}`

const emptyAdvance = {
  worker_id: '',
  amount_kes: '',
  notes: '',
  business_date: todayIso(),
}

const OwnerPayoutsPanel = ({ salons, onStatus }) => {
  const [salonId, setSalonId] = useState('')
  const [fromDate, setFromDate] = useState(weekStartIso())
  const [toDate, setToDate] = useState(todayIso())
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [planForm, setPlanForm] = useState({
    wage_type: 'none',
    wage_kes: '',
    commission_percent: '',
  })
  const [planSaving, setPlanSaving] = useState(false)
  const [advanceForm, setAdvanceForm] = useState(emptyAdvance)
  const [advanceSaving, setAdvanceSaving] = useState(false)

  const loadPayouts = useCallback(async () => {
    setLoading(true)
    onStatus?.(null)
    const params = new URLSearchParams({ from: fromDate, to: toDate })
    if (salonId) {
      params.set('salon_id', salonId)
    }
    try {
      const response = await apiFetch(`/products/owner/payouts/?${params}`)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || 'Could not load payouts.')
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
    loadPayouts()
  }, [loadPayouts])

  const startEdit = (row) => {
    setEditingId(row.worker_id)
    setPlanForm({
      wage_type: row.compensation?.wage_type || 'none',
      wage_kes: row.compensation?.wage_kes ? String(row.compensation.wage_kes) : '',
      commission_percent: row.compensation?.commission_percent || '',
    })
  }

  const savePlan = async (event) => {
    event.preventDefault()
    if (!editingId) {
      return
    }
    setPlanSaving(true)
    onStatus?.(null)
    try {
      const response = await apiFetch(`/products/owner/technicians/${editingId}/pay-plan/`, {
        method: 'PATCH',
        body: JSON.stringify({
          wage_type: planForm.wage_type,
          wage_kes: planForm.wage_kes === '' ? 0 : Number(planForm.wage_kes),
          commission_percent: planForm.commission_percent === '' ? 0 : planForm.commission_percent,
          salon_id: workers.find((row) => row.worker_id === editingId)?.salon_id || salonId || undefined,
        }),
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || 'Could not save pay plan.')
      }
      onStatus?.({ type: 'success', message: data.message })
      setEditingId(null)
      await loadPayouts()
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setPlanSaving(false)
    }
  }

  const saveAdvance = async (event) => {
    event.preventDefault()
    setAdvanceSaving(true)
    onStatus?.(null)
    try {
      const response = await apiFetch('/products/owner/advances/', {
        method: 'POST',
        body: JSON.stringify({
          ...advanceForm,
          amount_kes: Number(advanceForm.amount_kes),
          salon_id: salonId || undefined,
        }),
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || 'Could not record advance.')
      }
      onStatus?.({ type: 'success', message: data.message })
      setAdvanceForm({ ...emptyAdvance, business_date: todayIso() })
      await loadPayouts()
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    } finally {
      setAdvanceSaving(false)
    }
  }

  const removeAdvance = async (advanceId) => {
    if (!window.confirm('Remove this advance?')) {
      return
    }
    onStatus?.(null)
    try {
      const response = await apiFetch(`/products/owner/advances/${advanceId}/`, {
        method: 'DELETE',
      })
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}
      if (!response.ok) {
        throw new Error(data.error || 'Could not remove advance.')
      }
      onStatus?.({ type: 'success', message: data.message })
      await loadPayouts()
    } catch (error) {
      onStatus?.({ type: 'error', message: error.message })
    }
  }

  const workers = report?.workers || []
  const totals = report?.totals
  const days = report?.days || []

  return (
    <div>
      <p className="text-muted mb-3">
        Daily income, commission and advances for each salon technician. Set commission, record an
        advance, then pick a date range to see what is still owed.
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
        <p className="text-muted">Loading payouts…</p>
      ) : (
        <>
          {totals && (
            <div className="dashboard-stats mb-4">
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(totals.income_kes ?? totals.collected_kes)}</span>
                <span className="dashboard-stat-label">Income collected</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(totals.commission_kes)}</span>
                <span className="dashboard-stat-label">Commission</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(totals.advances_kes)}</span>
                <span className="dashboard-stat-label">Advances</span>
              </div>
              <div className="dashboard-stat-card">
                <span className="dashboard-stat-value">{formatKes(totals.net_pay_kes)}</span>
                <span className="dashboard-stat-label">Still to pay</span>
              </div>
            </div>
          )}

          <div className="reports-card reports-card--wide mb-4">
            <h3 className="reports-card-title">Daily technician list</h3>
            {days.length === 0 ? (
              <p className="text-muted mb-0">No income, commission or advances in this range.</p>
            ) : (
              <div className="dashboard-table-wrap table-responsive">
                <table className="table reports-table mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Technician</th>
                      <th className="text-end">Jobs</th>
                      <th className="text-end">Income</th>
                      <th className="text-end">Commission</th>
                      <th className="text-end">Advance</th>
                      <th className="text-end">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days.map((row) => (
                      <tr key={`${row.date}-${row.worker_id}`}>
                        <td>
                          {new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td>{row.worker_name}</td>
                        <td className="text-end">{row.jobs}</td>
                        <td className="text-end">{formatKes(row.income_kes)}</td>
                        <td className="text-end">{formatKes(row.commission_kes)}</td>
                        <td className="text-end">{formatKes(row.advances_kes)}</td>
                        <td className="text-end">
                          <strong>{formatKes(row.net_pay_kes)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form className="reports-expense-form mb-4" onSubmit={saveAdvance}>
            <h3 className="reports-card-title">Record advance</h3>
            <label>
              Technician
              <select
                className="form-select site-select"
                value={advanceForm.worker_id}
                onChange={(event) =>
                  setAdvanceForm((current) => ({ ...current, worker_id: event.target.value }))
                }
                required
              >
                <option value="">Choose…</option>
                {workers.map((row) => (
                  <option key={row.worker_id} value={String(row.worker_id)}>
                    {row.worker_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                className="form-control"
                value={advanceForm.business_date}
                max={todayIso()}
                onChange={(event) =>
                  setAdvanceForm((current) => ({ ...current, business_date: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Amount (KES)
              <input
                type="number"
                min="1"
                className="form-control"
                value={advanceForm.amount_kes}
                onChange={(event) =>
                  setAdvanceForm((current) => ({ ...current, amount_kes: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Note
              <input
                className="form-control"
                value={advanceForm.notes}
                onChange={(event) =>
                  setAdvanceForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={advanceSaving}>
              {advanceSaving ? 'Saving…' : 'Save advance'}
            </button>
          </form>

          {workers.length === 0 ? (
            <p className="text-muted">Assign technicians to a branch to set pay.</p>
          ) : (
            workers.map((row) => (
              <section key={row.worker_id} className="reports-card reports-card--wide mb-3">
                <h3 className="reports-card-title">{row.worker_name}</h3>
                <p className="text-muted small mb-2">
                  {row.compensation.commission_percent}% commission
                  {row.compensation.wage_type !== 'none'
                    ? ` · ${row.compensation.wage_type_label} ${formatKes(row.compensation.wage_kes)}`
                    : ' · no wage'}
                  {' · '}
                  {row.jobs} job{row.jobs === 1 ? '' : 's'} / {row.days_worked} day
                  {row.days_worked === 1 ? '' : 's'}
                </p>
                <p className="mb-2">
                  Income {formatKes(row.income_kes ?? row.collected_kes)} · Commission{' '}
                  {formatKes(row.commission_kes)} · Wage {formatKes(row.wage_kes)} · Advances{' '}
                  {formatKes(row.advances_kes)} · <strong>Pay {formatKes(row.net_pay_kes)}</strong>
                </p>
                {editingId === row.worker_id ? (
                  <form className="reports-expense-form" onSubmit={savePlan}>
                    <label>
                      Commission %
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={planForm.commission_percent}
                        onChange={(event) =>
                          setPlanForm((current) => ({
                            ...current,
                            commission_percent: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Wage
                      <select
                        className="form-select site-select"
                        value={planForm.wage_type}
                        onChange={(event) =>
                          setPlanForm((current) => ({ ...current, wage_type: event.target.value }))
                        }
                      >
                        <option value="none">No wage</option>
                        <option value="daily">Daily wage</option>
                        <option value="weekly">Weekly wage</option>
                      </select>
                    </label>
                    {planForm.wage_type !== 'none' && (
                      <label>
                        Wage (KES)
                        <input
                          className="form-control"
                          type="number"
                          min="0"
                          value={planForm.wage_kes}
                          onChange={(event) =>
                            setPlanForm((current) => ({ ...current, wage_kes: event.target.value }))
                          }
                        />
                      </label>
                    )}
                    <button type="submit" className="btn btn-primary btn-sm" disabled={planSaving}>
                      {planSaving ? 'Saving…' : 'Save pay plan'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => startEdit(row)}>
                    Edit wage &amp; commission
                  </button>
                )}
                {row.advances.length > 0 && (
                  <table className="table reports-table mt-3 mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Note</th>
                        <th className="text-end">Advance</th>
                        <th aria-label="Remove" />
                      </tr>
                    </thead>
                    <tbody>
                      {row.advances.map((advance) => (
                        <tr key={advance.id}>
                          <td>{advance.business_date}</td>
                          <td>{advance.notes || '—'}</td>
                          <td className="text-end">{formatKes(advance.amount_kes)}</td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0"
                              onClick={() => removeAdvance(advance.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}

export default OwnerPayoutsPanel
