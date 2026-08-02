import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicWorkers } from '../hooks/usePublicWorkers'
import { sortTechnicians, TECHNICIAN_SORT_OPTIONS } from '../utils/sortTechnicians'
import LandingTechnicianCard from './LandingTechnicianCard'

const LandingTechniciansSection = () => {
  const { workers, loading, error } = usePublicWorkers()
  const [sortBy, setSortBy] = useState('top-rated')

  const sortedWorkers = useMemo(() => sortTechnicians(workers, sortBy), [workers, sortBy])

  if (!loading && !error && workers.length === 0) {
    return null
  }

  return (
    <section className="landing-technicians" aria-labelledby="landing-technicians-heading">
      <div className="landing-technicians-header text-center">
        <span className="landing-technicians-eyebrow">Our team</span>
        <h2 id="landing-technicians-heading" className="landing-technicians-title">
          Meet our technicians
        </h2>
        <p className="landing-technicians-sub">
          Latest work, live ratings — pick your artist and book.
        </p>
      </div>

      {!loading && !error && workers.length > 0 && (
        <div className="landing-technicians-toolbar">
          <label htmlFor="landing-tech-sort" className="landing-technicians-sort-label">
            Sort by
          </label>
          <select
            id="landing-tech-sort"
            className="form-select site-select landing-technicians-sort"
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

      {loading && <p className="landing-technicians-status text-center">Loading technicians...</p>}
      {error && (
        <p className="landing-technicians-status landing-technicians-status--error text-center">{error}</p>
      )}

      {!loading && !error && sortedWorkers.length > 0 && (
        <>
          <div className="landing-technicians-grid">
            {sortedWorkers.map((worker) => (
              <LandingTechnicianCard key={worker.id} worker={worker} />
            ))}
          </div>
          <p className="landing-technicians-more text-center">
            <Link to="/Services#technicians" className="landing-technicians-more-link">
              View full team
            </Link>
          </p>
        </>
      )}
    </section>
  )
}

export default LandingTechniciansSection
