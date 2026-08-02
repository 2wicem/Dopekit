export const TECHNICIAN_SORT_OPTIONS = [
  { id: 'top-rated', label: 'Top rated' },
  { id: 'most-booked', label: 'Most booked' },
]

export const sortTechnicians = (workers, sortBy = 'top-rated') => {
  const list = [...workers]

  if (sortBy === 'most-booked') {
    return list.sort((left, right) => {
      const jobsDiff = (right.completed_jobs || 0) - (left.completed_jobs || 0)
      if (jobsDiff !== 0) {
        return jobsDiff
      }

      const ratingDiff = (right.rating_average || 0) - (left.rating_average || 0)
      if (ratingDiff !== 0) {
        return ratingDiff
      }

      return left.name.localeCompare(right.name)
    })
  }

  return list.sort((left, right) => {
    const leftRated = (left.rating_count || 0) > 0 && left.rating_average != null
    const rightRated = (right.rating_count || 0) > 0 && right.rating_average != null

    if (leftRated !== rightRated) {
      return leftRated ? -1 : 1
    }

    const ratingDiff = (right.rating_average || 0) - (left.rating_average || 0)
    if (ratingDiff !== 0) {
      return ratingDiff
    }

    const countDiff = (right.rating_count || 0) - (left.rating_count || 0)
    if (countDiff !== 0) {
      return countDiff
    }

    const jobsDiff = (right.completed_jobs || 0) - (left.completed_jobs || 0)
    if (jobsDiff !== 0) {
      return jobsDiff
    }

    return left.name.localeCompare(right.name)
  })
}
