"""Premium daily inventory access (salon marketing feature)."""

from django.http import JsonResponse

from .models import UserRole
from .salon_utils import parse_admin_salon_id
from .views import _forbidden, _unauthorized
from .worker_permissions import require_approved_worker


def has_premium_inventory_access(user) -> bool:
    if not user or not user.is_authenticated:
        return False
    profile = getattr(user, 'profile', None)
    if not profile:
        return user.is_superuser
    if profile.role == UserRole.ADMIN:
        return True
    if profile.role == UserRole.WORKER:
        return bool(profile.premium_inventory_access)
    return False


def inventory_salon_scope(request, profile):
    """
    Salon-wide inventory when admin filters a branch or a premium technician
    has a home salon; otherwise personal technician scope.
    """
    if profile.role == UserRole.ADMIN:
        return parse_admin_salon_id(request)
    if (
        profile.role == UserRole.WORKER
        and profile.premium_inventory_access
        and profile.salon_id
    ):
        return profile.salon_id
    return None


def require_premium_inventory(request):
    if not request.user.is_authenticated:
        return None, _unauthorized()

    profile = getattr(request.user, 'profile', None)
    if not profile:
        return None, _forbidden('Profile required.')

    if profile.role == UserRole.ADMIN:
        return profile, None

    if profile.role == UserRole.WORKER:
        if not profile.premium_inventory_access:
            return None, JsonResponse(
                {
                    'error': (
                        'Daily inventory is a premium feature. '
                        'Ask your salon admin to enable it for your account.'
                    ),
                    'code': 'premium_inventory_required',
                },
                status=403,
            )
        _, denied = require_approved_worker(request)
        if denied:
            return None, denied
        return profile, None

    return None, _forbidden('Only technicians and admins can view daily inventory.')
