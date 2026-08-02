import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Bookservice from './Bookservice'
import TechnicianScheduleButton from './TechnicianScheduleButton'
import NearbyMap from './NearbyMap'
import { CLIENT_MAP_ZOOM, DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, NEARBY_FILTER_OPTIONS } from '../constants/mapDefaults'
import { useGeolocation } from '../hooks/useGeolocation'
import { useNearbyMarkers } from '../hooks/useNearbyMarkers'
import { formatDistanceKm, toLatLng } from '../utils/geo'

const LandingNearbyMap = () => {
  const [filter, setFilter] = useState('all')
  const {
    coords,
    loading: locating,
    error: locateError,
    locate,
    setManualLocation,
    clearLocation,
    isLocated,
  } = useGeolocation()
  const { markers, defaultCenter, loading, refreshing, error } = useNearbyMarkers({
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    type: filter,
  })

  const mapCenter = useMemo(() => {
    if (isLocated && coords) {
      return toLatLng(coords.latitude, coords.longitude) || DEFAULT_MAP_CENTER
    }

    if (defaultCenter?.latitude != null && defaultCenter?.longitude != null) {
      return toLatLng(defaultCenter.latitude, defaultCenter.longitude) || DEFAULT_MAP_CENTER
    }

    return DEFAULT_MAP_CENTER
  }, [coords, defaultCenter, isLocated])

  const mapZoom = isLocated ? CLIENT_MAP_ZOOM : DEFAULT_MAP_ZOOM
  const nearestMarkers = markers.slice(0, 6)
  const showMap = !loading || isLocated

  const handleMapPick = (picked) => {
    setManualLocation(picked.latitude, picked.longitude)
  }

  return (
    <section className="landing-nearby" aria-labelledby="landing-nearby-heading">
      <div className="landing-nearby-header text-center">
        <span className="landing-nearby-eyebrow">Near you</span>
        <h2 id="landing-nearby-heading" className="landing-nearby-title">
          Find salons &amp; nail techs
        </h2>
        <p className="landing-nearby-sub">Allow location or tap the map to drop your pin.</p>
      </div>

      <div className="landing-nearby-toolbar">
        <div className="landing-nearby-locate-group">
          <button
            type="button"
            className={`landing-nearby-locate${isLocated ? ' is-active' : ''}`}
            onClick={locate}
            disabled={locating}
          >
            <i className="fa-solid fa-location-crosshairs" aria-hidden="true" />
            {locating ? 'Locating…' : isLocated ? 'Refresh my location' : 'Use my location'}
          </button>
          {isLocated && (
            <button type="button" className="landing-nearby-clear" onClick={clearLocation}>
              Clear
            </button>
          )}
        </div>

        <div className="landing-nearby-filters" role="tablist" aria-label="Map filters">
          {NEARBY_FILTER_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={`landing-nearby-filter${filter === id ? ' is-active' : ''}`}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLocated && coords && (
        <p className="landing-nearby-status landing-nearby-status--success text-center">
          <i className="fa-solid fa-location-dot" aria-hidden="true" /> Your pin set
          {coords.manual ? ' (manual)' : ' (GPS)'}
          {coords.accuracy != null && !coords.manual && ` · ±${Math.round(coords.accuracy)} m`}
        </p>
      )}

      {(locateError || error) && (
        <p className="landing-nearby-status landing-nearby-status--error text-center">
          {locateError || error}
        </p>
      )}

      <div className="landing-nearby-map-shell">
        {!showMap ? (
          <div className="landing-nearby-map-placeholder">Loading map…</div>
        ) : (
          <>
            <NearbyMap
              center={mapCenter}
              zoom={mapZoom}
              clientCoords={isLocated ? coords : null}
              markers={markers}
              allowMapPick
              onPickLocation={handleMapPick}
            />
            {(locating || refreshing) && (
              <div className="landing-nearby-map-overlay" aria-live="polite">
                {locating ? 'Getting your location…' : 'Updating nearby picks…'}
              </div>
            )}
          </>
        )}
      </div>

      <p className="landing-nearby-map-hint text-center">
        Tip: tap anywhere on the map to place yourself if GPS is blocked.
      </p>

      {!loading && nearestMarkers.length > 0 && (
        <div className="landing-nearby-list">
          <h3 className="landing-nearby-list-title">
            {isLocated ? 'Nearest picks' : 'On the map'}
          </h3>
          <div className="landing-nearby-cards">
            {nearestMarkers.map((marker) => (
              <article key={marker.id} className="landing-nearby-card">
                <div className="landing-nearby-card__main">
                  <span
                    className={`landing-nearby-card__icon${
                      marker.type === 'salon' ? ' is-salon' : ' is-tech'
                    }`}
                    aria-hidden="true"
                  >
                    <i className={marker.type === 'salon' ? 'fa-solid fa-store' : 'fa-solid fa-user'} />
                  </span>
                  <div>
                    <h4 className="landing-nearby-card__name">{marker.name}</h4>
                    <p className="landing-nearby-card__meta">
                      {marker.type === 'salon' ? marker.location : marker.salon_name || 'Mobile service'}
                      {marker.distance_km != null && ` · ${formatDistanceKm(marker.distance_km)}`}
                    </p>
                  </div>
                </div>

                {marker.type === 'salon' ? (
                  <div className="landing-nearby-card__actions">
                    <Link to={`/salons/${marker.slug}`} className="btn btn-sm btn-outline-primary">
                      View
                    </Link>
                    <Bookservice variant="card" salonId={marker.salon_id} label="Book" />
                  </div>
                ) : (
                  <div className="landing-nearby-card__actions">
                    <TechnicianScheduleButton
                      worker={{
                        id: marker.worker_id,
                        name: marker.name,
                        salon_id: marker.salon_id,
                      }}
                      salonId={marker.salon_id}
                    />
                    <Bookservice
                      variant="card"
                      workerId={marker.worker_id}
                      workerName={marker.name}
                      salonId={marker.salon_id}
                      label="Book"
                    />
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {!loading && markers.length === 0 && !error && (
        <p className="landing-nearby-status text-center">
          No map pins yet. Add salon GPS coordinates in admin to appear here.
        </p>
      )}
    </section>
  )
}

export default LandingNearbyMap
