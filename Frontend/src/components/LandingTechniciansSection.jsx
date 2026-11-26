import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePublicSalons } from '../hooks/usePublicSalons'
import { usePublicWorkers } from '../hooks/usePublicWorkers'
import {
  salonsWithDerivedRatings,
  sortSalonsByRating,
  sortTechnicians,
  TECHNICIAN_SORT_OPTIONS,
} from '../utils/sortTechnicians'
import LandingSalonRatingCard from './LandingSalonRatingCard'
import LandingTechnicianCard from './LandingTechnicianCard'

const LandingTechniciansSection = () => {
  const { workers, loading: workersLoading, error: workersError } = usePublicWorkers()
  const { salons, loading: salonsLoading, error: salonsError } = usePublicSalons()
  const [sortBy, setSortBy] = useState('top-rated')

  const loading = workersLoading || salonsLoading
  const error = workersError || salonsError

  const rankedTechnicians = useMemo(
    () => sortTechnicians(workers, sortBy),
    [workers, sortBy]
  )

  const rankedSalons = useMemo(
    () => sortSalonsByRating(salonsWithDerivedRatings(salons, workers), sortBy),
    [salons, workers, sortBy]
  )

  const hasContent = rankedSalons.length > 0 || rankedTechnicians.length > 0

  if (!loading && !error && !hasContent) {
    return null
  }

  return (
    <section className="landing-technicians" aria-labelledby="landing-top-ratings-heading">
      <div className="landing-technicians-header text-center">
        <span className="landing-technicians-eyebrow">Top ratings</span>
        <h2 id="landing-top-ratings-heading" className="landing-technicians-title">
          Top ratings
        </h2>
        <p className="landing-technicians-sub">
          Top-rated salons and technicians — salon staff and freelancers ranked together by client
          ratings.
        </p>
      </div>

      {!loading && !error && hasContent && (
        <div className="landing-technicians-toolbar">
          <label htmlFor="landing-tech-sort" className="landing-technicians-sort-label">
            Sort by
          </label>
          <select
            id="landing-tech-sort"
            className="form-select site-select landing-technicians-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            aria-label="Sort top ratings"
          >
            {TECHNICIAN_SORT_OPTIONS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && <p className="landing-technicians-status text-center">Loading top ratings...</p>}
      {error && (
        <p className="landing-technicians-status landing-technicians-status--error text-center">{error}</p>
      )}

      {!loading && !error && hasContent && (
        <>
          {rankedSalons.length > 0 && (
            <div className="landing-technicians-section">
              <h3 className="landing-technicians-section-title">Top-rated salons</h3>
              <div className="landing-technicians-grid">
                {rankedSalons.map((salon) => (
                  <LandingSalonRatingCard key={`salon-${salon.id}`} salon={salon} />
                ))}
              </div>
            </div>
          )}

          {rankedTechnicians.length > 0 && (
            <div className="landing-technicians-section">
              <h3 className="landing-technicians-section-title">Top-rated technicians</h3>
              <div className="landing-technicians-grid">
                {rankedTechnicians.map((worker) => (
                  <LandingTechnicianCard key={worker.id} worker={worker} />
                ))}
              </div>
            </div>
          )}

          <p className="landing-technicians-more text-center">
            <Link to="/Services/discover" className="landing-technicians-more-link">
              Explore all salons &amp; technicians
            </Link>
          </p>
        </>
      )}
    </section>
  )
}

export default LandingTechniciansSection
