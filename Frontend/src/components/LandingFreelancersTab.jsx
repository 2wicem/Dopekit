import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { usePublicWorkers } from '../hooks/usePublicWorkers'
import LandingHeroCarousel from './LandingHeroCarousel'
import TechnicianCard from './TechnicianCard'
import { FREELANCE_SLIDES } from './landingData'

const LandingFreelancersTab = () => {
  const { workers, loading, error } = usePublicWorkers()

  const freelanceTechnicians = useMemo(
    () => workers.filter((worker) => worker.is_freelance),
    [workers]
  )

  return (
    <div className="landing-tab-panel">
      <LandingHeroCarousel slides={FREELANCE_SLIDES} compact overlay="freelancers">
        <span className="landing-tab-eyebrow">Independent artists</span>
        <h1 className="landing-hero-title landing-hero-title--compact">Freelance technicians</h1>
        <p className="landing-hero-lead landing-hero-lead--compact">
          Mobile nail care at your location — browse portfolios and ratings before you book.
        </p>
        <Link
          to="/Services#technicians"
          className="btn btn-outline-light btn-sm rounded-pill px-3 landing-btn-secondary"
        >
          All technicians
        </Link>
      </LandingHeroCarousel>

      <div className="landing-tab-scroll available-workers landing-tab-freelancers">
        <div className="landing-tab-scroll-header text-center">
          <h2 className="landing-tab-scroll-title">Book mobile nail care</h2>
          <p className="landing-tab-scroll-sub">
            Freelancers come to you — compare portfolios, ratings, and open slots.
          </p>
        </div>
        {loading && <p className="available-workers-status text-center">Loading team...</p>}
        {error && (
          <p className="available-workers-status available-workers-status--error text-center">{error}</p>
        )}
        {!loading && !error && freelanceTechnicians.length === 0 && (
          <p className="available-workers-status text-center">
            Freelance technicians will appear here once profiles are live.
          </p>
        )}
        {!loading && !error && freelanceTechnicians.length > 0 && (
          <div className="available-workers-grid">
            {freelanceTechnicians.map((worker) => (
              <TechnicianCard key={worker.id} worker={worker} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LandingFreelancersTab
