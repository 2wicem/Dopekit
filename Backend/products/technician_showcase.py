from decimal import Decimal, InvalidOperation

from django.db.models import Q

from .models import Booking, BookingStatus


def parse_portfolio_urls(raw_value: str) -> list[str]:
    urls = []
    for line in (raw_value or '').splitlines():
        url = line.strip()
        if not url:
            continue
        if url.startswith('http://') or url.startswith('https://'):
            urls.append(url)
    return urls[:12]


def portfolio_urls_to_text(urls) -> str:
    if not urls:
        return ''
    if isinstance(urls, str):
        return urls.strip()
    cleaned = []
    for url in urls:
        value = str(url).strip()
        if value.startswith('http://') or value.startswith('https://'):
            cleaned.append(value)
    return '\n'.join(cleaned[:12])


def normalize_rating_average(raw_value) -> Decimal | None:
    if raw_value in (None, ''):
        return None
    try:
        rating = Decimal(str(raw_value))
    except (InvalidOperation, TypeError, ValueError):
        return None
    if rating < 0 or rating > 5:
        return None
    return rating.quantize(Decimal('0.01'))


def completed_jobs_for_worker(user) -> int:
    return (
        Booking.objects.filter(status=BookingStatus.ACCEPTED)
        .filter(Q(time_slot__worker=user) | Q(preferred_worker=user))
        .distinct()
        .count()
    )


def technician_showcase_to_dict(profile, completed_jobs: int = 0) -> dict:
    rating_average = None
    if profile.technician_rating_average is not None:
        rating_average = float(profile.technician_rating_average)

    return {
        'work_summary': profile.technician_work_summary or '',
        'portfolio_urls': parse_portfolio_urls(profile.technician_portfolio_urls),
        'rating_average': rating_average,
        'rating_count': profile.technician_rating_count or 0,
        'completed_jobs': completed_jobs,
    }
