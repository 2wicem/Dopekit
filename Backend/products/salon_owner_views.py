import json

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .admin_views import _apply_salon_fields
from .auth_utils import user_to_dict
from .models import Salon, TechnicianApprovalStatus, UserProfile, UserRole
from .salon_owner_permissions import get_owned_salon, owned_salon_queryset, require_salon_owner
from .salon_utils import salon_to_dict, unique_slug
from .technician_utils import is_approved_technician

User = get_user_model()


def _owner_salon_to_dict(salon: Salon) -> dict:
    data = salon_to_dict(salon)
    staff = salon.staff_profiles.filter(role=UserRole.WORKER).select_related('user')
    data['technician_count'] = staff.count()
    data['technicians'] = [
        {
            'id': profile.user_id,
            'name': profile.user.first_name or profile.user.username,
            'phone': profile.phone,
            'specialty_label': profile.technician_specialty.replace('_', ' ').title()
            if profile.technician_specialty
            else None,
        }
        for profile in staff
        if is_approved_technician(profile)
    ]
    return data


def _staff_to_dict(profile: UserProfile) -> dict:
    user = profile.user
    return {
        'id': user.id,
        'name': user.first_name or user.username,
        'phone': profile.phone,
        'salon_id': profile.salon_id,
        'salon_name': profile.salon.name if profile.salon_id else None,
        'specialty_label': profile.technician_specialty.replace('_', ' ').title()
        if profile.technician_specialty
        else None,
        'is_approved': is_approved_technician(profile),
    }


@require_http_methods(['GET'])
def list_owner_salons(request):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    salons = owned_salon_queryset(owner).select_related('owner')
    return JsonResponse({'salons': [_owner_salon_to_dict(salon) for salon in salons]})


@csrf_exempt
@require_http_methods(['POST'])
def create_owner_salon(request):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    name = data.get('name', '').strip()
    if not name:
        return JsonResponse({'error': 'Branch name is required.'}, status=400)

    salon = Salon(
        owner=owner,
        name=name,
        slug=unique_slug(name),
        phone_primary=data.get('phone_primary', '').strip(),
        phone_secondary=data.get('phone_secondary', '').strip(),
        email=data.get('email', '').strip() or owner.email,
        location=data.get('location', '').strip(),
        services_summary=data.get('services_summary', '').strip(),
        page_lead=data.get('page_lead', '').strip(),
        instagram_url=data.get('instagram_url', '').strip(),
        facebook_url=data.get('facebook_url', '').strip(),
        tiktok_url=data.get('tiktok_url', '').strip(),
        whatsapp_url=data.get('whatsapp_url', '').strip(),
        is_active=True,
        is_primary=False,
    )

    error = _apply_salon_fields(salon, data)
    if error:
        return JsonResponse({'error': error}, status=400)

    salon.save()

    return JsonResponse(
        {
            'message': 'Branch created.',
            'salon': _owner_salon_to_dict(salon),
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(['PATCH'])
def update_owner_salon(request, salon_id):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    salon = get_owned_salon(owner, salon_id)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    if 'is_primary' in data:
        return JsonResponse({'error': 'Only platform admins can set the primary salon.'}, status=403)

    error = _apply_salon_fields(salon, data)
    if error:
        return JsonResponse({'error': error}, status=400)

    salon.save()

    return JsonResponse(
        {
            'message': 'Branch updated.',
            'salon': _owner_salon_to_dict(salon),
        }
    )


@require_http_methods(['GET'])
def list_owner_salon_staff(request, salon_id):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    salon = get_owned_salon(owner, salon_id)
    staff = (
        salon.staff_profiles.filter(role=UserRole.WORKER)
        .select_related('user', 'salon')
        .order_by('user__first_name', 'user__username')
    )

    return JsonResponse(
        {
            'salon': salon_to_dict(salon),
            'staff': [_staff_to_dict(profile) for profile in staff],
        }
    )


@require_http_methods(['GET'])
def list_assignable_technicians(request):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    owned_ids = list(owned_salon_queryset(owner).values_list('id', flat=True))
    technicians = (
        UserProfile.objects.filter(role=UserRole.WORKER)
        .select_related('user', 'salon')
        .order_by('user__first_name', 'user__username')
    )

    assignable = []
    for profile in technicians:
        if not is_approved_technician(profile):
            continue
        entry = _staff_to_dict(profile)
        entry['can_assign'] = profile.salon_id is None or profile.salon_id in owned_ids
        assignable.append(entry)

    return JsonResponse({'technicians': assignable})


@csrf_exempt
@require_http_methods(['PATCH'])
def assign_technician_salon(request, user_id):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    target = get_object_or_404(User.objects.select_related('profile', 'profile__salon'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if not profile or profile.role != UserRole.WORKER:
        return JsonResponse({'error': 'Technician not found.'}, status=404)
    if not is_approved_technician(profile):
        return JsonResponse({'error': 'Technician is not approved yet.'}, status=400)

    owned_ids = set(owned_salon_queryset(owner).values_list('id', flat=True))
    raw_salon_id = data.get('salon_id')

    if raw_salon_id in (None, '', 'null'):
        if profile.salon_id not in owned_ids:
            return JsonResponse({'error': 'You can only unassign technicians from your branches.'}, status=403)
        profile.salon = None
    else:
        try:
            salon_id = int(raw_salon_id)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Invalid salon.'}, status=400)
        if salon_id not in owned_ids:
            return JsonResponse({'error': 'You can only assign technicians to your branches.'}, status=403)
        if profile.salon_id and profile.salon_id not in owned_ids:
            return JsonResponse(
                {'error': 'This technician belongs to another salon. Ask a platform admin to move them.'},
                status=403,
            )
        profile.salon = get_object_or_404(Salon, pk=salon_id, owner=owner)

    profile.save(update_fields=['salon'])

    return JsonResponse(
        {
            'message': 'Technician branch updated.',
            'technician': _staff_to_dict(profile),
        }
    )


@require_http_methods(['GET'])
def owner_me(request):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    salons = owned_salon_queryset(owner)
    staff_count = UserProfile.objects.filter(
        role=UserRole.WORKER,
        salon_id__in=salons.values_list('id', flat=True),
    ).count()

    return JsonResponse(
        {
            'user': user_to_dict(owner),
            'branch_count': salons.count(),
            'technician_count': staff_count,
        }
    )
