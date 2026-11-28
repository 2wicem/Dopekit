/* eslint-disable react/prop-types */
import { Link } from 'react-router-dom'
import LazyBookservice from './LazyBookservice'
import TechnicianRating from './TechnicianRating'

const LandingSalonRatingCard = ({ salon }) => (
  <article className="landing-tech-card landing-salon-rating-card">
    <div className="landing-tech-card__media landing-salon-rating-card__media">
      <div className="landing-tech-card__placeholder" aria-hidden="true">
        <span>
          <i className="fa-solid fa-store" />
        </span>
        <p>Salon</p>
      </div>
      {salon.is_primary && (
        <span className="landing-tech-card__badge is-open">Featured</span>
      )}
    </div>

    <div className="landing-tech-card__body">
      <h3 className="landing-tech-card__name">{salon.name}</h3>
      <p className="landing-tech-card__role">Salon branch</p>
      <p className="landing-tech-card__salon">
        <i className="fa-solid fa-location-dot" aria-hidden="true" /> {salon.location}
      </p>

      <TechnicianRating
        ratingAverage={salon.rating_average}
        ratingCount={salon.rating_count}
        completedJobs={salon.completed_jobs}
        compact
      />
      {salon.rating_source === 'google' && (
        <p className="landing-salon-rating-card__source">Google reviews</p>
      )}

      <div className="landing-tech-card__actions">
        <Link to={`/salons/${salon.slug}`} className="btn btn-sm btn-outline-light landing-salon-rating-card__open">
          Open salon
        </Link>
        <LazyBookservice variant="card" salonId={salon.id} label={`Book at ${salon.name}`} />
      </div>
    </div>
  </article>
)

export default LandingSalonRatingCard
