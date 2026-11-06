import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './css/SuccessPopup.css'

const SuccessPopup = ({ title, message, onClose, embedded = false }) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const dialog = (
    <div
      className={`success-popup${embedded ? ' success-popup--embedded' : ''}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="success-popup-title"
      aria-describedby={message ? 'success-popup-message' : undefined}
    >
      <div className="success-popup__dialog">
        <i className="fa-solid fa-circle-check success-popup__icon" aria-hidden="true" />
        <h3 className="success-popup__title" id="success-popup-title">
          {title}
        </h3>
        {message ? (
          <p className="success-popup__message" id="success-popup-message">
            {message}
          </p>
        ) : null}
        <button type="button" className="btn btn-primary success-popup__ok" onClick={onClose} autoFocus>
          OK
        </button>
      </div>
    </div>
  )

  if (embedded) {
    return dialog
  }

  return createPortal(dialog, document.body)
}

export default SuccessPopup
