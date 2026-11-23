import { apiFetch } from '../config/api'

const memory = new Map()
const inflight = new Map()
const DEFAULT_TTL_MS = 120000

const readSession = (key) => {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.t !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

const writeSession = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d: data }))
  } catch {
    /* private mode / quota */
  }
}

export const loadPublicResource = async (key, path, pick, ttlMs = DEFAULT_TTL_MS) => {
  const now = Date.now()
  const cached = memory.get(key)
  if (cached && now - cached.t < ttlMs) {
    return cached.d
  }

  const stored = readSession(key)
  if (stored && now - stored.t < ttlMs) {
    memory.set(key, stored)
    return stored.d
  }

  if (!inflight.has(key)) {
    inflight.set(
      key,
      apiFetch(path)
        .then(async (response) => {
          const text = await response.text()
          const data = text ? JSON.parse(text) : {}
          if (!response.ok) {
            throw new Error(data.error || 'Could not load data.')
          }
          const value = pick(data)
          const entry = { t: Date.now(), d: value }
          memory.set(key, entry)
          writeSession(key, value)
          return value
        })
        .finally(() => {
          inflight.delete(key)
        }),
    )
  }

  return inflight.get(key)
}
