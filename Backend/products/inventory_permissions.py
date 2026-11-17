"""Staff daily inventory vs expense tracking."""

from django.http import JsonResponse

from .models import UserRole
from .salon_utils import parse_admin_salon_id
from .technician_utils import is_freelance_technician
from .views import _forbidden, _unauthorized
from .worker_permissions import require_approved_worker


def can_record_expenses(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    profile = getattr(user, 'profile', None)
    if not profile:
        return False
    if profile.role == UserRole.SALON_OWNER:
        return True
    if profile.role == UserRole.WORKER:
        return is_freelance_technician(profile)
    return False


def has_premium_inventory_access(user) -> bool:
    return can_record_expenses(user)


def inventory_salon_scope(request, profile):
    """
    Salon-wide inventory for admin/owner. Technicians always see their own jobs
    on the same booking records the owner reads.
    """
    if profile.role == UserRole.ADMIN:
        return parse_admin_salon_id(request)
    if profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        requested = parse_admin_salon_id(request)
        ids = owned_salon_ids(request.user)
        if requested:
            return requested if requested in ids else None
        if len(ids) == 1:
            return ids[0]
        return None
    return None


def require_staff_inventory(request):
    """Technicians, salon owners, and admins can view the shared job list."""
    if not request.user.is_authenticated:
        return None, _unauthorized()

    profile = getattr(request.user, 'profile', None)
    if not profile:
        return None, _forbidden('Profile required.')

    if profile.role in (UserRole.ADMIN, UserRole.SALON_OWNER):
        return profile, None

    if profile.role == UserRole.WORKER:
        _, denied = require_approved_worker(request)
        if denied:
            return None, denied
        return profile, None

    return None, _forbidden('Only technicians, salon owners, and admins can view daily inventory.')


def require_expense_access(request):
    if not request.user.is_authenticated:
        return None, _unauthorized()

    profile = getattr(request.user, 'profile', None)
    if not profile:
        return None, _forbidden('Profile required.')

    if not can_record_expenses(request.user):
        return None, JsonResponse(
            {
                'error': 'Only freelance technicians and salon owners can record expenses.',
                'code': 'expense_access_required',
            },
            status=403,
        )

    if profile.role == UserRole.WORKER:
        _, denied = require_approved_worker(request)
        if denied:
            return None, denied

    return profile, None


def require_premium_inventory(request):
    return require_expense_access(request)
