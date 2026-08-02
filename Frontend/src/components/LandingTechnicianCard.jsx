import Bookservice from './Bookservice'
import TechnicianRating from './TechnicianRating'
import TechnicianScheduleButton from './TechnicianScheduleButton'
import { workerInitials } from './TechnicianCard'

const latestWorkUrl = (worker) => {
  const urls = worker.portfolio_urls
  if (!urls?.length) {
    return null
  }
  return urls[urls.length - 1]
}

const LandingTechnicianCard = ({ worker }) => {
  const workPhoto = latestWorkUrl(worker)

  return (
    <article className={`landing-tech-card${worker.is_available ? ' is-available' : ''}`}>
      <div className="landing-tech-card__media">
        {workPhoto ? (
          <img src={workPhoto} alt={`${worker.name} latest nail work`} loading="lazy" />
        ) : (
          <div className="landing-tech-card__placeholder" aria-hidden="true">
            <span>{workerInitials(worker.name)}</span>
            <p>Portfolio coming soon</p>
          </div>
        )}
        <span className={`landing-tech-card__badge${worker.is_available ? ' is-open' : ''}`}>
          {worker.is_available ? 'Available' : 'Fully booked'}
        </span>
      </div>

      <div className="landing-tech-card__body">
        <h3 className="landing-tech-card__name">{worker.name}</h3>
        <p className="landing-tech-card__role">{worker.role_label}</p>
        {worker.salon_name && !worker.is_freelance && (
          <p className="landing-tech-card__salon">{worker.salon_name}</p>
        )}

        <TechnicianRating
          ratingAverage={worker.rating_average}
          ratingCount={worker.rating_count}
          completedJobs={worker.completed_jobs}
          compact
        />

        <div className="landing-tech-card__actions">
          <TechnicianScheduleButton worker={worker} salonId={worker.salon_id} />
          <Bookservice
            variant="card"
            workerId={worker.id}
            workerName={worker.name}
            salonId={worker.salon_id}
            label={`Book with ${worker.name}`}
          />
        </div>
      </div>
    </article>
  )
}

export default LandingTechnicianCard
