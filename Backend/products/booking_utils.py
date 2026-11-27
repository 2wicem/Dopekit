from django.db.models import Q

from .models import UserRole
from .technician_utils import is_freelance_technician
from .technician_verification import normalize_ke_phone_digits


def normalize_service_key(service: str) -> str:
    return ' '.join((service or '').casefold().split())


def _worker_display_name(user):
    if user is None:
        return 'staff'
    full = user.get_full_name().strip()
    return full or user.username


def conflicting_walk_in(*, salon, worker, requested_date, phone, service):
    from .models import Booking, BookingStatus

    digits = normalize_ke_phone_digits(phone)
    if not digits or not requested_date:
        return None

    queryset = Booking.objects.filter(
        is_walk_in=True,
        requested_date=requested_date,
        status=BookingStatus.COMPLETED,
    ).select_related('preferred_worker')
    if salon is not None:
        queryset = queryset.filter(salon=salon)
    elif worker is not None:
        queryset = queryset.filter(
            Q(preferred_worker=worker) | Q(time_slot__worker=worker),
        )
    else:
        return None

    last9 = digits[-9:]
    queryset = queryset.filter(phone__icontains=last9)
    service_key = normalize_service_key(service)
    for booking in queryset:
        if normalize_ke_phone_digits(booking.phone) != digits:
            continue
        if normalize_service_key(booking.service) == service_key:
            return booking
    return None


def duplicate_walk_in_message(booking) -> str:
    worker_name = _worker_display_name(booking.preferred_worker)
    date_label = booking.requested_date.isoformat() if booking.requested_date else 'that day'
    receipt = booking.mpesa_code or booking.record_code or f'#{booking.id}'
    return (
        f'{booking.service} for this phone is already on inventory for {date_label} '
        f'(logged by {worker_name}, {receipt}). '
        'Do not record the same cash visit again from owner and technician. '
        'Add a different service only if they took more than one.'
    )


def job_worker(booking):
    slot = getattr(booking, 'time_slot', None)
    if slot and slot.worker_id:
        return slot.worker
    return booking.preferred_worker


def salon_for_technician(worker):
    profile = getattr(worker, 'profile', None) if worker else None
    if not profile or is_freelance_technician(profile):
        return None
    if profile.salon_id:
        return profile.salon
    if profile.role == UserRole.SALON_OWNER:
        from .models import Salon

        return (
            Salon.objects.filter(owner_id=worker.id, is_active=True)
            .order_by('-is_primary', 'name')
            .first()
        )
    return None


def ensure_shared_job_fields(booking):
    """Keep technician and salon on the same booking both views read."""
    worker = job_worker(booking)
    updates = []
    if worker and booking.preferred_worker_id != worker.id:
        booking.preferred_worker = worker
        updates.append('preferred_worker')
    salon = salon_for_technician(worker)
    if salon and booking.salon_id != salon.id:
        booking.salon = salon
        updates.append('salon')
    return updates


def save_shared_job(booking, extra_fields=None):
    fields = []
    for field in list(extra_fields or []) + ensure_shared_job_fields(booking):
        if field not in fields:
            fields.append(field)
    if fields:
        booking.save(update_fields=fields)
    return fields


def attach_unsaloned_jobs_to_salon(worker, salon):
    from .models import Booking

    if not worker or not salon:
        return 0
    return Booking.objects.filter(
        Q(preferred_worker=worker) | Q(time_slot__worker=worker),
        salon__isnull=True,
    ).update(salon=salon)
