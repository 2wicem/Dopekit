import { usePublicSalons } from '../hooks/usePublicSalons'
import SalonMarketplaceCard from './SalonMarketplaceCard'

const AvailableSalons = () => {
  const { salons, loading, error } = usePublicSalons()

  if (!loading && !error && salons.length === 0) {
    return null
  }

  return (
    <section className="available-salons" aria-labelledby="available-salons-heading">
      <div className="available-salons-header text-center">
        <span className="available-salons-eyebrow">Our locations</span>
        <h2 id="available-salons-heading" className="available-salons-title">
          Salon branches
        </h2>
        <p className="available-salons-sub">
          Choose where you want to be seen — book indoor service at any active Dopekit location.
        </p>
      </div>

      {loading && <p className="available-salons-status text-center">Loading locations...</p>}
      {error && (
        <p className="available-salons-status available-salons-status--error text-center">{error}</p>
      )}

      {!loading && !error && salons.length > 0 && (
        <div className="available-salons-grid">
          {salons.map((salon) => (
            <SalonMarketplaceCard key={salon.id} salon={salon} />
          ))}
        </div>
      )}
    </section>
  )
}

export default AvailableSalons
