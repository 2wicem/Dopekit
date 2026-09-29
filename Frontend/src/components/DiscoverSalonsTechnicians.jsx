import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AvailableSalons from './AvailableSalons'
import AvailableWorkers from './AvailableWorkers'
import './css/Services.css'

const DiscoverSalonsTechnicians = () => {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) {
      return
    }

    const target = document.querySelector(location.hash)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [location.hash])

  return (
  <div className="services-page services-page--discover">
    <section className="section-band section-band--alt">
      <div className="container-fluid px-2 px-md-4 py-4 text-center discover-intro">
        <h1 className="services-page-title h4 mb-2">Salons &amp; technicians</h1>
        <p className="text-muted mb-0">
          Choose a salon branch or book directly with a technician — no price menu, just who and
          where.
        </p>
      </div>
    </section>

    <section className="section-band section-band--base">
      <div className="container-fluid px-2 px-md-4">
        <AvailableSalons />
      </div>
    </section>

    <section className="section-band section-band--base">
      <div className="container-fluid px-2 px-md-4">
        <AvailableWorkers />
      </div>
    </section>
  </div>
  )
}

export default DiscoverSalonsTechnicians
