export const formatTechnicianRating = (ratingAverage, ratingCount) => {
  if (ratingCount > 0 && ratingAverage != null) {
    return {
      hasRating: true,
      average: Number(ratingAverage),
      count: ratingCount,
      label: `${Number(ratingAverage).toFixed(1)} out of 5 (${ratingCount} rating${ratingCount === 1 ? '' : 's'})`,
    }
  }

  return {
    hasRating: false,
    average: null,
    count: 0,
    label: 'New — no ratings yet',
  }
}

export const renderStarStates = (average, maxStars = 5) => {
  const safeAverage = Number.isFinite(average) ? average : 0
  return Array.from({ length: maxStars }, (_, index) => {
    const starValue = index + 1
    if (safeAverage >= starValue) {
      return 'full'
    }
    if (safeAverage >= starValue - 0.5) {
      return 'half'
    }
    return 'empty'
  })
}
