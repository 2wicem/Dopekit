import math
from decimal import Decimal, InvalidOperation

# Wangige / Kikuyu area default map center
DEFAULT_MAP_LAT = -1.2466
DEFAULT_MAP_LNG = 36.6647


def parse_coordinate(raw_value) -> Decimal | None:
    if raw_value in (None, ''):
        return None
    try:
        value = Decimal(str(raw_value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    return value


def validate_latitude(value: Decimal | None) -> Decimal | None:
    if value is None:
        return None
    if value < Decimal('-90') or value > Decimal('90'):
        return None
    return value.quantize(Decimal('0.000001'))


def validate_longitude(value: Decimal | None) -> Decimal | None:
    if value is None:
        return None
    if value < Decimal('-180') or value > Decimal('180'):
        return None
    return value.quantize(Decimal('0.000001'))


def parse_lat_lng(lat_raw, lng_raw) -> tuple[float | None, float | None]:
    lat = validate_latitude(parse_coordinate(lat_raw))
    lng = validate_longitude(parse_coordinate(lng_raw))
    if lat is None or lng is None:
        return None, None
    return float(lat), float(lng)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_km * c


def coordinate_pair_to_dict(latitude, longitude) -> dict | None:
    if latitude is None or longitude is None:
        return None
    return {
        'latitude': float(latitude),
        'longitude': float(longitude),
    }
