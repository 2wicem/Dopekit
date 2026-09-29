import { Link } from 'react-router-dom'
import { useContactInfo } from '../hooks/useContactInfo'
import './css/About.css'

const highlights = [
  {
    id: 'quality',
    icon: 'fa-solid fa-gem',
    title: 'Top-notch services',
    text: 'Premium gels, builders, tips and acrylics using trusted brands — finished with care for event-ready nails every time.',
  },
  {
    id: 'reliability',
    icon: 'fa-solid fa-shield-heart',
    title: 'Reliability',
    text: 'Confirmed 2-hour slots, skilled staff, and clear booking updates so you always know when and where your appointment is.',
  },
  {
    id: 'convenience',
    icon: 'fa-solid fa-mobile-screen-button',
    title: 'Convenience',
    text: 'Book online in minutes, pick your time slot, and manage appointments from your phone — no back-and-forth needed.',
  },
]

const AboutPage = () => {
  const { contactInfo, hasContactDetails } = useContactInfo()

  return (
    <section className="section-band section-band--alt about-page">
      <div className="container page-section about-section">
        <header className="about-header text-center">
          <span className="about-eyebrow">Why Dopekit</span>
          <h1 className="about-title">About us</h1>
          <p className="about-lead">
            Dopekit is your go-to nail studio in Kenya — where stunning designs meet a smooth,
            stress-free booking experience from start to finish.
          </p>
        </header>

        <div className="row g-3 g-md-4 about-highlights">
          {highlights.map(({ id, icon, title, text }) => (
            <div key={id} className="col-md-4">
              <article className="about-highlight-card h-100">
                <span className="about-highlight-icon" aria-hidden="true">
                  <i className={icon} />
                </span>
                <h2 className="about-highlight-title">{title}</h2>
                <p className="about-highlight-text">{text}</p>
              </article>
            </div>
          ))}
        </div>

        <div className="about-story">
          <h2 className="about-story-title">Our promise</h2>
          <p>
            Whether you want a quick gel refresh or a full set with custom art, we focus on three
            things: <strong>quality work</strong>, <strong>showing up when we say we will</strong>,
            and making it <strong>easy for you to book and rebook</strong>. That is the Dopekit
            standard — polished nails without the hassle.
          </p>
          <div className="about-actions">
            <Link to="/Services" className="btn btn-primary">
              View services
            </Link>
            <Link to="/Contact" className="btn btn-outline-secondary">
              Get in touch
            </Link>
          </div>
        </div>

        <div className="about-contact">
          <h2 className="about-contact-title">Contact us</h2>
          {hasContactDetails ? (
            <ul className="about-contact-list">
              {contactInfo.email && (
                <li>
                  <i className="fa-solid fa-envelope" aria-hidden="true" />
                  <span>
                    <strong>Email</strong>
                    <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a>
                  </span>
                </li>
              )}
              {contactInfo.phones.length > 0 && (
                <li>
                  <i className="fa-solid fa-phone" aria-hidden="true" />
                  <span>
                    <strong>Phone</strong>
                    {contactInfo.phones.map((phone, index) => (
                      <span key={phone}>
                        {index > 0 && <span className="about-contact-sep"> / </span>}
                        <a href={`tel:${phone}`}>{phone}</a>
                      </span>
                    ))}
                  </span>
                </li>
              )}
            </ul>
          ) : (
            <p className="about-contact-empty text-muted mb-0">
              Contact details will appear here once configured.{' '}
              <Link to="/Contact">Send us a message</Link>.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default AboutPage
