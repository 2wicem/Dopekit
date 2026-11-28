import { useMemo, useState } from 'react'
import { usePublicWorkers } from '../hooks/usePublicWorkers'
import { sortTechnicians, TECHNICIAN_SORT_OPTIONS } from '../utils/sortTechnicians'
import TechnicianCard from './TechnicianCard'

const AvailableWorkers = () => {
  const { workers, loading, error } = usePublicWorkers()
  const [sortBy, setSortBy] = useState('top-rated')

  const rankedTechnicians = useMemo(() => sortTechnicians(workers, sortBy), [workers, sortBy])

  return (
    <section
      id="technicians"
      className="available-workers"
      aria-labelledby="available-workers-heading"
    >
      <div className="available-workers-header text-center">
        <span className="available-workers-eyebrow">Top ratings</span>
        <h2 id="available-workers-heading" className="available-workers-title">
          Top-rated technicians
        </h2>
        <p className="available-workers-sub">
          Salon staff and freelance technicians ranked together by client ratings — review
          portfolios before you choose.
        </p>
      </div>

      {!loading && !error && workers.length > 0 && (
        <div className="available-workers-toolbar">
          <label htmlFor="discover-tech-sort" className="available-workers-sort-label">
            Sort by
          </label>
          <select
            id="discover-tech-sort"
            className="form-select site-select available-workers-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            aria-label="Sort technicians"
          >
            {TECHNICIAN_SORT_OPTIONS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <p className="available-workers-status text-center">Loading technicians...</p>}
      {error && (
        <p className="available-workers-status available-workers-status--error text-center">{error}</p>
      )}

      {!loading && !error && workers.length === 0 && (
        <p className="available-workers-status text-center">
          No technicians are listed yet.
        </p>
      )}

      {!loading && !error && rankedTechnicians.length > 0 && (
        <div className="available-workers-grid">
          {rankedTechnicians.map((worker) => (
            <TechnicianCard key={worker.id} worker={worker} />
          ))}
        </div>
      )}
    </section>
  )
}

export default AvailableWorkers
