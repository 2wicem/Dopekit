import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import AvailableSalons from './AvailableSalons'
import BrandLogo from './BrandLogo'
import DeferredMount from './DeferredMount'
import LandingHeroCarousel from './LandingHeroCarousel'
import LandingLocalTrust from './LandingLocalTrust'
import LazyBookservice from './LazyBookservice'
import { BOOK_SLIDES } from './landingBookSlides'

const NearbyMapPanel = lazy(() => import('./LandingNearbyMap'))
const TechniciansPanel = lazy(() => import('./LandingTechniciansSection'))

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
        <LazyBookservice />
      </div>
    </LandingHeroCarousel>

    <div id="book-discovery" className="landing-book-discovery">
      <DeferredMount
        delay={400}
        fallback={<div className="landing-nearby-map-placeholder">Map loads after the page is ready…</div>}
      >
        <Suspense fallback={<div className="landing-nearby-map-placeholder">Loading map…</div>}>
          <NearbyMapPanel />
        </Suspense>
      </DeferredMount>
      <div className="landing-book-discovery-salons">
        <AvailableSalons />
      </div>
      <DeferredMount delay={200} fallback={null}>
        <Suspense fallback={null}>
          <TechniciansPanel />
        </Suspense>
      </DeferredMount>
      <LandingLocalTrust />
    </div>
  </>
)

export default LandingBookTab
