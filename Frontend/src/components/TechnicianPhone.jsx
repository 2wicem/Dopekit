import './css/TechnicianPhone.css'

const telHref = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) {
    return null
  }
  if (digits.startsWith('254')) {
    return `tel:+${digits}`
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return `tel:+254${digits.slice(1)}`
  }
  if (digits.length === 9) {
    return `tel:+254${digits}`
  }
  return `tel:${digits}`
}

const TechnicianPhone = ({ phone, className = '' }) => {
  const display = String(phone || '').trim()
  if (!display) {
    return null
  }

  const href = telHref(display)

  return (
    <p className={className}>
      {href ? (
        <a href={href} className="technician-phone-link">
          {display}
        </a>
      ) : (
        display
      )}
    </p>
  )
}

export default TechnicianPhone
