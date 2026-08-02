import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import TechnicianCard from './TechnicianCard'
import Bookservice from './Bookservice'
import { apiFetch } from '../config/api'
import './css/SalonDetail.css'

const salonSocialLinks = (salon) =>
  [
    { id: 'instagram', icon: 'fa-brands fa-instagram', url: salon.instagram_url, label: 'Instagram' },
    { id: 'facebook', icon: 'fa-brands fa-facebook', url: salon.facebook_url, label: 'Facebook' },
    { id: 'tiktok', icon: 'fa-brands fa-tiktok', url: salon.tiktok_url, label: 'TikTok' },
    { id: 'whatsapp', icon: 'fa-brands fa-whatsapp', url: salon.whatsapp_url, label: 'WhatsApp' },
  ].filter((entry) => entry.url)

const SalonDetail = () => {
  const { slug } = useParams()
  const [salon, setSalon] = useState(null)
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const loadSalon = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await apiFetch(`/products/salons/${slug}/`)
        const text = await response.text()
        const data = text ? JSON.parse(text) : {}

        if (!response.ok) {
          throw new Error(data.error || 'Salon not found.')
        }

        if (!cancelled) {
          setSalon(data.salon || null)
          setTechnicians(data.technicians || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
          setSalon(null)
          setTechnicians([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadSalon()

    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <div className="salon-detail-page">
        <p className="salon-detail-status text-center">Loading salon...</p>
      </div>
    )
  }

  if (error || !salon) {
    return (
      <div className="salon-detail-page">
        <div className="salon-detail-empty text-center">
          <p>{error || 'Salon not found.'}</p>
          <Link to="/Services" className="btn btn-primary">
            Back to services
          </Link>
        </div>
      </div>
    )
  }

  const socials = salonSocialLinks(salon)

  return (
    <div className="salon-detail-page">
      <section className="section-band section-band--alt">
        <div className="salon-detail-hero container-fluid px-2 px-md-4">
          <Link to="/Services" className="salon-detail-back">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" /> All locations
          </Link>

          <div className="salon-detail-hero-card">
            <div className="salon-detail-hero-top">
              <span className="salon-detail-icon" aria-hidden="true">
                <i className="fa-solid fa-store" />
              </span>
              <div>
                <h1 className="salon-detail-title">
                  {salon.name}
                  {salon.is_primary && <span className="available-salon-badge">Main</span>}
                </h1>
                <p className="salon-detail-location">
                  <i className="fa-solid fa-location-dot" aria-hidden="true" />
                  {salon.location}
                </p>
              </div>
            </div>

            {salon.page_lead && <p className="salon-detail-lead">{salon.page_lead}</p>}
            {salon.services_summary && (
              <p className="salon-detail-services">{salon.services_summary}</p>
            )}

            <div className="salon-detail-contact">
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

            <Bookservice variant="card" salonId={salon.id} label={`Book at ${salon.name}`} />
          </div>
        </div>
      </section>

      <section className="section-band section-band--base">
        <div className="container-fluid px-2 px-md-4">
          <div className="available-workers-header text-center">
            <span className="available-workers-eyebrow">Team at this branch</span>
            <h2 className="available-workers-title">Salon technicians</h2>
            <p className="available-workers-sub">
              Book directly with a team member at {salon.name} — review their portfolio before you
              choose.
            </p>
          </div>

          {technicians.length === 0 ? (
            <p className="available-workers-status text-center">
              Technicians assigned to this salon will appear here once schedules are set.
            </p>
          ) : (
            <div className="available-workers-grid">
              {technicians.map((worker) => (
                <TechnicianCard key={worker.id} worker={worker} salonId={salon.id} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default SalonDetail
