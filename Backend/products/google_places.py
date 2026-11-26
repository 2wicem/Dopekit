"""Fetch and cache Google Places ratings for salon branches."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .models import Salon

logger = logging.getLogger(__name__)

PUBLIC_SALONS_CACHE_KEY = 'dk:public_salons:v2'
FIND_PLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json'
PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json'


def google_places_api_key() -> str:
    return (getattr(settings, 'GOOGLE_PLACES_API_KEY', '') or '').strip()


def google_ratings_enabled() -> bool:
    return bool(google_places_api_key()) and bool(
        getattr(settings, 'GOOGLE_PLACES_RATINGS_ENABLED', True)
    )


def google_ratings_ttl_seconds() -> int:
    return max(300, int(getattr(settings, 'GOOGLE_PLACES_RATINGS_TTL_SECONDS', 86400) or 86400))


def invalidate_public_salons_cache() -> None:
    cache.delete(PUBLIC_SALONS_CACHE_KEY)
    # Older cache key used before Google ratings were exposed publicly.
    cache.delete('dk:public_salons:v1')


def _http_get_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            'User-Agent': getattr(
                settings,
                'GEOCODING_USER_AGENT',
                'DopekitNailsService/1.0',
            ),
            'Accept': 'application/json',
        },
    )
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode('utf-8'))


def _normalize_rating(raw_value) -> Decimal | None:
    if raw_value in (None, ''):
        return None
    try:
        value = Decimal(str(raw_value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if value < Decimal('0') or value > Decimal('5'):
        return None
    return value.quantize(Decimal('0.01'))


def _normalize_count(raw_value) -> int:
    try:
        count = int(raw_value or 0)
    except (TypeError, ValueError):
        return 0
    return max(0, min(count, 10_000_000))


def build_salon_search_query(salon: Salon) -> str:
    parts = [salon.name.strip(), (salon.location or '').strip()]
    country = (getattr(settings, 'GEOCODING_DEFAULT_COUNTRY', 'Kenya') or '').strip()
    if country and country.lower() not in ' '.join(parts).lower():
        parts.append(country)
    return ' '.join(part for part in parts if part)


def find_google_place_id(salon: Salon, *, api_key: str | None = None) -> str | None:
    key = (api_key or google_places_api_key()).strip()
    if not key:
        return None

    query = build_salon_search_query(salon)
    if len(query) < 3:
        return None

    params = {
        'input': query,
        'inputtype': 'textquery',
        'fields': 'place_id,name,formatted_address',
        'key': key,
    }
    if salon.latitude is not None and salon.longitude is not None:
        params['locationbias'] = f'point:{salon.latitude},{salon.longitude}'

    url = f'{FIND_PLACE_URL}?{urllib.parse.urlencode(params)}'
    try:
        payload = _http_get_json(url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        logger.exception('Google Places find failed for salon_id=%s query=%r', salon.id, query)
        return None

    status = payload.get('status')
    if status not in ('OK', 'ZERO_RESULTS'):
        logger.warning(
            'Google Places find status=%s salon_id=%s error=%s',
            status,
            salon.id,
            payload.get('error_message'),
        )
        return None

    candidates = payload.get('candidates') or []
    if not candidates:
        return None

    place_id = (candidates[0].get('place_id') or '').strip()
    return place_id or None


def fetch_google_place_ratings(place_id: str, *, api_key: str | None = None) -> dict[str, Any] | None:
    key = (api_key or google_places_api_key()).strip()
    place_id = (place_id or '').strip()
    if not key or not place_id:
        return None

    params = {
        'place_id': place_id,
        'fields': 'place_id,name,rating,user_ratings_total,url',
        'key': key,
    }
    url = f'{PLACE_DETAILS_URL}?{urllib.parse.urlencode(params)}'
    try:
        payload = _http_get_json(url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        logger.exception('Google Places details failed for place_id=%s', place_id)
        return None

    status = payload.get('status')
    if status != 'OK':
        logger.warning(
            'Google Places details status=%s place_id=%s error=%s',
            status,
            place_id,
            payload.get('error_message'),
        )
        return None

    result = payload.get('result') or {}
    return {
        'place_id': (result.get('place_id') or place_id).strip(),
        'name': (result.get('name') or '').strip(),
        'rating_average': _normalize_rating(result.get('rating')),
        'rating_count': _normalize_count(result.get('user_ratings_total')),
        'maps_url': (result.get('url') or '').strip(),
    }


def salon_google_ratings_are_fresh(salon: Salon, *, now=None) -> bool:
    fetched_at = salon.google_ratings_fetched_at
    if not fetched_at:
        return False
    now = now or timezone.now()
    age = (now - fetched_at).total_seconds()
    return age < google_ratings_ttl_seconds()


def refresh_salon_google_ratings(
    salon: Salon,
    *,
    force: bool = False,
    api_key: str | None = None,
) -> tuple[Salon, str | None]:
    """
    Resolve a Google Place (if needed) and refresh cached ratings.

    Returns (salon, error_message). error_message is None on success.
    """
    if not google_ratings_enabled() and not (api_key or '').strip():
        return salon, 'Google Places ratings are not configured (set GOOGLE_PLACES_API_KEY).'

    if not force and salon_google_ratings_are_fresh(salon):
        return salon, None

    key = (api_key or google_places_api_key()).strip()
    place_id = (salon.google_place_id or '').strip()
    if not place_id:
        place_id = find_google_place_id(salon, api_key=key) or ''
        if not place_id:
            return salon, f'No Google Place match for “{salon.name}”.'

    details = fetch_google_place_ratings(place_id, api_key=key)
    if not details:
        return salon, f'Could not load Google ratings for “{salon.name}”.'

    salon.google_place_id = details['place_id'] or place_id
    salon.google_rating_average = details['rating_average']
    salon.google_rating_count = details['rating_count']
    salon.google_ratings_fetched_at = timezone.now()
    salon.save(
        update_fields=[
            'google_place_id',
            'google_rating_average',
            'google_rating_count',
            'google_ratings_fetched_at',
            'updated_at',
        ]
    )
    invalidate_public_salons_cache()
    return salon, None


def refresh_stale_salon_google_ratings(*, force: bool = False, limit: int | None = None) -> dict[str, int]:
    """Refresh Google ratings for active salons. Used by management command / soft refresh."""
    if not google_ratings_enabled():
        return {'skipped': 0, 'updated': 0, 'failed': 0, 'fresh': 0}

    queryset = Salon.objects.filter(is_active=True).order_by('id')
    if limit is not None:
        queryset = queryset[: max(0, int(limit))]

    stats = {'skipped': 0, 'updated': 0, 'failed': 0, 'fresh': 0}
    for salon in queryset:
        if not force and salon_google_ratings_are_fresh(salon):
            stats['fresh'] += 1
            continue
        _salon, error = refresh_salon_google_ratings(salon, force=force)
        if error:
            stats['failed'] += 1
            logger.info('Google ratings refresh failed salon_id=%s: %s', salon.id, error)
        else:
            stats['updated'] += 1
    return stats


def maybe_refresh_public_salon_ratings() -> None:
    """
    Best-effort soft refresh when serving the public salon list.
    Runs off-thread with a short lock so the API response stays fast.
    """
    if not google_ratings_enabled():
        return

    lock_key = 'dk:google_places_refresh_lock'
    if not cache.add(lock_key, 1, timeout=120):
        return

    def _run():
        try:
            # Keep Places quota bounded: refresh at most a few stale salons per wave.
            refresh_stale_salon_google_ratings(force=False, limit=3)
        except Exception:
            logger.exception('Soft Google ratings refresh failed')
        finally:
            cache.delete(lock_key)

    import threading

    threading.Thread(target=_run, name='dk-google-places-refresh', daemon=True).start()
