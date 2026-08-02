import { useEffect, useState } from 'react'
import { apiFetch } from '../config/api'

const WORKERS_PATH = '/products/workers/'

export const usePublicWorkers = () => {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadWorkers = async () => {
      try {
        const response = await apiFetch(WORKERS_PATH)
        const text = await response.text()
        const data = text ? JSON.parse(text) : {}

        if (!response.ok) {
          throw new Error(data.error || 'Could not load technicians.')
        }

        if (!cancelled) {
          setWorkers(data.workers || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setWorkers([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadWorkers()

    return () => {
      cancelled = true
    }
  }, [])

  return { workers, loading, error }
}
