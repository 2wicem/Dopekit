import { useEffect } from 'react'

const DEFAULT_TITLE = 'Dopekit | Nail salon & manicure booking in Kikuyu, Kenya'
const DEFAULT_DESCRIPTION =
  'Book manicure, pedicure, gel, tips and acrylics in Kikuyu Town or at your location. Dopekit nail salon and freelance technicians in Kenya.'

export const usePageSeo = ({ title, description } = {}) => {
  useEffect(() => {
    const nextTitle = title || DEFAULT_TITLE
    const nextDescription = description || DEFAULT_DESCRIPTION
    document.title = nextTitle

    const meta = document.querySelector('meta[name="description"]')
    if (meta) {
      meta.setAttribute('content', nextDescription)
    }

    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle) {
      ogTitle.setAttribute('content', nextTitle)
    }

    const ogDescription = document.querySelector('meta[property="og:description"]')
    if (ogDescription) {
      ogDescription.setAttribute('content', nextDescription)
    }
  }, [title, description])
}
