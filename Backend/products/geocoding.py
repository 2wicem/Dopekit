import json
import logging
import urllib.parse
import urllib.request

from django.conf import settings

from .geo_utils import parse_coordinate, validate_latitude, validate_longitude

logger = logging.getLogger(__name__)


def geocode_location(address: str) -> tuple[tuple | None, str | None]:
    """Resolve a human-readable address to validated latitude/longitude."""
    if not getattr(settings, 'GEOCODING_ENABLED', True):
        return None, None

    query = (address or '').strip()
    if len(query) < 3:
        return None, 'Enter a more specific address so we can place it on the map.'

    country = getattr(settings, 'GEOCODING_DEFAULT_COUNTRY', 'Kenya')
    search = query if country.lower() in query.lower() else f'{query}, {country}'

    params = urllib.parse.urlencode(
        {
            'q': search,
            'format': 'json',
            'limit': 1,
            'countrycodes': 'ke',
        }
    )
    url = f'https://nominatim.openstreetmap.org/search?{params}'
    request = urllib.request.Request(
        url,
        headers={
            'User-Agent': getattr(
                settings,
                'GEOCODING_USER_AGENT',
                'DopekitNailsService/1.0',
            ),
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except Exception:
        logger.exception('Geocoding lookup failed for address=%r', query)
        return None, 'Could not look up map coordinates right now. Try again in a moment.'

    if not payload:
        return None, (
            'Could not find that address on the map. '
            'Include the area or town (e.g. Kikuyu, Wangige, Nairobi).'
        )

    match = payload[0]
    latitude = validate_latitude(parse_coordinate(match.get('lat')))
    longitude = validate_longitude(parse_coordinate(match.get('lon')))
    if latitude is None or longitude is None:
        return None, 'Geocoding returned invalid coordinates for that address.'

    return (latitude, longitude), None
