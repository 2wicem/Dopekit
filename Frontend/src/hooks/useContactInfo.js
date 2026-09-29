import { useEffect, useState } from 'react'
import { apiFetch } from '../config/api'

export const EMPTY_CONTACT_INFO = {
  phones: [],
  phone_primary: '',
  phone_secondary: '',
  email: '',
  location: '',
  services_summary: '',
  page_lead: 'Send us a message — salon contact details appear here once configured in admin.',
}

const normalizeContactInfo = (raw = {}) => {
  const phones =
    raw.phones?.filter(Boolean) ||
    [raw.phone_primary, raw.phone_secondary].filter(Boolean)

  return {
    ...EMPTY_CONTACT_INFO,
    ...raw,
    phones,
  }
}

export const useContactInfo = () => {
  const [contactInfo, setContactInfo] = useState(EMPTY_CONTACT_INFO)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadContactInfo = async () => {
      try {
        const response = await apiFetch('/products/contact/info/')
        const text = await response.text()
        const data = text ? JSON.parse(text) : {}

        if (!cancelled && response.ok && data.contact_info) {
          setContactInfo(normalizeContactInfo(data.contact_info))
        }
      } catch {
        if (!cancelled) {
          setContactInfo(EMPTY_CONTACT_INFO)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadContactInfo()

    return () => {
      cancelled = true
    }
  }, [])

  return { contactInfo, loading, hasContactDetails: Boolean(
    contactInfo.phones.length || contactInfo.email || contactInfo.location
  ) }
}
