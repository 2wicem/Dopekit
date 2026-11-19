from django.db.models import Q

from .models import UserRole
from .technician_utils import is_freelance_technician


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
