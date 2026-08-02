export const formatDistanceKm = (distanceKm) => {
  if (distanceKm == null || Number.isNaN(distanceKm)) {
    return null
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`
  }

  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`
}

export const toLatLng = (latitude, longitude) => {
  if (latitude == null || longitude == null) {
    return null
  }
  return [Number(latitude), Number(longitude)]
}
