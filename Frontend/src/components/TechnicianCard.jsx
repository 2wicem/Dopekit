import Bookservice from './Bookservice'
import TechnicianRating from './TechnicianRating'
import TechnicianScheduleButton from './TechnicianScheduleButton'

const formatNextSlot = (nextSlot) => {
  if (!nextSlot) {
    return 'No open slots yet'
  }

  const date = new Date(`${nextSlot.date}T12:00:00`)
  const day = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return `${day} · ${nextSlot.label}`
}

export const workerInitials = (name) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

const TechnicianCard = ({ worker, salonId = null, bookLabel }) => {
  const label = bookLabel || `Book with ${worker.name}`

  return (
    <article className={`available-worker-card${worker.is_available ? ' is-available' : ''}`}>
      <div className="available-worker-card__top">
        <span className="available-worker-avatar" aria-hidden="true">
          {workerInitials(worker.name)}
        </span>
        <div className="available-worker-card__meta">
          <h3 className="available-worker-name">{worker.name}</h3>
          <p className="available-worker-role">{worker.role_label}</p>
          {worker.salon_name && !worker.is_freelance && (
            <p className="available-worker-salon">{worker.salon_name}</p>
          )}
          {worker.specialty_label && (
            <p className="available-worker-specialty">{worker.specialty_label}</p>
          )}
        </div>
        <span className={`available-worker-badge${worker.is_available ? ' is-open' : ''}`}>
          {worker.is_available ? 'Available' : 'Fully booked'}
        </span>
      </div>

      <TechnicianRating
        ratingAverage={worker.rating_average}
        ratingCount={worker.rating_count}
        completedJobs={worker.completed_jobs}
        compact
      />

      {worker.work_summary && <p className="available-worker-work">{worker.work_summary}</p>}

      {worker.portfolio_urls?.length > 0 ? (
        <div className="available-worker-portfolio">
          <p className="available-worker-portfolio-label">Portfolio — tap to view their work</p>
          <div className="available-worker-portfolio-grid">
            {worker.portfolio_urls.slice(0, 3).map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`${worker.name} portfolio`} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="available-worker-portfolio-empty">Portfolio coming soon</p>
      )}

      <p className="available-worker-slots">
        {worker.is_available
          ? `${worker.available_slots} open slot${worker.available_slots === 1 ? '' : 's'} (next 2 weeks)`
          : 'Check back soon for new openings'}
      </p>
      <p className="available-worker-next">
        <i className="fa-regular fa-clock" aria-hidden="true" />
        {formatNextSlot(worker.next_slot)}
      </p>

      <div className="available-worker-card__actions">
        <TechnicianScheduleButton worker={worker} salonId={salonId ?? worker.salon_id} />
        <Bookservice
          variant="card"
          workerId={worker.id}
          workerName={worker.name}
          salonId={salonId ?? worker.salon_id}
          label={label}
        />
      </div>
    </article>
  )
}

export default TechnicianCard
