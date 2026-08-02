import { useCallback, useState } from 'react'

const STORAGE_KEY = 'dopekit_client_coords'

const readStoredCoords = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)
    if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

const persistCoords = (coords) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(coords))
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

const getGeolocationErrorMessage = (error) => {
  if (!error) {
    return 'Could not read your location.'
  }

  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location access was blocked. Allow location in your browser settings, then try again.'
    case error.POSITION_UNAVAILABLE:
      return 'Your device could not determine a position. Check GPS/Wi‑Fi and try again.'
    case error.TIMEOUT:
      return 'Location timed out. Move to an open area or tap the map to drop your pin.'
    default:
      return 'Could not access your location.'
  }
}

export const useGeolocation = ({ restoreOnMount = true } = {}) => {
  const [coords, setCoords] = useState(() => (restoreOnMount ? readStoredCoords() : null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const applyCoords = useCallback((latitude, longitude, { accuracy = null, manual = false } = {}) => {
    const next = {
      latitude,
      longitude,
      accuracy,
      manual,
      updatedAt: Date.now(),
    }

    setCoords(next)
    persistCoords(next)
    setError(null)
    setLoading(false)
  }, [])

  const setManualLocation = useCallback(
    (latitude, longitude) => {
      applyCoords(latitude, longitude, { manual: true })
    },
    [applyCoords]
  )

  const clearLocation = useCallback(() => {
    setCoords(null)
    setError(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Location is not supported on this device.')
      return
    }

    if (!window.isSecureContext) {
      setError(
        'Location requires a secure page (HTTPS or localhost). Tap the map to drop your pin instead.'
      )
      return
    }

    setLoading(true)
    setError(null)

    const handleSuccess = (position) => {
      applyCoords(position.coords.latitude, position.coords.longitude, {
        accuracy: position.coords.accuracy,
        manual: false,
      })
    }

    const handleError = (geoError, triedHighAccuracy) => {
      if (triedHighAccuracy && geoError.code === geoError.TIMEOUT) {
        navigator.geolocation.getCurrentPosition(handleSuccess, (retryError) => {
          setError(getGeolocationErrorMessage(retryError))
          setLoading(false)
        }, {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 120000,
        })
        return
      }

      setError(getGeolocationErrorMessage(geoError))
      setLoading(false)
    }

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (geoError) => handleError(geoError, true),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    )
  }, [applyCoords])

  return {
    coords,
    loading,
    error,
    locate,
    setManualLocation,
    clearLocation,
    isLocated: Boolean(coords),
  }
}
