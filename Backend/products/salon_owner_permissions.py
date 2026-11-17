from django.shortcuts import get_object_or_404

from .models import Salon, UserRole
from .technician_utils import is_approved_technician
from .views import _forbidden, _unauthorized


def require_salon_owner(request):
    if not request.user.is_authenticated:
        return None, _unauthorized()
    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role != UserRole.SALON_OWNER:
        return None, _forbidden('Salon owner access required.')
    return request.user, None


def owned_salon_queryset(user):
    return Salon.objects.filter(owner=user).order_by('name')


def get_owned_salon(user, salon_id):
    return get_object_or_404(owned_salon_queryset(user), pk=salon_id)


def owned_salon_ids(user):
    return list(owned_salon_queryset(user).values_list('id', flat=True))


def booking_in_owned_salons(user, booking) -> bool:
    salon_ids = set(owned_salon_ids(user))
    if not salon_ids:
        return False
    if booking.salon_id in salon_ids:
        return True
    slot = getattr(booking, 'time_slot', None)
    worker = slot.worker if slot else booking.preferred_worker
    profile = getattr(worker, 'profile', None) if worker else None
    return bool(profile and profile.salon_id in salon_ids)


def technician_on_owned_salon(user, worker, salon_id=None) -> bool:
    profile = getattr(worker, 'profile', None)
    if not profile or not is_approved_technician(profile):
        return False
    salon_ids = set(owned_salon_ids(user))
    if profile.salon_id not in salon_ids:
        return False
    if salon_id is not None and profile.salon_id != salon_id:
        return False
    return True
