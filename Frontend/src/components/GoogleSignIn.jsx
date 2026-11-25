import { useEffect, useRef } from 'react'

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const SCRIPT_ATTR = 'data-google-gsi'

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[${SCRIPT_ATTR}]`)
    if (existing && window.google?.accounts?.id) {
      resolve()
      return
    }
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.setAttribute(SCRIPT_ATTR, 'true')
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(script)
  })

const GoogleSignIn = ({ clientId, onCredential, disabled = false }) => {
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!clientId || disabled) {
      return undefined
    }

    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !buttonRef.current || !window.google?.accounts?.id) {
          return
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response?.credential) {
              onCredential(response.credential)
            }
          },
          ux_mode: 'popup',
          auto_select: false,
        })

        buttonRef.current.replaceChildren()
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: Math.max(240, Math.min(buttonRef.current.offsetWidth || 320, 400)),
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [clientId, disabled, onCredential])

  if (!clientId) {
    return null
  }

  return <div className="google-signin" ref={buttonRef} />
}

export default GoogleSignIn
