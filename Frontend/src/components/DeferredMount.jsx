import { useEffect, useState } from 'react'

const DeferredMount = ({ delay = 250, children, fallback = null }) => {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let idleId
    let timerId

    const show = () => setReady(true)

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(show, { timeout: Math.max(delay, 800) })
    } else {
      timerId = window.setTimeout(show, delay)
    }

    return () => {
      if (idleId != null && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId)
      }
      if (timerId != null) {
        window.clearTimeout(timerId)
      }
    }
  }, [delay])

  return ready ? children : fallback
}

export default DeferredMount
