import json
import logging
import re
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .auth_utils import user_to_dict
from .inventory_permissions import require_staff_inventory
from .models import (
    Booking,
    BookingStatus,
    ContactMessage,
    Salon,
    SalonContactInfo,
    ServiceVenue,
    SlotStatus,
    TechnicianApprovalStatus,
    TimeSlot,
    UserProfile,
    UserRole,
)
from .notifications import schedule_booking_created_notification
from .contact_views import _salon_contact_to_dict
from .geo_utils import parse_coordinate, resolve_coordinates, validate_latitude, validate_longitude
from .salon_utils import (
    assign_primary_salon,
    ensure_salon_invite_code,
    filter_bookings_by_salon,
    get_primary_salon,
    parse_admin_salon_id,
    resolve_salon_id,
    salon_to_dict,
    unique_slug,
)
from .password_utils import password_strength_error
from .slot_utils import SLOT_HOURS, ensure_default_available_slots
from .slot_views import _day_kind, _merge_day_slots, _unslotted_walk_ins
from .technician_utils import (
    auto_approve_technician,
    is_approved_technician,
    is_pending_admin_review,
    reject_technician,
)
from .technician_verification import technician_application_to_dict
from .technician_showcase import normalize_rating_average, parse_portfolio_urls, portfolio_urls_to_text
from .service_prices import resolve_service_price_kes
from .views import _booking_to_dict, _forbidden, _unauthorized

User = get_user_model()
logger = logging.getLogger(__name__)


def _require_admin(request):
    if not request.user.is_authenticated:
        return _unauthorized()
    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role != UserRole.ADMIN:
        return _forbidden('Admin access required.')
    return None


def _admin_user_to_dict(user):
    data = user_to_dict(user)
    data['id'] = user.id
    data['date_joined'] = user.date_joined.isoformat()
    profile = getattr(user, 'profile', None)
    if profile:
        data['salon_id'] = profile.salon_id
        data['premium_inventory_access'] = bool(profile.premium_inventory_access)
        data['technician_is_freelance'] = bool(profile.technician_is_freelance or not profile.salon_id)
        salon = getattr(profile, 'salon', None)
        data['salon_name'] = salon.name if salon else None
        if profile and is_pending_admin_review(profile):
            data['technician_application'] = technician_application_to_dict(profile)
    return data


@require_http_methods(['GET'])
def stats(request):
    denied = _require_admin(request)
    if denied:
        return denied

    role_counts = (
        UserProfile.objects.values('role')
        .annotate(count=Count('id'))
        .order_by('role')
    )
    counts_by_role = {row['role']: row['count'] for row in role_counts}

    salon_id = parse_admin_salon_id(request)
    bookings_qs = filter_bookings_by_salon(Booking.objects.all(), salon_id)

    return JsonResponse(
        {
            'total_bookings': bookings_qs.count(),
            'pending_bookings': bookings_qs.filter(status='pending').count(),
            'total_messages': ContactMessage.objects.count(),
            'total_users': User.objects.count(),
            'clients': counts_by_role.get(UserRole.CLIENT, 0),
            'workers': counts_by_role.get(UserRole.WORKER, 0),
            'admins': counts_by_role.get(UserRole.ADMIN, 0),
            'pending_technicians': UserProfile.objects.filter(
                technician_approval__in=(
                    TechnicianApprovalStatus.PENDING_ADMIN,
                    TechnicianApprovalStatus.PENDING,
                )
            ).count(),
            'salon_id': salon_id,
        }
    )


@require_http_methods(['GET'])
def list_users(request):
    denied = _require_admin(request)
    if denied:
        return denied

    users = User.objects.select_related('profile', 'profile__salon').order_by('-date_joined')[:200]
    return JsonResponse({'users': [_admin_user_to_dict(user) for user in users]})


def _contact_message_to_dict(message):
    data = {
        'id': message.id,
        'name': message.name,
        'phone': message.phone,
        'email': message.email,
        'message': message.message,
        'created_at': message.created_at.isoformat(),
    }
    if message.user_id:
        data['user'] = {
            'id': message.user_id,
            'email': message.user.email,
            'name': message.user.first_name or message.user.username,
        }
    return data


@require_http_methods(['GET'])
def list_contact_messages(request):
    denied = _require_admin(request)
    if denied:
        return denied

    messages = ContactMessage.objects.select_related('user').order_by('-created_at')[:200]
    return JsonResponse({'messages': [_contact_message_to_dict(item) for item in messages]})


@require_http_methods(['GET'])
def get_salon_contact_info(request):
    denied = _require_admin(request)
    if denied:
        return denied

    return JsonResponse({'contact_info': _salon_contact_to_dict(SalonContactInfo.load())})


@require_http_methods(['PATCH'])
def update_salon_contact_info(request):
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    info = SalonContactInfo.load()

    if 'phone_primary' in data:
        info.phone_primary = data.get('phone_primary', '').strip()
    if 'phone_secondary' in data:
        info.phone_secondary = data.get('phone_secondary', '').strip()
    if 'email' in data:
        info.email = data.get('email', '').strip()
    if 'location' in data:
        info.location = data.get('location', '').strip()
    if 'services_summary' in data:
        info.services_summary = data.get('services_summary', '').strip()
    if 'page_lead' in data:
        info.page_lead = data.get('page_lead', '').strip()

    if not info.phone_primary:
        return JsonResponse({'error': 'Primary phone is required.'}, status=400)
    if not info.email:
        return JsonResponse({'error': 'Email is required.'}, status=400)
    if not info.location:
        return JsonResponse({'error': 'Location is required.'}, status=400)

    info.save()

    return JsonResponse(
        {
            'message': 'Contact information updated.',
            'contact_info': _salon_contact_to_dict(info),
        }
    )


@require_http_methods(['PATCH'])
def update_user_role(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    role = data.get('role', '').strip().lower()
    valid_roles = {choice[0] for choice in UserRole.choices}
    if role not in valid_roles:
        return JsonResponse({'error': 'Invalid role.'}, status=400)

    target = get_object_or_404(User, pk=user_id)

    if target.id == request.user.id and role != UserRole.ADMIN:
        return JsonResponse({'error': 'You cannot remove your own admin role.'}, status=400)

    profile, _ = UserProfile.objects.get_or_create(
        user=target,
        defaults={'phone': '', 'role': UserRole.CLIENT},
    )
    profile.role = role
    if role == UserRole.WORKER:
        profile.technician_approval = TechnicianApprovalStatus.APPROVED
    elif role == UserRole.ADMIN:
        profile.technician_approval = TechnicianApprovalStatus.NOT_APPLICABLE
    elif role == UserRole.SALON_OWNER:
        profile.technician_approval = TechnicianApprovalStatus.NOT_APPLICABLE
        profile.salon = None
    elif profile.technician_approval in (
        TechnicianApprovalStatus.PENDING,
        TechnicianApprovalStatus.APPROVED,
        TechnicianApprovalStatus.REJECTED,
    ):
        profile.technician_approval = TechnicianApprovalStatus.NOT_APPLICABLE
    profile.save()

    return JsonResponse(
        {
            'message': 'Role updated successfully.',
            'user': _admin_user_to_dict(target),
        }
    )


@require_http_methods(['PATCH'])
def update_technician_showcase(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    target = get_object_or_404(User.objects.select_related('profile', 'profile__salon'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if not profile or profile.role not in (UserRole.WORKER, UserRole.ADMIN):
        return JsonResponse({'error': 'Showcase can only be updated for technicians.'}, status=400)

    update_fields = []

    if 'technician_work_summary' in data:
        work_summary = data.get('technician_work_summary', '').strip()
        if len(work_summary) > 500:
            return JsonResponse({'error': 'Work summary is too long (max 500 characters).'}, status=400)
        profile.technician_work_summary = work_summary
        update_fields.append('technician_work_summary')

    if 'technician_portfolio_urls' in data:
        raw_portfolio = data.get('technician_portfolio_urls', '')
        if isinstance(raw_portfolio, list):
            portfolio_text = portfolio_urls_to_text(raw_portfolio)
        else:
            portfolio_text = portfolio_urls_to_text(str(raw_portfolio or ''))
        if len(portfolio_text) > 2000:
            return JsonResponse({'error': 'Portfolio list is too long (max 2000 characters).'}, status=400)
        profile.technician_portfolio_urls = portfolio_text
        update_fields.append('technician_portfolio_urls')

    if 'technician_rating_average' in data:
        rating_average = normalize_rating_average(data.get('technician_rating_average'))
        if data.get('technician_rating_average') not in (None, '') and rating_average is None:
            return JsonResponse({'error': 'Rating must be between 0 and 5.'}, status=400)
        profile.technician_rating_average = rating_average
        update_fields.append('technician_rating_average')

    if 'technician_rating_count' in data:
        try:
            rating_count = int(data.get('technician_rating_count') or 0)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Rating count must be a number.'}, status=400)
        if rating_count < 0 or rating_count > 10000:
            return JsonResponse({'error': 'Rating count is out of range.'}, status=400)
        profile.technician_rating_count = rating_count
        update_fields.append('technician_rating_count')

    if not update_fields:
        return JsonResponse({'error': 'No showcase fields to update.'}, status=400)

    profile.save(update_fields=update_fields)

    return JsonResponse(
        {
            'message': 'Technician showcase updated.',
            'user': _admin_user_to_dict(target),
        }
    )


@require_http_methods(['PATCH'])
def update_user_premium_inventory(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    if 'premium_inventory_access' not in data:
        return JsonResponse({'error': 'premium_inventory_access is required.'}, status=400)

    enabled = data.get('premium_inventory_access')
    if not isinstance(enabled, bool):
        return JsonResponse({'error': 'premium_inventory_access must be true or false.'}, status=400)

    target = get_object_or_404(User.objects.select_related('profile', 'profile__salon'), pk=user_id)
    profile, _ = UserProfile.objects.get_or_create(
        user=target,
        defaults={'phone': '', 'role': UserRole.CLIENT},
    )

    if profile.role not in (UserRole.WORKER, UserRole.ADMIN):
        return JsonResponse(
            {'error': 'Premium inventory is only for technician accounts.'},
            status=400,
        )

    profile.premium_inventory_access = enabled
    profile.save(update_fields=['premium_inventory_access'])

    return JsonResponse(
        {
            'message': 'Premium inventory access updated.',
            'user': _admin_user_to_dict(target),
        }
    )


@require_http_methods(['PATCH'])
def update_user_salon(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    target = get_object_or_404(User.objects.select_related('profile', 'profile__salon'), pk=user_id)
    profile, _ = UserProfile.objects.get_or_create(
        user=target,
        defaults={'phone': '', 'role': UserRole.CLIENT},
    )

    raw_salon_id = data.get('salon_id')
    if raw_salon_id in (None, '', 'null'):
        profile.salon = None
        if profile.role == UserRole.WORKER:
            profile.technician_is_freelance = True
    else:
        try:
            salon = Salon.objects.get(pk=int(raw_salon_id), is_active=True)
        except (Salon.DoesNotExist, TypeError, ValueError):
            return JsonResponse({'error': 'Invalid salon.'}, status=400)
        profile.salon = salon
        if profile.role == UserRole.WORKER:
            profile.technician_is_freelance = False

    profile.save(update_fields=['salon', 'technician_is_freelance'] if profile.role == UserRole.WORKER else ['salon'])
    if profile.salon_id and profile.role == UserRole.WORKER:
        from .booking_utils import attach_unsaloned_jobs_to_salon

        attach_unsaloned_jobs_to_salon(target, profile.salon)

    return JsonResponse(
        {
            'message': 'Home salon updated.',
            'user': _admin_user_to_dict(target),
        }
    )


@require_http_methods(['POST'])
def create_walk_in_booking(request):
    profile, denied = require_staff_inventory(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    name = data.get('name', '').strip()
    phone = data.get('phone', '').strip()
    service = data.get('service', '').strip()
    venue = data.get('venue', ServiceVenue.INDOOR).strip().lower()
    requested_date_raw = data.get('requested_date', '').strip()
    location = data.get('location', '').strip()
    salon_id = resolve_salon_id(data.get('salon_id'))

    if not name or not phone:
        return JsonResponse({'error': 'Name and phone are required.'}, status=400)

    if venue not in (ServiceVenue.INDOOR, ServiceVenue.OUTDOOR):
        return JsonResponse({'error': 'Please choose indoor or outdoor service.'}, status=400)

    preferred_worker = None
    salon = None
    if profile.role == UserRole.WORKER:
        preferred_worker = request.user
        salon = getattr(profile, 'salon', None)
    elif profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids, technician_on_owned_salon

        owned_ids = owned_salon_ids(request.user)
        if salon_id not in owned_ids:
            if len(owned_ids) == 1:
                salon_id = owned_ids[0]
            else:
                return JsonResponse(
                    {'error': 'Choose one of your salon branches for this walk-in.'},
                    status=400,
                )
        salon = Salon.objects.filter(pk=salon_id, is_active=True).first()
        if salon is None:
            return JsonResponse({'error': 'Salon not found.'}, status=404)

        raw_worker_id = data.get('preferred_worker_id') or data.get('technician_id')
        try:
            worker_id = int(raw_worker_id)
        except (TypeError, ValueError):
            return JsonResponse(
                {'error': 'Choose the technician who did this service.'},
                status=400,
            )
        preferred_worker = (
            User.objects.filter(pk=worker_id).select_related('profile', 'profile__salon').first()
        )
        if not preferred_worker or not technician_on_owned_salon(
            request.user,
            preferred_worker,
            salon.id,
        ):
            return JsonResponse(
                {'error': 'Choose a technician who works at this salon.'},
                status=400,
            )
    else:
        if salon_id:
            salon = Salon.objects.filter(pk=salon_id, is_active=True).first()
        if salon is None:
            salon = get_primary_salon()

    if venue == ServiceVenue.INDOOR:
        if salon:
            location = salon.location
        elif (profile.default_location or '').strip():
            location = profile.default_location.strip()
        else:
            location = settings.SALON_LOCATION
    elif not location:
        return JsonResponse({'error': 'Please enter an address for outdoor service.'}, status=400)

    requested_date = parse_date(requested_date_raw)
    if not requested_date:
        return JsonResponse({'error': 'Please choose an appointment date.'}, status=400)
    today = timezone.localdate()
    if requested_date > today:
        return JsonResponse({'error': 'Use today or an earlier date for work already done.'}, status=400)
    if requested_date < today - timedelta(days=30):
        return JsonResponse({'error': 'Walk-ins can be backdated up to 30 days.'}, status=400)

    service_price_kes = resolve_service_price_kes(
        service,
        data.get('service_price_kes'),
    )

    from .payment_utils import apply_client_payment, parse_payment_fields

    payment, payment_error = parse_payment_fields(
        data,
        default_amount=service_price_kes,
        required=True,
    )
    if payment_error:
        return JsonResponse({'error': payment_error}, status=400)

    booking = Booking.objects.create(
        user=None,
        name=name,
        phone=phone,
        location=location,
        service=service,
        service_price_kes=service_price_kes,
        venue=venue,
        requested_date=requested_date,
        preferred_worker=preferred_worker,
        salon=salon,
        status=BookingStatus.COMPLETED,
        is_walk_in=True,
    )
    apply_client_payment(booking, payment)
    from .booking_utils import save_shared_job

    save_shared_job(booking, extra_fields=['payment_method', 'payment_amount_kes', 'paid_at'])

    schedule_booking_created_notification(booking.id)

    return JsonResponse(
        {
            'message': 'Walk-in booking added.',
            'booking': _booking_to_dict(booking),
        },
        status=201,
    )


@require_http_methods(['DELETE'])
def delete_booking(request, booking_id):
    denied = _require_admin(request)
    if denied:
        return denied

    booking = get_object_or_404(Booking, pk=booking_id)
    TimeSlot.objects.filter(booking=booking).update(
        status=SlotStatus.AVAILABLE,
        booking=None,
    )
    booking.delete()

    return JsonResponse({'message': 'Booking deleted successfully.'})


@require_http_methods(['GET'])
def list_pending_technicians(request):
    denied = _require_admin(request)
    if denied:
        return denied

    users = (
        User.objects.filter(
            profile__technician_approval__in=(
                TechnicianApprovalStatus.PENDING_ADMIN,
                TechnicianApprovalStatus.PENDING,
            )
        )
        .select_related('profile', 'profile__technician_application_salon')
        .order_by('-date_joined')[:100]
    )
    return JsonResponse({'technicians': [_admin_user_to_dict(user) for user in users]})


@require_http_methods(['POST'])
def approve_technician(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    target = get_object_or_404(User.objects.select_related('profile'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if not profile or not is_pending_admin_review(profile):
        return JsonResponse({'error': 'No pending technician application for this user.'}, status=400)

    auto_approve_technician(profile)

    return JsonResponse(
        {
            'message': 'Technician approved.',
            'user': _admin_user_to_dict(target),
        }
    )


@require_http_methods(['POST'])
def reject_technician_view(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    target = get_object_or_404(User.objects.select_related('profile'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if not profile or not is_pending_admin_review(profile):
        return JsonResponse({'error': 'No pending technician application for this user.'}, status=400)

    reject_technician(profile)

    return JsonResponse(
        {
            'message': 'Technician application rejected.',
            'user': _admin_user_to_dict(target),
        }
    )


def _apply_salon_fields(salon: Salon, data: dict) -> str | None:
    if 'name' in data:
        name = data.get('name', '').strip()
        if not name:
            return 'Salon name is required.'
        salon.name = name

    if 'phone_primary' in data:
        salon.phone_primary = data.get('phone_primary', '').strip()
    if 'phone_secondary' in data:
        salon.phone_secondary = data.get('phone_secondary', '').strip()
    if 'email' in data:
        salon.email = data.get('email', '').strip()
    if 'location' in data:
        salon.location = data.get('location', '').strip()
    latitude_provided = 'latitude' in data and data.get('latitude') not in (None, '')
    longitude_provided = 'longitude' in data and data.get('longitude') not in (None, '')
    if 'latitude' in data:
        latitude = validate_latitude(parse_coordinate(data.get('latitude')))
        if data.get('latitude') not in (None, '') and latitude is None:
            return 'Enter a valid latitude between -90 and 90.'
        salon.latitude = latitude
    if 'longitude' in data:
        longitude = validate_longitude(parse_coordinate(data.get('longitude')))
        if data.get('longitude') not in (None, '') and longitude is None:
            return 'Enter a valid longitude between -180 and 180.'
        salon.longitude = longitude
    if 'services_summary' in data:
        salon.services_summary = data.get('services_summary', '').strip()
    if 'page_lead' in data:
        salon.page_lead = data.get('page_lead', '').strip()
    if 'instagram_url' in data:
        salon.instagram_url = data.get('instagram_url', '').strip()
    if 'facebook_url' in data:
        salon.facebook_url = data.get('facebook_url', '').strip()
    if 'tiktok_url' in data:
        salon.tiktok_url = data.get('tiktok_url', '').strip()
    if 'whatsapp_url' in data:
        salon.whatsapp_url = data.get('whatsapp_url', '').strip()
    if 'is_active' in data:
        salon.is_active = bool(data.get('is_active'))

    if not salon.phone_primary:
        return 'Primary phone is required.'
    if not salon.email:
        return 'Email is required.'
    if not salon.location:
        return 'Location is required.'

    has_manual_coords = (
        latitude_provided
        and longitude_provided
        and salon.latitude is not None
        and salon.longitude is not None
    )
    needs_coordinates = (
        not has_manual_coords
        and (
            salon.latitude is None
            or salon.longitude is None
            or 'location' in data
        )
    )
    if needs_coordinates:
        try:
            salon.latitude, salon.longitude, geo_error = resolve_coordinates(
                location=salon.location,
                latitude=salon.latitude,
                longitude=salon.longitude,
            )
        except Exception:
            logger.exception('Geocoding failed while saving salon %s', salon.name)
            geo_error = None
        if geo_error:
            logger.warning('Geocoding skipped for %s: %s', salon.name, geo_error)

    return None


@require_http_methods(['GET'])
def list_salons(request):
    denied = _require_admin(request)
    if denied:
        return denied

    salons = Salon.objects.select_related('owner').order_by('name')
    return JsonResponse(
        {'salons': [salon_to_dict(salon, include_owner=True, include_invite_code=True) for salon in salons]}
    )


@require_http_methods(['POST'])
def create_salon(request):
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    name = data.get('name', '').strip()
    if not name:
        return JsonResponse({'error': 'Salon name is required.'}, status=400)

    salon = Salon(
        name=name,
        slug=unique_slug(name),
        phone_primary=data.get('phone_primary', '').strip(),
        phone_secondary=data.get('phone_secondary', '').strip(),
        email=data.get('email', '').strip(),
        location=data.get('location', '').strip(),
        services_summary=data.get('services_summary', '').strip(),
        page_lead=data.get('page_lead', '').strip(),
        instagram_url=data.get('instagram_url', '').strip(),
        facebook_url=data.get('facebook_url', '').strip(),
        tiktok_url=data.get('tiktok_url', '').strip(),
        whatsapp_url=data.get('whatsapp_url', '').strip(),
        is_active=True,
        is_primary=not Salon.objects.filter(is_primary=True).exists(),
    )

    try:
        error = _apply_salon_fields(salon, data)
        if error:
            return JsonResponse({'error': error}, status=400)

        salon.save()
        if data.get('is_primary'):
            assign_primary_salon(salon)

        ensure_salon_invite_code(salon)
    except Exception:
        logger.exception('Failed to create salon')
        return JsonResponse({'error': 'Could not save salon. Try again.'}, status=500)

    raw_owner_id = data.get('owner_id')
    if raw_owner_id not in (None, '', 'null'):
        try:
            owner = User.objects.select_related('profile').get(pk=int(raw_owner_id))
        except (User.DoesNotExist, TypeError, ValueError):
            return JsonResponse({'error': 'Invalid salon owner.'}, status=400)
        owner_profile = getattr(owner, 'profile', None)
        if not owner_profile or owner_profile.role != UserRole.SALON_OWNER:
            return JsonResponse({'error': 'Selected user is not a salon owner.'}, status=400)
        salon.owner = owner
        salon.save(update_fields=['owner'])

    return JsonResponse(
        {
            'message': 'Salon created.',
            'salon': salon_to_dict(salon, include_owner=True, include_invite_code=True),
        },
        status=201,
    )


@require_http_methods(['PATCH', 'DELETE'])
def update_salon(request, salon_id):
    denied = _require_admin(request)
    if denied:
        return denied

    salon = get_object_or_404(Salon, pk=salon_id)

    if request.method == 'DELETE':
        was_primary = salon.is_primary
        name = salon.name
        salon.delete()
        if was_primary:
            replacement = (
                Salon.objects.filter(is_active=True).order_by('id').first()
                or Salon.objects.order_by('id').first()
            )
            if replacement:
                assign_primary_salon(replacement)
        return JsonResponse({'message': f'{name} was deleted.'})

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    try:
        error = _apply_salon_fields(salon, data)
        if error:
            return JsonResponse({'error': error}, status=400)

        if data.get('is_primary'):
            assign_primary_salon(salon)

        if 'owner_id' in data:
            raw_owner_id = data.get('owner_id')
            if raw_owner_id in (None, '', 'null'):
                salon.owner = None
            else:
                try:
                    owner = User.objects.select_related('profile').get(pk=int(raw_owner_id))
                except (User.DoesNotExist, TypeError, ValueError):
                    return JsonResponse({'error': 'Invalid salon owner.'}, status=400)
                owner_profile = getattr(owner, 'profile', None)
                if not owner_profile or owner_profile.role != UserRole.SALON_OWNER:
                    return JsonResponse({'error': 'Selected user is not a salon owner.'}, status=400)
                salon.owner = owner

        salon.save()
    except Exception:
        logger.exception('Failed to update salon %s', salon_id)
        return JsonResponse({'error': 'Could not save salon. Try again.'}, status=500)

    return JsonResponse(
        {
            'message': 'Salon updated.',
            'salon': salon_to_dict(salon, include_owner=True, include_invite_code=True),
        }
    )


def _unique_username(base: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9._-]', '', (base or '').strip())[:24] or 'tech'
    candidate = cleaned
    suffix = 1
    while User.objects.filter(username__iexact=candidate).exists():
        suffix += 1
        candidate = f'{cleaned}{suffix}'
    return candidate


def _staff_technician_queryset(salon_id=None):
    queryset = (
        User.objects.filter(profile__role=UserRole.WORKER)
        .select_related('profile', 'profile__salon')
        .order_by('first_name', 'username')
    )
    if salon_id:
        queryset = queryset.filter(profile__salon_id=salon_id)
    return queryset


@require_http_methods(['GET'])
def list_salon_technicians(request):
    denied = _require_admin(request)
    if denied:
        return denied

    salon_id = parse_admin_salon_id(request)
    technicians = []
    for user in _staff_technician_queryset(salon_id):
        profile = user.profile
        if not is_approved_technician(profile):
            continue
        technicians.append(_admin_user_to_dict(user))
    return JsonResponse({'technicians': technicians})


@require_http_methods(['POST'])
def create_salon_technician(request):
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    name = (data.get('name') or '').strip()
    phone = (data.get('phone') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    specialty = (data.get('specialty') or '').strip()[:100]
    placement = (data.get('placement') or '').strip().lower()
    freelance_raw = data.get('technician_is_freelance')
    is_freelance = freelance_raw in (True, 'true', 'True', '1', 1) or placement == 'freelance'
    salon_id = resolve_salon_id(data.get('salon_id')) or parse_admin_salon_id(request)

    if not name or not phone or not email or not password:
        return JsonResponse(
            {'error': 'Name, phone, email, and password are required.'},
            status=400,
        )

    password_error = password_strength_error(password)
    if password_error:
        return JsonResponse({'error': password_error}, status=400)

    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({'error': 'An account with that email already exists.'}, status=400)

    salon = None
    if is_freelance:
        salon = None
    elif salon_id:
        salon = Salon.objects.filter(pk=salon_id, is_active=True).first()
        if salon is None:
            return JsonResponse({'error': 'Invalid salon.'}, status=400)
    else:
        salon = get_primary_salon()
        if salon is None:
            return JsonResponse(
                {'error': 'Choose a salon, or add this person as a freelancer.'},
                status=400,
            )

    default_location = (data.get('location') or data.get('default_location') or '').strip()
    service_latitude = validate_latitude(parse_coordinate(data.get('service_latitude')))
    service_longitude = validate_longitude(parse_coordinate(data.get('service_longitude')))
    latitude_provided = data.get('service_latitude') not in (None, '')
    longitude_provided = data.get('service_longitude') not in (None, '')

    if is_freelance:
        if latitude_provided and service_latitude is None:
            return JsonResponse({'error': 'Enter a valid latitude between -90 and 90.'}, status=400)
        if longitude_provided and service_longitude is None:
            return JsonResponse({'error': 'Enter a valid longitude between -180 and 180.'}, status=400)
        if not default_location and salon:
            default_location = salon.location
        service_latitude, service_longitude, geo_error = resolve_coordinates(
            location=default_location,
            latitude=service_latitude,
            longitude=service_longitude,
            latitude_provided=latitude_provided,
            longitude_provided=longitude_provided,
        )
        if service_latitude is None or service_longitude is None:
            return JsonResponse(
                {
                    'error': geo_error
                    or 'Add this freelancer’s map pin: GPS or an area they work in (e.g. Kikuyu).',
                },
                status=400,
            )
    elif salon:
        default_location = salon.location
        if salon.latitude is not None and salon.longitude is not None:
            service_latitude = salon.latitude
            service_longitude = salon.longitude
        else:
            service_latitude, service_longitude, _geo_error = resolve_coordinates(
                location=salon.location,
                latitude=None,
                longitude=None,
            )

    username = _unique_username(email.split('@')[0] or name)
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=name,
    )
    UserProfile.objects.create(
        user=user,
        phone=phone,
        role=UserRole.WORKER,
        technician_approval=TechnicianApprovalStatus.APPROVED,
        technician_specialty=specialty,
        technician_is_freelance=is_freelance,
        salon=salon,
        default_location=default_location,
        service_latitude=service_latitude,
        service_longitude=service_longitude,
    )

    added_as = 'freelancer' if is_freelance else (salon.name if salon else 'salon team')
    return JsonResponse(
        {
            'message': f'{name} added as {added_as}.',
            'user': _admin_user_to_dict(user),
        },
        status=201,
    )


def _admin_target_technician(user_id):
    target = get_object_or_404(User.objects.select_related('profile', 'profile__salon'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if not profile or not is_approved_technician(profile):
        return None, JsonResponse({'error': 'Approved technician not found.'}, status=404)
    return target, None


@require_http_methods(['GET'])
def admin_technician_slots(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    target, error = _admin_target_technician(user_id)
    if error:
        return error

    slot_date = parse_date(request.GET.get('date', '').strip())
    if not slot_date:
        return JsonResponse({'error': 'A valid date is required (YYYY-MM-DD).'}, status=400)

    ensure_default_available_slots([target], slot_date, slot_date)
    existing = TimeSlot.objects.filter(worker=target, date=slot_date).select_related('booking')
    slots = _merge_day_slots(target, slot_date, existing)
    walk_ins = _unslotted_walk_ins(target, slot_date)
    return JsonResponse(
        {
            'date': slot_date.isoformat(),
            'technician': _admin_user_to_dict(target),
            'slots': slots,
            'walk_ins': walk_ins,
            'day': _day_kind(slots, walk_ins),
        }
    )


@require_http_methods(['POST'])
def admin_save_technician_slots(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    target, error = _admin_target_technician(user_id)
    if error:
        return error

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    slot_date = parse_date((data.get('date') or '').strip())
    if not slot_date:
        return JsonResponse({'error': 'A valid date is required (YYYY-MM-DD).'}, status=400)
    if slot_date < timezone.localdate():
        return JsonResponse({'error': 'Cannot change slots in the past.'}, status=400)

    available_hours = data.get('available_hours')
    if not isinstance(available_hours, list):
        return JsonResponse({'error': 'available_hours must be a list of start hours.'}, status=400)

    selected = set()
    for raw in available_hours:
        try:
            hour = int(raw)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Invalid hour in available_hours.'}, status=400)
        if hour not in SLOT_HOURS:
            return JsonResponse({'error': f'Invalid start hour: {hour}.'}, status=400)
        selected.add(hour)

    for hour in SLOT_HOURS:
        slot, _ = TimeSlot.objects.get_or_create(
            worker=target,
            date=slot_date,
            start_hour=hour,
            defaults={'status': SlotStatus.AVAILABLE},
        )
        if slot.status == SlotStatus.BOOKED:
            continue
        next_status = SlotStatus.AVAILABLE if hour in selected else SlotStatus.UNAVAILABLE
        if slot.status != next_status:
            slot.status = next_status
            slot.save(update_fields=['status'])

    existing = TimeSlot.objects.filter(worker=target, date=slot_date).select_related('booking')
    return JsonResponse(
        {
            'message': 'Availability updated.',
            'date': slot_date.isoformat(),
            'slots': _merge_day_slots(target, slot_date, existing),
        }
    )
