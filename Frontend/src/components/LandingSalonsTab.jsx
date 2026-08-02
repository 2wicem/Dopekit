import { Link } from 'react-router-dom'
import { usePublicSalons } from '../hooks/usePublicSalons'
import LandingHeroCarousel from './LandingHeroCarousel'
import SalonMarketplaceCard from './SalonMarketplaceCard'
import { SALON_SLIDES } from './landingData'

const LandingSalonsTab = () => {
  const { salons, loading, error } = usePublicSalons()

  return (
    <div className="landing-tab-panel">
      <LandingHeroCarousel slides={SALON_SLIDES} compact overlay="salons">
        <span className="landing-tab-eyebrow">Salons</span>
        <h1 className="landing-hero-title landing-hero-title--compact">Find a salon near you</h1>
        <p className="landing-hero-lead landing-hero-lead--compact">
          New to Dopekit? Choose a salon, see who works there, and book your nails in a few taps.
        </p>
        <ol className="landing-app-steps landing-app-steps--hero">
          <li>
            <span className="landing-app-steps__num" aria-hidden="true">1</span>
            <span>Pick a salon</span>
          </li>
          <li>
            <span className="landing-app-steps__num" aria-hidden="true">2</span>
            <span>Choose a technician</span>
          </li>
          <li>
            <span className="landing-app-steps__num" aria-hidden="true">3</span>
            <span>Book a time</span>
          </li>
        </ol>
        <Link to="/Services" className="btn btn-outline-light btn-sm rounded-pill px-3 landing-btn-secondary">
          See services &amp; prices
        </Link>
      </LandingHeroCarousel>

      <div className="landing-tab-scroll available-salons landing-tab-salons">
        <div className="landing-tab-scroll-header text-center">
          <h2 className="landing-tab-scroll-title">Salons you can book</h2>
          <p className="landing-tab-scroll-sub">
            Tap a salon to view the address, team, and open appointment slots.
          </p>
        </div>
        {loading && <p className="available-salons-status text-center">Loading salons…</p>}
        {error && (
          <p className="available-salons-status available-salons-status--error text-center">{error}</p>
        )}
        {!loading && !error && salons.length === 0 && (
          <p className="available-salons-status text-center">
            No salons are listed yet. Try the Book tab to schedule with a mobile technician instead.
          </p>
        )}
        {!loading && !error && salons.length > 0 && (
          <div className="available-salons-grid">
            {salons.map((salon) => (
              <SalonMarketplaceCard key={salon.id} salon={salon} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LandingSalonsTab
