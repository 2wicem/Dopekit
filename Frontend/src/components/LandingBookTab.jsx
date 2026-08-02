import { Link } from 'react-router-dom'
import Bookservice from './Bookservice'
import BrandLogo from './BrandLogo'
import LandingHeroCarousel from './LandingHeroCarousel'
import LandingNearbyMap from './LandingNearbyMap'
import LandingTechniciansSection from './LandingTechniciansSection'
import { BOOK_SLIDES } from './landingData'

const LandingBookTab = () => (
  <>
    <LandingHeroCarousel slides={BOOK_SLIDES}>
      <div className="landing-hero-badge mb-3">
        <BrandLogo size="lg" variant="hero" />
      </div>
      <h1 className="landing-hero-title">
        Looking for indoor or outdoor manicure and pedicure services
      </h1>
      <h2 className="landing-hero-subtitle">
        Discover the perfect nail care experience with Dopekit
      </h2>
      <p className="landing-hero-lead">
        From gel and builder sets to tips and acrylics, we bring professional nail care
        to you — at Kikuyu town or at your location.
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
        <Link
          to="/Services#technicians"
          className="btn btn-outline-light btn-sm rounded-pill px-3 landing-btn-secondary"
        >
          View technicians
        </Link>
        <Bookservice />
      </div>
    </LandingHeroCarousel>

    <LandingNearbyMap />
    <LandingTechniciansSection />
  </>
)

export default LandingBookTab
