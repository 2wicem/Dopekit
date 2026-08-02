import { useEffect, useState } from 'react'
import { apiFetch } from '../config/api'

const SALONS_PATH = '/products/salons/'

export const usePublicSalons = () => {
  const [salons, setSalons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadSalons = async () => {
      try {
        const response = await apiFetch(SALONS_PATH)
        const text = await response.text()
        const data = text ? JSON.parse(text) : {}

        if (!response.ok) {
          throw new Error(data.error || 'Could not load salon locations.')
        }

        if (!cancelled) {
          setSalons(data.salons || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setSalons([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSalons()

    return () => {
      cancelled = true
    }
  }, [])

  return { salons, loading, error }
}
