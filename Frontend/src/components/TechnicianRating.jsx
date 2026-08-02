import { formatTechnicianRating, renderStarStates } from '../utils/technicianRating'

const TechnicianRating = ({ ratingAverage, ratingCount, completedJobs = 0, compact = false }) => {
  const rating = formatTechnicianRating(ratingAverage, ratingCount)
  const stars = renderStarStates(rating.average)

  return (
    <div className={`technician-rating${compact ? ' technician-rating--compact' : ''}`}>
      <div className="technician-rating-stars" aria-hidden="true">
        {stars.map((state, index) => (
          <i
            key={index}
            className={
              state === 'full'
                ? 'fa-solid fa-star'
                : state === 'half'
                  ? 'fa-solid fa-star-half-stroke'
                  : 'fa-regular fa-star'
            }
          />
        ))}
      </div>
      <p className="technician-rating-label">{rating.label}</p>
      {!rating.hasRating && completedJobs > 0 && (
        <p className="technician-rating-meta">
          {completedJobs} completed booking{completedJobs === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}

export default TechnicianRating
