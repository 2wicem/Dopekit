import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'dopekit_admin_salon_id'

export const useAdminSalon = (salons = []) => {
  const [salonId, setSalonIdState] = useState(() => sessionStorage.getItem(STORAGE_KEY) || 'all')

  useEffect(() => {
    if (salonId !== 'all' && salons.length > 0 && !salons.some((salon) => String(salon.id) === String(salonId))) {
      const primary = salons.find((salon) => salon.is_primary) || salons[0]
      const next = primary ? String(primary.id) : 'all'
      setSalonIdState(next)
      sessionStorage.setItem(STORAGE_KEY, next)
    }
  }, [salons, salonId])

  const setSalonId = useCallback((value) => {
    setSalonIdState(value)
    sessionStorage.setItem(STORAGE_KEY, value)
  }, [])

  const salonQuery = useMemo(() => {
    if (!salonId || salonId === 'all') {
      return ''
    }
    return `salon_id=${encodeURIComponent(salonId)}`
  }, [salonId])

  const withSalonQuery = useCallback(
    (path) => {
      if (!salonQuery) {
        return path
      }
      const joiner = path.includes('?') ? '&' : '?'
      return `${path}${joiner}${salonQuery}`
    },
    [salonQuery]
  )

  const activeSalon = useMemo(
    () => salons.find((salon) => String(salon.id) === String(salonId)) || null,
    [salons, salonId]
  )

  return {
    salonId,
    setSalonId,
    salonQuery,
    withSalonQuery,
    activeSalon,
  }
}
