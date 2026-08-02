from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .geo_utils import DEFAULT_MAP_LAT, DEFAULT_MAP_LNG, haversine_km, parse_lat_lng
from .models import Salon
from .worker_views import build_public_workers


def _marker_base(marker_id, marker_type, name, latitude, longitude, client_lat, client_lng):
    marker = {
        'id': marker_id,
        'type': marker_type,
        'name': name,
        'latitude': latitude,
        'longitude': longitude,
    }
    if client_lat is not None and client_lng is not None:
        marker['distance_km'] = round(haversine_km(client_lat, client_lng, latitude, longitude), 2)
    return marker


def _salon_markers(client_lat, client_lng):
    markers = []
    for salon in Salon.objects.filter(is_active=True, latitude__isnull=False, longitude__isnull=False):
        if salon.latitude is None or salon.longitude is None:
            continue
        lat = float(salon.latitude)
        lng = float(salon.longitude)
        marker = _marker_base(f'salon-{salon.id}', 'salon', salon.name, lat, lng, client_lat, client_lng)
        marker.update(
            {
                'salon_id': salon.id,
                'slug': salon.slug,
                'location': salon.location,
                'is_primary': salon.is_primary,
            }
        )
        markers.append(marker)
    return markers


def _technician_markers(client_lat, client_lng):
    markers = []
    seen = set()

    for worker in build_public_workers():
        worker_id = worker['id']
        if worker_id in seen:
            continue

        lat = None
        lng = None
        if worker.get('latitude') is not None and worker.get('longitude') is not None:
            lat = float(worker['latitude'])
            lng = float(worker['longitude'])
        elif worker.get('salon_id'):
            salon = Salon.objects.filter(pk=worker['salon_id']).first()
            if salon and salon.latitude is not None and salon.longitude is not None:
                lat = float(salon.latitude)
                lng = float(salon.longitude)

        if lat is None or lng is None:
            continue

        seen.add(worker_id)
        marker = _marker_base(
            f'tech-{worker_id}',
            'technician',
            worker['name'],
            lat,
            lng,
            client_lat,
            client_lng,
        )
        marker.update(
            {
                'worker_id': worker_id,
                'salon_id': worker.get('salon_id'),
                'salon_name': worker.get('salon_name'),
                'is_freelance': worker.get('is_freelance', False),
                'is_available': worker.get('is_available', False),
                'rating_average': worker.get('rating_average'),
                'rating_count': worker.get('rating_count', 0),
            }
        )
        markers.append(marker)

    return markers


def _sort_markers(markers, client_lat, client_lng):
    if client_lat is None or client_lng is None:
        return sorted(markers, key=lambda item: (item['type'] != 'salon', item['name'].lower()))
    return sorted(
        markers,
        key=lambda item: (
            item.get('distance_km', 9999),
            item['type'] != 'salon',
            item['name'].lower(),
        ),
    )


@require_http_methods(['GET'])
def nearby_map_markers(request):
    client_lat, client_lng = parse_lat_lng(request.GET.get('lat'), request.GET.get('lng'))
    marker_type = (request.GET.get('type') or 'all').strip().lower()

    markers = []
    if marker_type in ('all', 'salons'):
        markers.extend(_salon_markers(client_lat, client_lng))
    if marker_type in ('all', 'technicians'):
        markers.extend(_technician_markers(client_lat, client_lng))

    markers = _sort_markers(markers, client_lat, client_lng)

    return JsonResponse(
        {
            'client': {
                'latitude': client_lat,
                'longitude': client_lng,
                'located': client_lat is not None and client_lng is not None,
            },
            'default_center': {
                'latitude': DEFAULT_MAP_LAT,
                'longitude': DEFAULT_MAP_LNG,
            },
            'markers': markers,
        }
    )

