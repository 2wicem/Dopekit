import { useCallback, useEffect, useState } from 'react'
import { apiFetch, parseApiResponse } from '../config/api'
import ServiceCatalogEditor from './ServiceCatalogEditor'

const SERVICES_PATH = '/products/technician/services/'

const TechnicianServices = ({ onStatus, onChanged, onServicesChange }) => {
  const [services, setServices] = useState([])

  const loadServices = useCallback(async () => {
    const response = await apiFetch(SERVICES_PATH)
    const data = await parseApiResponse(response, 'Technician services')
    const next = data.services || []
    setServices(next)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    loadServices()
      .then((next) => {
        if (!cancelled) {
          onServicesChange?.(next)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setServices([])
          onServicesChange?.([])
        }
      })
    return () => {
      cancelled = true
    }
    // Load once on mount; parent callbacks stay current via handleChanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadServices])

  const handleChanged = async () => {
    const next = await loadServices()
    onServicesChange?.(next)
    await onChanged?.()
  }

  return (
    <ServiceCatalogEditor
      title="My technician services"
      lead="Treatments you personally offer. Pick these when you log your own completed work."
      services={services}
      createPath={SERVICES_PATH}
      deletePath={(service) => `/products/technician/services/${service.id}/`}
      onChanged={handleChanged}
      onStatus={onStatus}
      idPrefix="technician-service"
      emptyText="No personal services yet. Add what you offer above."
    />
  )
}

export default TechnicianServices
