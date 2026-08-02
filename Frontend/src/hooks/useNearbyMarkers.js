import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../config/api'

export const useNearbyMarkers = ({ latitude, longitude, type = 'all' }) => {
  const [markers, setMarkers] = useState([])
  const [defaultCenter, setDefaultCenter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const hasLoadedRef = useRef(false)

  const loadMarkers = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    setError(null)

    try {
      const params = new URLSearchParams({ type })
      if (latitude != null && longitude != null) {
        params.set('lat', String(latitude))
        params.set('lng', String(longitude))
      }

      const response = await apiFetch(`/products/map/nearby/?${params.toString()}`)
      const text = await response.text()
      const data = text ? JSON.parse(text) : {}

      if (!response.ok) {
        throw new Error(data.error || 'Could not load nearby locations.')
      }

      setMarkers(data.markers || [])
      setDefaultCenter(data.default_center || null)
      hasLoadedRef.current = true
    } catch (err) {
      setError(err.message)
      if (!hasLoadedRef.current) {
        setMarkers([])
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [latitude, longitude, type])

  useEffect(() => {
    loadMarkers()
  }, [loadMarkers])

  return {
    markers,
    defaultCenter,
    loading,
    refreshing,
    error,
    reload: loadMarkers,
  }
}
