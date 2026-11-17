import { Link } from 'react-router-dom'
import AvailableSalons from './AvailableSalons'
import Bookservice from './Bookservice'
import BrandLogo from './BrandLogo'
import LandingHeroCarousel from './LandingHeroCarousel'
import LandingNearbyMap from './LandingNearbyMap'
import LandingTechniciansSection from './LandingTechniciansSection'
import LandingLocalTrust from './LandingLocalTrust'
import { BOOK_SLIDES } from './landingData'

const scrollToDiscovery = (event) => {
  event.preventDefault()
  document.getElementById('book-discovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const LandingBookTab = () => (
  <>
    <LandingHeroCarousel slides={BOOK_SLIDES}>
      <div className="landing-hero-badge mb-3">
        <BrandLogo size="lg" variant="hero" />
      </div>
      <h1 className="landing-hero-title">
        Nail salon in Kikuyu, Nairobi — manicure, pedicure and gel
      </h1>
      <h2 className="landing-hero-subtitle">
        Book Dopekit studio in Kikuyu Town or a mobile technician at your place
      </h2>
      <p className="landing-hero-lead">
        Gel, builder, tips and acrylics. Indoor at the salon or outdoor at your location across
        Kiambu and Nairobi.
      </p>
      <ul className="landing-hero-pills">
        <li><i className="fa-solid fa-sparkles" aria-hidden="true" /> Gel &amp; acrylic</li>
        <li><i className="fa-solid fa-house-chimney" aria-hidden="true" /> Indoor &amp; mobile</li>
        <li><i className="fa-solid fa-star" aria-hidden="true" /> Rated technicians</li>
      </ul>
      <div className="landing-hero-actions d-flex justify-content-center gap-2 flex-wrap">
        <Link to="/Services" className="btn btn-outline-light btn-sm rounded-pill px-3 landing-btn-secondary">
          View services
        </Link>
        <a
          href="#book-discovery"
          className="btn btn-outline-light btn-sm rounded-pill px-3 landing-btn-secondary"
          onClick={scrollToDiscovery}
        >
          View technicians
        </a>
        <Bookservice />
      </div>
    </LandingHeroCarousel>

    <div id="book-discovery" className="landing-book-discovery">
      <LandingNearbyMap />
      <div className="landing-book-discovery-salons">
        <AvailableSalons />
      </div>
      <LandingTechniciansSection />
      <LandingLocalTrust />
    </div>
  </>
)

export default LandingBookTab
