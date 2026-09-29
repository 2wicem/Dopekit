import { Link } from 'react-router-dom'
import BrandLogo from './BrandLogo'
import { socialLinks } from '../constants/socialLinks'
import { useContactInfo } from '../hooks/useContactInfo'
import './css/Footer.css'

const formatPhoneDisplay = (phone) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return phone
}

const phoneTelHref = (phone) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('254')) {
    return `tel:+${digits}`
  }
  if (digits.startsWith('0')) {
    return `tel:+254${digits.slice(1)}`
  }
  return `tel:${phone}`
}

const Footer = () => {
  const { contactInfo, hasContactDetails } = useContactInfo()

  return (
    <footer className="site-footer">
      <div className="site-footer__main">
        <div className="container site-footer__container">
          <div className="site-footer__grid">
            <div className="site-footer__col site-footer__brand">
              <Link className="site-footer__logo-link" to="/">
                <BrandLogo size="md" />
              </Link>
              <p className="site-footer__tagline">Fashion oriented and curious about results</p>
              {socialLinks.length > 0 && (
                <div className="site-footer__social" aria-label="Social links">
                  {socialLinks.map(({ id, label, icon, url }) => (
                    <a
                      key={id}
                      href={url}
                      className="site-footer__social-link"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Dopekit on ${label}`}
                    >
                      <i className={icon} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="site-footer__col site-footer__links">
              <h2 className="site-footer__heading">Quick Links</h2>
              <ul className="site-footer__link-list">
                <li>
                  <Link className="site-footer__link" to="/Services">
                    Services
                  </Link>
                </li>
                <li>
                  <Link className="site-footer__link" to="/About">
                    About us
                  </Link>
                </li>
                <li>
                  <Link className="site-footer__link" to="/Contact">
                    Contact us
                  </Link>
                </li>
                <li>
                  <Link className="site-footer__link" to="/signup">
                    Sign up
                  </Link>
                </li>
                <li>
                  <Link className="site-footer__link" to="/login">
                    Log in
                  </Link>
                </li>
              </ul>
            </div>

            <div className="site-footer__col site-footer__contact">
              <h2 className="site-footer__heading">Get in touch</h2>
              <ul className="site-footer__contact-list">
                {hasContactDetails ? (
                  <>
                    {contactInfo.phones.length > 0 && (
                      <li>
                        <i className="fa-solid fa-phone-volume" aria-hidden="true" />
                        <span>
                          {contactInfo.phones.map((phone, index) => (
                            <span key={phone}>
                              {index > 0 && <span className="site-footer__sep"> / </span>}
                              <a href={phoneTelHref(phone)}>{formatPhoneDisplay(phone)}</a>
                            </span>
                          ))}
                        </span>
                      </li>
                    )}
                    {contactInfo.email && (
                      <li>
                        <i className="fa-solid fa-envelope" aria-hidden="true" />
                        <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a>
                      </li>
                    )}
                    {contactInfo.location && (
                      <li>
                        <i className="fa-solid fa-location-crosshairs" aria-hidden="true" />
                        <span>{contactInfo.location}</span>
                      </li>
                    )}
                  </>
                ) : (
                  <li>
                    <i className="fa-solid fa-envelope" aria-hidden="true" />
                    <Link className="site-footer__link" to="/Contact">
                      Contact us
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="site-footer__bar">
        <p>&copy; Dopekit</p>
      </div>
    </footer>
  )
}

export default Footer
