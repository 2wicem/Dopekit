"""Default service menu prices (KES) — keep in sync with Frontend servicesData.js."""

DEFAULT_SERVICE_PRICES = {
    'Just gel': 500,
    'Builder + gel': 1000,
    'Tips + gel': 1000,
    'Tips Builder + gel': 1500,
    'Gum gel': 1500,
    'Pedicure': 1500,
    'Acrylics': 2500,
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
