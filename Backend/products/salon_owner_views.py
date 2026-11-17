import json

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .admin_views import _apply_salon_fields
from .auth_utils import user_to_dict
from .models import Salon, TechnicianApprovalStatus, UserProfile, UserRole
from .salon_owner_permissions import get_owned_salon, owned_salon_queryset, require_salon_owner
from .salon_utils import ensure_salon_invite_code, salon_to_dict, unique_slug
from .technician_utils import (
    forward_technician_to_admin,
    is_approved_technician,
    is_pending_owner_review,
    reject_technician,
)
from .technician_verification import technician_application_to_dict
from .notifications import notify_technician_application

User = get_user_model()


def _owner_salon_to_dict(salon: Salon) -> dict:
    data = salon_to_dict(salon, include_invite_code=True)
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
    ensure_salon_invite_code(salon)

    return JsonResponse(
        {
            'message': 'Branch created.',
            'salon': _owner_salon_to_dict(salon),
        },
        status=201,
    )


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
        profile.technician_is_freelance = True
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
        profile.technician_is_freelance = False

    profile.save(update_fields=['salon', 'technician_is_freelance'])
    if profile.salon_id:
        from .booking_utils import attach_unsaloned_jobs_to_salon

        attach_unsaloned_jobs_to_salon(target, profile.salon)

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


def _application_to_dict(user):
    profile = user.profile
    application = technician_application_to_dict(profile)
    return {
        'id': user.id,
        'name': user.first_name or user.username,
        'email': user.email,
        'phone': profile.phone,
        'date_joined': user.date_joined.isoformat(),
        'technician_application': application,
    }


@require_http_methods(['GET'])
def list_owner_applications(request):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    owned_ids = list(owned_salon_queryset(owner).values_list('id', flat=True))
    users = (
        User.objects.filter(
            profile__technician_approval=TechnicianApprovalStatus.PENDING_OWNER,
            profile__technician_application_salon_id__in=owned_ids,
        )
        .select_related('profile', 'profile__technician_application_salon')
        .order_by('-date_joined')[:100]
    )
    return JsonResponse({'applications': [_application_to_dict(user) for user in users]})


@require_http_methods(['POST'])
def approve_owner_application(request, user_id):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    owned_ids = set(owned_salon_queryset(owner).values_list('id', flat=True))
    target = get_object_or_404(
        User.objects.select_related('profile', 'profile__technician_application_salon'),
        pk=user_id,
    )
    profile = getattr(target, 'profile', None)
    if (
        not profile
        or not is_pending_owner_review(profile)
        or profile.technician_application_salon_id not in owned_ids
    ):
        return JsonResponse({'error': 'Application not found.'}, status=404)

    forward_technician_to_admin(profile)
    try:
        notify_technician_application(target)
    except Exception:
        pass

    return JsonResponse(
        {
            'message': 'Application forwarded to platform admin for final approval.',
            'application': _application_to_dict(target),
        }
    )


@require_http_methods(['POST'])
def reject_owner_application(request, user_id):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    owned_ids = set(owned_salon_queryset(owner).values_list('id', flat=True))
    target = get_object_or_404(User.objects.select_related('profile'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if (
        not profile
        or not is_pending_owner_review(profile)
        or profile.technician_application_salon_id not in owned_ids
    ):
        return JsonResponse({'error': 'Application not found.'}, status=404)

    reject_technician(profile)
    return JsonResponse({'message': 'Application rejected.', 'application': _application_to_dict(target)})


@require_http_methods(['POST'])
def regenerate_salon_invite_code(request, salon_id):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    salon = get_owned_salon(owner, salon_id)
    from .salon_utils import generate_salon_invite_code

    salon.technician_invite_code = generate_salon_invite_code()
    salon.save(update_fields=['technician_invite_code'])

    return JsonResponse(
        {
            'message': 'Invite code regenerated.',
            'salon': _owner_salon_to_dict(salon),
        }
    )


@require_http_methods(['GET'])
def owner_daily_payments(request):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    from collections import defaultdict

    from django.utils import timezone

    from .inventory_views import _booking_appointment_date, _booking_worker_name, _price_for_booking
    from .models import Booking, BookingStatus, PaymentMethod
    from .payment_utils import collected_amount
    from .report_views import _appointment_date_filter, _parse_date_range

    date_from, date_to = _parse_date_range(request)
    owned_ids = list(owned_salon_queryset(owner).values_list('id', flat=True))
    raw_salon = request.GET.get('salon_id', '').strip()
    salon_id = None
    if raw_salon:
        try:
            salon_id = int(raw_salon)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Invalid salon.'}, status=400)
        if salon_id not in owned_ids:
            return JsonResponse({'error': 'You can only view payments for your branches.'}, status=403)

    salon_ids = [salon_id] if salon_id else owned_ids
    bookings = (
        Booking.objects.filter(
            _appointment_date_filter(date_from, date_to),
            status=BookingStatus.COMPLETED,
            salon_id__in=salon_ids,
        )
        .select_related('time_slot__worker', 'preferred_worker', 'salon')
        .order_by('id')
    )

    days_map = defaultdict(
        lambda: {
            'jobs': 0,
            'cash_kes': 0,
            'bank_kes': 0,
            'unpaid_kes': 0,
            'by_worker': defaultdict(
                lambda: {'jobs': 0, 'cash_kes': 0, 'bank_kes': 0, 'unpaid_kes': 0}
            ),
            'payments': [],
        }
    )

    for booking in bookings:
        day = _booking_appointment_date(booking)
        if day is None:
            continue
        price = _price_for_booking(booking)
        amount = collected_amount(booking, price)
        method = booking.payment_method or ''
        worker_name = _booking_worker_name(booking)
        bucket = days_map[day.isoformat()]
        bucket['jobs'] += 1
        worker = bucket['by_worker'][worker_name]
        worker['jobs'] += 1
        if method == PaymentMethod.CASH:
            bucket['cash_kes'] += amount
            worker['cash_kes'] += amount
        elif method == PaymentMethod.BANK:
            bucket['bank_kes'] += amount
            worker['bank_kes'] += amount
        else:
            bucket['unpaid_kes'] += amount
            worker['unpaid_kes'] += amount

        bucket['payments'].append(
            {
                'booking_id': booking.id,
                'client_name': booking.name,
                'service': booking.service or '—',
                'worker_name': worker_name,
                'salon_name': booking.salon.name if booking.salon_id else '—',
                'payment_method': method,
                'payment_method_label': (
                    booking.get_payment_method_display() if method else 'Not recorded'
                ),
                'amount_kes': amount,
                'is_walk_in': bool(booking.is_walk_in),
            }
        )

    days = []
    cursor = date_from
    from datetime import timedelta

    while cursor <= date_to:
        key = cursor.isoformat()
        bucket = days_map[key]
        days.append(
            {
                'date': key,
                'jobs': bucket['jobs'],
                'cash_kes': bucket['cash_kes'],
                'bank_kes': bucket['bank_kes'],
                'unpaid_kes': bucket['unpaid_kes'],
                'collected_kes': bucket['cash_kes'] + bucket['bank_kes'],
                'by_worker': [
                    {
                        'worker_name': name,
                        'jobs': stats['jobs'],
                        'cash_kes': stats['cash_kes'],
                        'bank_kes': stats['bank_kes'],
                        'unpaid_kes': stats['unpaid_kes'],
                        'collected_kes': stats['cash_kes'] + stats['bank_kes'],
                    }
                    for name, stats in sorted(
                        bucket['by_worker'].items(),
                        key=lambda item: (-item[1]['cash_kes'] - item[1]['bank_kes'], item[0]),
                    )
                ],
                'payments': bucket['payments'],
            }
        )
        cursor += timedelta(days=1)

    totals = {
        'jobs': sum(day['jobs'] for day in days),
        'cash_kes': sum(day['cash_kes'] for day in days),
        'bank_kes': sum(day['bank_kes'] for day in days),
        'unpaid_kes': sum(day['unpaid_kes'] for day in days),
        'collected_kes': sum(day['collected_kes'] for day in days),
    }

    return JsonResponse(
        {
            'from': date_from.isoformat(),
            'to': date_to.isoformat(),
            'generated_at': timezone.now().isoformat(),
            'totals': totals,
            'days': [day for day in days if day['jobs'] > 0],
        }
    )
