export const TECHNICIAN_SORT_OPTIONS = [
  { id: 'top-rated', label: 'Top rated' },
  { id: 'most-booked', label: 'Most booked' },
]

export const partitionTechniciansByType = (workers) => ({
  salonTechnicians: workers.filter((worker) => !worker.is_freelance),
  freelanceTechnicians: workers.filter((worker) => worker.is_freelance),
})

const compareByTopRated = (left, right) => {
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
}

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

  return list.sort(compareByTopRated)
}

/** Prefer Google Places ratings; fall back to staff technician ratings when Google is missing. */
export const salonsWithDerivedRatings = (salons, workers) => {
  const bySalonId = new Map()

  for (const worker of workers) {
    if (!worker.salon_id || worker.is_freelance) {
      continue
    }
    if (!(worker.rating_count > 0) || worker.rating_average == null) {
      continue
    }

    const current = bySalonId.get(worker.salon_id) || { weightSum: 0, countSum: 0, jobsSum: 0 }
    current.weightSum += Number(worker.rating_average) * worker.rating_count
    current.countSum += worker.rating_count
    current.jobsSum += worker.completed_jobs || 0
    bySalonId.set(worker.salon_id, current)
  }

  return salons.map((salon) => {
    const hasGoogleRating =
      salon.rating_source === 'google' &&
      (salon.rating_count || 0) > 0 &&
      salon.rating_average != null

    if (hasGoogleRating) {
      return {
        ...salon,
        rating_average: Number(salon.rating_average),
        rating_count: salon.rating_count || 0,
        rating_source: 'google',
        completed_jobs: salon.completed_jobs || 0,
      }
    }

    const aggregate = bySalonId.get(salon.id)
    if (!aggregate || aggregate.countSum === 0) {
      return {
        ...salon,
        rating_average: null,
        rating_count: 0,
        rating_source: null,
        completed_jobs: 0,
      }
    }

    return {
      ...salon,
      rating_average: aggregate.weightSum / aggregate.countSum,
      rating_count: aggregate.countSum,
      rating_source: 'technicians',
      completed_jobs: aggregate.jobsSum,
    }
  })
}

export const sortSalonsByRating = (salons, sortBy = 'top-rated') => {
  if (sortBy === 'most-booked') {
    return [...salons].sort((left, right) => {
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

  return [...salons].sort(compareByTopRated)
}
