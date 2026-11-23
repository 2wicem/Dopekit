import { useEffect, useState } from 'react'
import { loadPublicResource } from './publicResource'

const WORKERS_PATH = '/products/workers/'
const CACHE_KEY = 'dk:public_workers:v5'

export const usePublicWorkers = () => {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    loadPublicResource(CACHE_KEY, WORKERS_PATH, (data) => data.workers || [])
      .then((list) => {
        if (!cancelled) {
          setWorkers(list)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setWorkers([])
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

  return { workers, loading, error }
}
