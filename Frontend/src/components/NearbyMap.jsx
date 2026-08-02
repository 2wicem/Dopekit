import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { formatDistanceKm } from '../utils/geo'
import 'leaflet/dist/leaflet.css'

const pinHtml = (iconClass, toneClass) =>
  `<span class="nearby-map-pin ${toneClass}"><i class="${iconClass}" aria-hidden="true"></i></span>`

const salonIcon = L.divIcon({
  className: 'nearby-map-pin-wrap',
  html: pinHtml('fa-solid fa-store', 'nearby-map-pin--salon'),
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -30],
})

const technicianIcon = L.divIcon({
  className: 'nearby-map-pin-wrap',
  html: pinHtml('fa-solid fa-user', 'nearby-map-pin--tech'),
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -30],
})

const RecenterMap = ({ center, zoom }) => {
  const map = useMap()

  useEffect(() => {
    map.setView(center, zoom, { animate: true })
  }, [center, zoom, map])

  return null
}

const MapLocationPicker = ({ onPick }) => {
  useMapEvents({
    click(event) {
      onPick?.({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      })
    },
  })

  return null
}

const NearbyMap = ({ center, zoom, clientCoords, markers, onPickLocation, allowMapPick = false }) => {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={`nearby-map${allowMapPick ? ' nearby-map--pickable' : ''}`}
      scrollWheelZoom={false}
    >
      <RecenterMap center={center} zoom={zoom} />
      {allowMapPick && onPickLocation && <MapLocationPicker onPick={onPickLocation} />}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {clientCoords && (
        <CircleMarker
          center={[clientCoords.latitude, clientCoords.longitude]}
          radius={10}
          pathOptions={{
            color: '#7dd3fc',
            fillColor: '#38bdf8',
            fillOpacity: 0.95,
            weight: 3,
          }}
        >
          <Popup>You are here</Popup>
        </CircleMarker>
      )}

      {markers.map((marker) => (
        <Marker
          key={marker.id}
          position={[marker.latitude, marker.longitude]}
          icon={marker.type === 'salon' ? salonIcon : technicianIcon}
        >
          <Popup>
            <div className="nearby-map-popup">
              <strong>{marker.name}</strong>
              <p className="nearby-map-popup-meta">
                {marker.type === 'salon' ? 'Salon' : marker.is_freelance ? 'Freelance' : 'Technician'}
                {marker.distance_km != null && ` · ${formatDistanceKm(marker.distance_km)} away`}
              </p>
              {marker.location && <p className="nearby-map-popup-meta">{marker.location}</p>}
              {marker.type === 'technician' && marker.rating_count > 0 && marker.rating_average != null && (
                <p className="nearby-map-popup-meta">
                  {Number(marker.rating_average).toFixed(1)} ★ ({marker.rating_count})
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}

export default NearbyMap
