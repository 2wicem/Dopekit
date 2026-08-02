from django.shortcuts import get_object_or_404

from .models import Salon, UserRole
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
