import { useMemo } from 'react'
import { usePublicWorkers } from '../hooks/usePublicWorkers'
import TechnicianCard from './TechnicianCard'

const AvailableWorkers = () => {
  const { workers, loading, error } = usePublicWorkers()

  const salonTechnicians = useMemo(
    () => workers.filter((worker) => !worker.is_freelance),
    [workers]
  )
  const freelanceTechnicians = useMemo(
    () => workers.filter((worker) => worker.is_freelance),
    [workers]
  )

  const renderGrid = (items, className = '') =>
    items.length > 0 ? (
      <div className={`available-workers-grid${className ? ` ${className}` : ''}`}>
        {items.map((worker) => (
          <TechnicianCard key={worker.id} worker={worker} />
        ))}
      </div>
    ) : null

  return (
    <section
      id="technicians"
      className="available-workers"
      aria-labelledby="available-workers-heading"
    >
      <div className="available-workers-header text-center">
        <span className="available-workers-eyebrow">Our team</span>
        <h2 id="available-workers-heading" className="available-workers-title">
          Available technicians
        </h2>
        <p className="available-workers-sub">
          Book with salon staff or independent freelance technicians — review portfolios and ratings
          before you choose.
        </p>
      </div>

      {loading && <p className="available-workers-status text-center">Loading team...</p>}
      {error && (
        <p className="available-workers-status available-workers-status--error text-center">{error}</p>
      )}

      {!loading && !error && workers.length === 0 && (
        <p className="available-workers-status text-center">
          Technicians will appear here once staff schedules are set.
        </p>
      )}

      {!loading && !error && workers.length > 0 && (
        <>
          {salonTechnicians.length > 0 && (
            <div className="available-workers-section">
              <h3 className="available-workers-section-title">Salon technicians</h3>
              {renderGrid(salonTechnicians)}
            </div>
          )}

          {freelanceTechnicians.length > 0 && (
            <div className="available-workers-section">
              <h3 className="available-workers-section-title">Freelance technicians</h3>
              {renderGrid(freelanceTechnicians)}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default AvailableWorkers
