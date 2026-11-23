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

let csrfTokenMemory = ''

const cookieCsrfToken = () => {
  if (typeof document === 'undefined') {
    return ''
  }
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

const readCsrfToken = () => csrfTokenMemory || cookieCsrfToken()

const DEFAULT_TIMEOUT_MS = 10000
const GET_RETRY_COUNT = 1

const timeoutError = () => {
  const error = new Error('The request timed out. Try again on a stronger connection.')
  error.name = 'AbortError'
  return error
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const ensureCsrfCookie = async () => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(apiUrl('/products/auth/csrf/'), {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
    })
    const text = await response.text()
    const data = text ? JSON.parse(text) : {}
    if (data.csrfToken) {
      csrfTokenMemory = data.csrfToken
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw timeoutError()
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export const apiFetch = async (path, options = {}) => {
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

  const mutating = !['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)
  if (mutating) {
    try {
      await ensureCsrfCookie()
    } catch {
      /* still send whatever token we already have */
    }
  }
  if (mutating) {
    const csrfToken = readCsrfToken()
    if (csrfToken) {
      headers.set('X-CSRFToken', csrfToken)
    }
  }

  const send = async () => {
    const inner = new AbortController()
    const innerTimer =
      timeoutMs > 0 ? setTimeout(() => inner.abort(), timeoutMs) : null
    if (outerSignal) {
      if (outerSignal.aborted) {
        inner.abort()
      } else {
        outerSignal.addEventListener('abort', () => inner.abort(), { once: true })
      }
    }
    try {
      return await fetch(apiUrl(path), {
        ...fetchOptions,
        method,
        headers,
        credentials: 'include',
        signal: inner.signal,
      })
    } finally {
      if (innerTimer) {
        clearTimeout(innerTimer)
      }
    }
  }

  const retries = mutating ? 0 : GET_RETRY_COUNT
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await send()
    } catch (error) {
      lastError = error
      const timedOut = error?.name === 'AbortError'
      if (outerSignal?.aborted) {
        throw error
      }
      if (attempt >= retries) {
        throw timedOut ? timeoutError() : error
      }
      await wait(250 * (attempt + 1))
    }
  }
  throw lastError || timeoutError()
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
