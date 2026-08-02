import json
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .auth_utils import user_to_dict
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
from .notifications import notify_booking_created
from .contact_views import _salon_contact_to_dict
from .geo_utils import parse_coordinate, validate_latitude, validate_longitude
from .salon_utils import (
    assign_primary_salon,
    filter_bookings_by_salon,
    get_primary_salon,
    parse_admin_salon_id,
    resolve_salon_id,
    salon_to_dict,
    unique_slug,
)
from .technician_utils import auto_approve_technician, reject_technician
from .technician_showcase import normalize_rating_average, parse_portfolio_urls, portfolio_urls_to_text
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
        salon = getattr(profile, 'salon', None)
        data['salon_name'] = salon.name if salon else None
        if profile.technician_approval == TechnicianApprovalStatus.PENDING:
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
                technician_approval=TechnicianApprovalStatus.PENDING
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


@csrf_exempt
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


@csrf_exempt
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


@csrf_exempt
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


@csrf_exempt
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
    else:
        try:
            salon = Salon.objects.get(pk=int(raw_salon_id), is_active=True)
        except (Salon.DoesNotExist, TypeError, ValueError):
            return JsonResponse({'error': 'Invalid salon.'}, status=400)
        profile.salon = salon

    profile.save(update_fields=['salon'])

    return JsonResponse(
        {
            'message': 'Home salon updated.',
            'user': _admin_user_to_dict(target),
        }
    )


@csrf_exempt
@require_http_methods(['POST'])
def create_walk_in_booking(request):
    denied = _require_admin(request)
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

    salon = None
    if salon_id:
        salon = Salon.objects.filter(pk=salon_id, is_active=True).first()
    if salon is None:
        salon = get_primary_salon()

    if venue == ServiceVenue.INDOOR:
        location = salon.location if salon else settings.SALON_LOCATION
    elif not location:
        return JsonResponse({'error': 'Please enter an address for outdoor service.'}, status=400)

    requested_date = parse_date(requested_date_raw)
    if not requested_date:
        return JsonResponse({'error': 'Please choose an appointment date.'}, status=400)
    if requested_date < timezone.localdate():
        return JsonResponse({'error': 'Cannot create a walk-in in the past.'}, status=400)

    booking = Booking.objects.create(
        user=None,
        name=name,
        phone=phone,
        location=location,
        service=service,
        venue=venue,
        requested_date=requested_date,
        salon=salon,
        status=BookingStatus.ACCEPTED,
    )

    try:
        notify_booking_created(booking)
    except Exception:
        logger.exception('Notification failed for walk-in booking #%s', booking.id)

    return JsonResponse(
        {
            'message': 'Walk-in booking added.',
            'booking': _booking_to_dict(booking),
        },
        status=201,
    )


@csrf_exempt
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
        User.objects.filter(profile__technician_approval=TechnicianApprovalStatus.PENDING)
        .select_related('profile')
        .order_by('-date_joined')[:100]
    )
    return JsonResponse({'technicians': [_admin_user_to_dict(user) for user in users]})


@csrf_exempt
@require_http_methods(['POST'])
def approve_technician(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    target = get_object_or_404(User.objects.select_related('profile'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if not profile or profile.technician_approval != TechnicianApprovalStatus.PENDING:
        return JsonResponse({'error': 'No pending technician application for this user.'}, status=400)

    auto_approve_technician(profile)

    return JsonResponse(
        {
            'message': 'Technician approved.',
            'user': _admin_user_to_dict(target),
        }
    )


@csrf_exempt
@require_http_methods(['POST'])
def reject_technician_view(request, user_id):
    denied = _require_admin(request)
    if denied:
        return denied

    target = get_object_or_404(User.objects.select_related('profile'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if not profile or profile.technician_approval != TechnicianApprovalStatus.PENDING:
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
    return None


@require_http_methods(['GET'])
def list_salons(request):
    denied = _require_admin(request)
    if denied:
        return denied

    salons = Salon.objects.select_related('owner').order_by('name')
    return JsonResponse({'salons': [salon_to_dict(salon, include_owner=True) for salon in salons]})


@csrf_exempt
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

    error = _apply_salon_fields(salon, data)
    if error:
        return JsonResponse({'error': error}, status=400)

    salon.save()
    if data.get('is_primary'):
        assign_primary_salon(salon)

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
            'salon': salon_to_dict(salon, include_owner=True),
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(['PATCH'])
def update_salon(request, salon_id):
    denied = _require_admin(request)
    if denied:
        return denied

    salon = get_object_or_404(Salon, pk=salon_id)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

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

    return JsonResponse(
        {
            'message': 'Salon updated.',
            'salon': salon_to_dict(salon, include_owner=True),
        }
    )
