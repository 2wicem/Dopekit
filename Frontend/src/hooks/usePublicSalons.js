import { useEffect, useState } from 'react'
import { loadPublicResource } from './publicResource'

const SALONS_PATH = '/products/salons/'
const CACHE_KEY = 'dk:public_salons:v1'

export const usePublicSalons = () => {
  const [salons, setSalons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    loadPublicResource(CACHE_KEY, SALONS_PATH, (data) => data.salons || [])
      .then((list) => {
        if (!cancelled) {
          setSalons(list)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setSalons([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { salons, loading, error }
}
