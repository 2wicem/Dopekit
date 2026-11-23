"""Default service menu prices (KES) — keep in sync with Frontend servicesData.js.

Westlands / mid-to-high spa rates, not neighbourhood-salon pricing.
"""

DEFAULT_SERVICE_PRICES = {
    'Just gel': 2000,
    'Builder + gel': 3000,
    'Tips + gel': 3500,
    'Tips Builder + gel': 4500,
    'Gum gel': 4000,
    'Pedicure': 3000,
    'Acrylics': 5000,
    'Custom nail art': 5000,
    'Kids gel': 1500,
    'French tips': 2500,
}


def resolve_service_price_kes(service_name: str, raw_price=None) -> int | None:
    if raw_price not in (None, '', 'null'):
        try:
            value = int(raw_price)
            if value >= 0:
                return value
        except (TypeError, ValueError):
            pass

    name = (service_name or '').strip()
    if not name:
        return None

    lowered = name.lower()
    for label, price in DEFAULT_SERVICE_PRICES.items():
        if label.lower() == lowered:
            return price

    return None
