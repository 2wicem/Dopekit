import { useEffect, useState } from 'react'
import { isNativeApp } from '../nativeShell'
import './css/WorkerApp.css'

const InstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const nativeApp = isNativeApp()

  useEffect(() => {
    if (nativeApp) {
      return undefined
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true

    setIsStandalone(standalone)

    const handleBeforeInstall = (event) => {
      event.preventDefault()
      setPromptEvent(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [nativeApp])

  if (nativeApp || isStandalone || dismissed || !promptEvent) {
    return null
  }

  const handleInstall = async () => {
    promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
    setDismissed(true)
  }

  return (
    <div className="worker-install-banner">
      <div>
        <strong>Install Dopekit Staff</strong>
        <p>Add to your home screen for quick access to your schedule.</p>
      </div>
      <div className="worker-install-actions">
        <button type="button" className="btn btn-sm btn-primary" onClick={handleInstall}>
          Install
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDismissed(true)}>
          Not now
        </button>
      </div>
    </div>
  )
}

export default InstallPrompt
