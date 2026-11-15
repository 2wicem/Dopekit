const runtimeBase =
  typeof window !== 'undefined' && typeof window.__DOPEKIT_API_BASE__ === 'string'
    ? window.__DOPEKIT_API_BASE__.trim()
    : ''

const configured = (runtimeBase || import.meta.env.VITE_API_BASE || '/api').replace(
  /\/$/,
  ''
)

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

const DEFAULT_TIMEOUT_MS = 18000

const timeoutError = () => {
  const error = new Error('The request timed out. Try again on a stronger connection.')
  error.name = 'AbortError'
  return error
}

export const ensureCsrfCookie = async () => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)
  try {
    await fetch(apiUrl('/products/auth/csrf/'), {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw timeoutError()
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export const apiFetch = (path, options = {}) => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: outerSignal, ...fetchOptions } = options
  const method = (fetchOptions.method || 'GET').toUpperCase()
  const headers = new Headers(fetchOptions.headers || {})

  if (
    fetchOptions.body &&
    typeof fetchOptions.body === 'string' &&
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

  const controller = new AbortController()
  const timer =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null
  if (outerSignal) {
    if (outerSignal.aborted) {
      controller.abort()
    } else {
      outerSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  return fetch(apiUrl(path), {
    ...fetchOptions,
    method,
    headers,
    credentials: 'include',
    signal: controller.signal,
  })
    .catch((error) => {
      if (error?.name === 'AbortError') {
        if (outerSignal?.aborted) {
          throw error
        }
        throw timeoutError()
      }
      throw error
    })
    .finally(() => {
      if (timer) {
        clearTimeout(timer)
      }
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
      `${label} failed (the server sent a web page instead of data). Refresh, then try again. If it continues, wait for Railway to finish deploying the backend.`
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
