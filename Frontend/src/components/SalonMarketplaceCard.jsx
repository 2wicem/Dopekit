import { Link } from 'react-router-dom'
import Bookservice from './Bookservice'

const salonSocialLinks = (salon) =>
  [
    { id: 'instagram', icon: 'fa-brands fa-instagram', url: salon.instagram_url, label: 'Instagram' },
    { id: 'facebook', icon: 'fa-brands fa-facebook', url: salon.facebook_url, label: 'Facebook' },
    { id: 'tiktok', icon: 'fa-brands fa-tiktok', url: salon.tiktok_url, label: 'TikTok' },
    { id: 'whatsapp', icon: 'fa-brands fa-whatsapp', url: salon.whatsapp_url, label: 'WhatsApp' },
  ].filter((entry) => entry.url)

const SalonMarketplaceCard = ({ salon }) => {
  const socials = salonSocialLinks(salon)

  return (
    <article className="available-salon-card">
      <div className="available-salon-card__top">
        <span className="available-salon-icon" aria-hidden="true">
          <i className="fa-solid fa-store" />
        </span>
        <div className="available-salon-card__meta">
          <h3 className="available-salon-name">
            {salon.name}
            {salon.is_primary && <span className="available-salon-badge">Popular</span>}
          </h3>
          <p className="available-salon-location">
            <i className="fa-solid fa-location-dot" aria-hidden="true" />
            {salon.location}
          </p>
        </div>
      </div>

      {salon.services_summary && <p className="available-salon-services">{salon.services_summary}</p>}

      <div className="available-salon-contact">
        <a href={`tel:${salon.phone_primary}`}>{salon.phone_primary}</a>
        {salon.email && (
          <>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${salon.email}`}>{salon.email}</a>
          </>
        )}
      </div>

      {socials.length > 0 && (
        <div className="available-salon-socials">
          {socials.map((entry) => (
            <a
              key={entry.id}
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${salon.name} on ${entry.label}`}
            >
              <i className={entry.icon} aria-hidden="true" />
            </a>
          ))}
        </div>
      )}

      <div className="available-salon-actions">
        <Link to={`/salons/${salon.slug}`} className="btn btn-sm btn-outline-primary">
          Open salon
        </Link>
        <Bookservice variant="card" salonId={salon.id} label="Book now" />
      </div>
    </article>
  )
}

export default SalonMarketplaceCard
