const configured = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

// Bundled hybrid builds must set VITE_API_BASE to the public API origin.
// Live-wrap (CAPACITOR_SERVER_URL) keeps using the hosted site's /api proxy.

export const API_BASE = configured

export const apiUrl = (path) => {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE}${suffix}`
}

const readCsrfToken = () => {
  if (typeof document === 'undefined') {
    return ''
  }

  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export const ensureCsrfCookie = async () => {
  await fetch(apiUrl('/products/auth/csrf/'), {
    method: 'GET',
    credentials: 'include',
  })
}

export const apiFetch = (path, options = {}) => {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers || {})

  if (
    options.body &&
    typeof options.body === 'string' &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const csrfToken = readCsrfToken()
    if (csrfToken) {
      headers.set('X-CSRFToken', csrfToken)
    }
  }

  return fetch(apiUrl(path), {
    ...options,
    method,
    headers,
    credentials: 'include',
  })
}

export const parseApiResponse = async (response, label = 'Request') => {
  const text = await response.text()
  const contentType = response.headers.get('content-type') || ''
  const trimmed = text.trimStart()

  if (
    !contentType.includes('application/json') &&
    (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html'))
  ) {
    throw new Error(
      `${label} returned HTML instead of JSON. Start or restart the Django backend on port 8000, then refresh this page.`
    )
  }

  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`${label} returned an invalid response. Check that the backend is running.`)
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `${label} failed.`)
  }

  return data
}
