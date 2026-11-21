import json
import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import transaction
from django.db.models import F, Q, Value
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Booking, BookingStatus, Salon, SlotStatus, TimeSlot, UserRole
from .slot_utils import (
    PUBLIC_SCHEDULE_DAYS,
    SLOT_HOURS,
    count_open_slots_for_workers,
    ensure_default_available_slots,
    format_slot_label,
    is_past_slot,
)
from .slot_views import _parse_date
from .technician_showcase import completed_jobs_by_worker_ids, technician_showcase_to_dict
from .technician_utils import bookable_technician_q, is_approved_technician
from .technician_verification import SPECIALTY_LABELS
from .views import _booking_to_dict, _forbidden
from .worker_permissions import require_approved_worker

User = get_user_model()
logger = logging.getLogger(__name__)


WORKER_BOOKING_LOOKBACK_DAYS = 45
WORKER_BOOKING_LOOKAHEAD_DAYS = 90
UNASSIGNED_PENDING_DAYS = 14
WORKER_BOOKING_LIST_LIMIT = 40


def _worker_bookings_queryset(user):
    queryset = (
        Booking.objects.exclude(status=BookingStatus.CANCELLED)
        .select_related('time_slot__worker', 'preferred_worker', 'salon')
    )

    profile = getattr(user, 'profile', None)
    if profile and profile.role == UserRole.WORKER:
        own = Q(time_slot__worker=user) | Q(preferred_worker=user)
        unassigned = Q(
            time_slot__isnull=True,
            preferred_worker__isnull=True,
            is_walk_in=False,
            status=BookingStatus.PENDING,
            created_at__gte=timezone.now() - timedelta(days=UNASSIGNED_PENDING_DAYS),
        )
        if profile.salon_id:
            unassigned &= Q(salon_id=profile.salon_id) | Q(salon__isnull=True)
        queryset = queryset.filter(own | unassigned)

    today = timezone.localdate()
    queryset = queryset.filter(
        Q(status=BookingStatus.PENDING)
        | Q(
            time_slot__date__gte=today - timedelta(days=WORKER_BOOKING_LOOKBACK_DAYS),
            time_slot__date__lte=today + timedelta(days=WORKER_BOOKING_LOOKAHEAD_DAYS),
        )
        | Q(
            time_slot__isnull=True,
            requested_date__gte=today - timedelta(days=WORKER_BOOKING_LOOKBACK_DAYS),
            requested_date__lte=today + timedelta(days=WORKER_BOOKING_LOOKAHEAD_DAYS),
        )
    )

    return queryset.annotate(
        sort_date=Coalesce('time_slot__date', 'requested_date'),
        sort_hour=Coalesce('time_slot__start_hour', Value(99)),
    ).order_by(
        F('sort_date').asc(nulls_last=True),
        F('sort_hour').asc(nulls_last=True),
        '-created_at',
    )


def _public_worker_role_label(profile, salon=None) -> str:
    if profile.role == UserRole.ADMIN:
        return 'Lead stylist'
    if profile.role == UserRole.SALON_OWNER:
        return 'Salon technician'
    if profile.salon_id is None and salon is None:
        return 'Freelance technician'
    return 'Nail technician'


def _public_salon_for_user(user):
    profile = getattr(user, 'profile', None)
    if not profile:
        return None
    if profile.salon_id and profile.salon:
        return profile.salon
    owned = [salon for salon in user.owned_salons.all() if salon.is_active]
    if not owned:
        return None
    return next((salon for salon in owned if salon.is_primary), owned[0])


def _public_worker_queryset(salon_id=None, freelance_only=False):
    return (
        User.objects.filter(bookable_technician_q(salon_id=salon_id, freelance_only=freelance_only))
        .select_related('profile', 'profile__salon')
        .prefetch_related('owned_salons')
        .distinct()
        .order_by('first_name', 'username')
    )


def _serialize_public_worker(user, available_count, next_slot, completed_jobs):
    profile = user.profile
    if profile.role == UserRole.WORKER and not is_approved_technician(profile):
        return None
    if profile.role == UserRole.SALON_OWNER and not _public_salon_for_user(user):
        return None

    specialty = profile.technician_specialty or ''
    showcase = technician_showcase_to_dict(profile, completed_jobs)
    salon = _public_salon_for_user(user)

    latitude = None
    longitude = None
    if profile.service_latitude is not None and profile.service_longitude is not None:
        latitude = float(profile.service_latitude)
        longitude = float(profile.service_longitude)
    elif salon and salon.latitude is not None:
        latitude = float(salon.latitude)
        longitude = float(salon.longitude)

    return {
        'id': user.id,
        'name': user.first_name or user.username.capitalize(),
        'role': profile.role,
        'role_label': _public_worker_role_label(profile, salon),
        'is_freelance': profile.role == UserRole.WORKER and bool(profile.technician_is_freelance),
        'is_salon_owner': profile.role == UserRole.SALON_OWNER,
        'salon_id': salon.id if salon else None,
        'salon_name': salon.name if salon else None,
        'latitude': latitude,
        'longitude': longitude,
        'specialty_label': SPECIALTY_LABELS.get(specialty, specialty.replace('_', ' ').title()) or None,
        'available_slots': available_count,
        'is_available': available_count > 0,
        'next_slot': (
            {
                'date': next_slot.date.isoformat(),
                'label': format_slot_label(next_slot.start_hour),
            }
            if next_slot
            else None
        ),
        **showcase,
    }


def build_public_workers(salon_id=None, freelance_only=False):
    today = timezone.localdate()
    cache_key = f'dk:public_workers:v4:{salon_id}:{int(bool(freelance_only))}:{today.isoformat()}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    horizon = today + timedelta(days=PUBLIC_SCHEDULE_DAYS - 1)
    staff = list(_public_worker_queryset(salon_id=salon_id, freelance_only=freelance_only))
    availability = count_open_slots_for_workers(staff, today, horizon)
    completed_jobs = completed_jobs_by_worker_ids([user.id for user in staff])

    workers = []
    for user in staff:
        open_count, next_slot = availability.get(user.pk, (0, None))
        item = _serialize_public_worker(
            user,
            open_count,
            next_slot,
            completed_jobs.get(user.id, 0),
        )
        if item:
            workers.append(item)

    workers.sort(
        key=lambda item: (
            -int(item['is_available']),
            -item['available_slots'],
            item['name'].lower(),
        )
    )
    cache.set(cache_key, workers, 45)
    return workers


def _public_day_slots(existing_slots, slot_date):
    by_hour = {slot.start_hour: slot for slot in existing_slots}
    day_slots = []
    for hour in SLOT_HOURS:
        slot = by_hour.get(hour)
        if slot:
            entry = {
                'start_hour': hour,
                'label': format_slot_label(hour),
                'status': slot.status,
            }
            if slot.status == SlotStatus.AVAILABLE and not is_past_slot(slot_date, hour):
                entry['id'] = slot.id
            elif is_past_slot(slot_date, hour) and slot.status == SlotStatus.AVAILABLE:
                entry['status'] = SlotStatus.UNAVAILABLE
            day_slots.append(entry)
        elif is_past_slot(slot_date, hour):
            day_slots.append(
                {
                    'start_hour': hour,
                    'label': format_slot_label(hour),
                    'status': SlotStatus.UNAVAILABLE,
                }
            )
        else:
            day_slots.append(
                {
                    'start_hour': hour,
                    'label': format_slot_label(hour),
                    'status': SlotStatus.AVAILABLE,
                }
            )
    return day_slots


def _public_worker_or_404(worker_id):
    user = get_object_or_404(
        User.objects.select_related('profile', 'profile__salon').prefetch_related('owned_salons'),
        pk=worker_id,
    )
    profile = getattr(user, 'profile', None)
    if not profile:
        return None, JsonResponse({'error': 'Technician not found.'}, status=404)
    if profile.role == UserRole.SALON_OWNER:
        if _public_salon_for_user(user) is None:
            return None, JsonResponse({'error': 'Technician not found.'}, status=404)
        return user, None
    if profile.role != UserRole.WORKER:
        return None, JsonResponse({'error': 'Technician not found.'}, status=404)
    if not is_approved_technician(profile):
        return None, JsonResponse({'error': 'Technician not found.'}, status=404)
    return user, None


@require_http_methods(['GET'])
def public_worker_schedule(request, worker_id):
    user, denied = _public_worker_or_404(worker_id)
    if denied:
        return denied

    profile = user.profile
    raw_days = request.GET.get('days', str(PUBLIC_SCHEDULE_DAYS)).strip()
    try:
        days = int(raw_days)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Invalid days parameter.'}, status=400)

    days = min(max(days, 1), 28)
    today = timezone.localdate()
    horizon = today + timedelta(days=days - 1)

    ensure_default_available_slots([user], today, horizon)
    existing = TimeSlot.objects.filter(
        worker=user,
        date__gte=today,
        date__lte=horizon,
    )

    by_date = {}
    for slot in existing:
        by_date.setdefault(slot.date, []).append(slot)

    schedule = []
    open_count = 0
    for offset in range(days):
        slot_date = today + timedelta(days=offset)
        day_slots = _public_day_slots(by_date.get(slot_date, []), slot_date)
        open_count += sum(1 for entry in day_slots if entry['status'] == SlotStatus.AVAILABLE)
        schedule.append(
            {
                'date': slot_date.isoformat(),
                'weekday': slot_date.strftime('%a'),
                'slots': day_slots,
            }
        )

    return JsonResponse(
        {
            'worker': {
                'id': user.id,
                'name': user.first_name or user.username,
                'role_label': _public_worker_role_label(profile, _public_salon_for_user(user)),
            },
            'from': today.isoformat(),
            'days': days,
            'open_slots': open_count,
            'schedule': schedule,
        }
    )


@require_http_methods(['GET'])
def list_public_workers(request):
    freelance_only = request.GET.get('freelance') in ('1', 'true', 'yes')
    salon_id = None

    raw_salon_id = request.GET.get('salon_id', '').strip()
    if raw_salon_id and not freelance_only:
        try:
            salon_id = int(raw_salon_id)
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Invalid salon_id.'}, status=400)
        if not Salon.objects.filter(pk=salon_id, is_active=True).exists():
            return JsonResponse({'error': 'Salon not found.'}, status=404)

    workers = build_public_workers(salon_id=salon_id, freelance_only=freelance_only)
    return JsonResponse({'workers': workers})


@require_http_methods(['GET'])
def worker_bookings(request):
    worker, denied = require_approved_worker(request)
    if denied:
        return denied

    queryset = _worker_bookings_queryset(request.user)
    pending_qs = queryset.filter(status=BookingStatus.PENDING)
    pending_count = pending_qs.count()
    today = timezone.localdate()
    today_q = Q(time_slot__date=today) | Q(time_slot__isnull=True, requested_date=today)
    upcoming_q = Q(time_slot__date__gte=today) | Q(
        time_slot__isnull=True, requested_date__gte=today
    )

    if request.GET.get('light') == '1':
        return JsonResponse(
            {
                'pending_count': pending_count,
                'today_count': queryset.filter(today_q).count(),
                'upcoming_count': queryset.filter(upcoming_q).count(),
                'pending_ids': list(pending_qs.order_by('id').values_list('id', flat=True)[:30]),
            }
        )

    bookings = list(queryset[:WORKER_BOOKING_LIST_LIMIT])
    return JsonResponse(
        {
            'bookings': [_booking_to_dict(booking) for booking in bookings],
            'pending_count': pending_count,
            'today_count': queryset.filter(today_q).count(),
            'upcoming_count': queryset.filter(upcoming_q).count(),
        }
    )


@require_http_methods(['POST'])
def accept_booking(request, booking_id):
    worker, denied = require_approved_worker(request)
    if denied:
        return denied

    booking = get_object_or_404(
        Booking.objects.select_related('time_slot'),
        pk=booking_id,
    )
    slot = getattr(booking, 'time_slot', None)

    profile = getattr(worker, 'profile', None)
    if not slot:
        if profile.role == UserRole.WORKER and booking.preferred_worker_id != worker.id:
            return _forbidden('You can only accept your own appointments.')
    elif profile.role == UserRole.WORKER and slot.worker_id != worker.id:
        return _forbidden('You can only accept your own appointments.')

    if booking.status == BookingStatus.ACCEPTED:
        return JsonResponse({'message': 'Already accepted.', 'booking': _booking_to_dict(booking)})

    if booking.status == BookingStatus.CANCELLED:
        return JsonResponse({'error': 'This booking was cancelled.'}, status=400)

    booking.status = BookingStatus.ACCEPTED
    from .booking_utils import save_shared_job

    save_shared_job(booking, extra_fields=['status'])

    return JsonResponse(
        {
            'message': 'Booking accepted.',
            'booking': _booking_to_dict(booking),
        }
    )


def _worker_owns_booking(worker, booking):
    slot = getattr(booking, 'time_slot', None)
    profile = getattr(worker, 'profile', None)
    if profile and profile.role != UserRole.WORKER:
        return True
    if slot:
        return slot.worker_id == worker.id
    return booking.preferred_worker_id == worker.id


@require_http_methods(['POST'])
def complete_booking(request, booking_id):
    from .inventory_permissions import require_staff_inventory
    from .salon_owner_permissions import booking_in_owned_salons

    profile, denied = require_staff_inventory(request)
    if denied:
        return denied

    worker = request.user
    booking = get_object_or_404(
        Booking.objects.select_related(
            'time_slot',
            'time_slot__worker',
            'time_slot__worker__profile',
            'preferred_worker',
            'preferred_worker__profile',
            'salon',
        ),
        pk=booking_id,
    )
    if profile.role == UserRole.WORKER and not _worker_owns_booking(worker, booking):
        return _forbidden('You can only complete your own appointments.')
    if profile.role == UserRole.SALON_OWNER and not booking_in_owned_salons(worker, booking):
        return _forbidden('You can only complete jobs at your salon.')

    if booking.status == BookingStatus.CANCELLED:
        return JsonResponse({'error': 'This booking was cancelled.'}, status=400)

    if booking.status == BookingStatus.COMPLETED:
        return JsonResponse(
            {'message': 'Already in daily inventory.', 'booking': _booking_to_dict(booking)}
        )

    try:
        payload = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        payload = {}

    from .payment_utils import apply_client_payment, parse_payment_fields

    payment, payment_error = parse_payment_fields(
        payload,
        default_amount=booking.service_price_kes,
        required=True,
    )
    if payment_error:
        return JsonResponse({'error': payment_error}, status=400)

    booking.status = BookingStatus.COMPLETED
    update_fields = ['status'] + apply_client_payment(booking, payment)
    from .booking_utils import save_shared_job

    save_shared_job(booking, extra_fields=update_fields)
    method_label = booking.get_payment_method_display()
    return JsonResponse(
        {
            'message': f'Marked complete · {method_label} added to daily inventory.',
            'booking': _booking_to_dict(booking),
        }
    )


@require_http_methods(['POST'])
def cancel_booking_worker(request, booking_id):
    from .inventory_permissions import require_staff_inventory
    from .salon_owner_permissions import booking_in_owned_salons

    profile, denied = require_staff_inventory(request)
    if denied:
        return denied

    booking = get_object_or_404(
        Booking.objects.select_related('time_slot', 'preferred_worker', 'salon'),
        pk=booking_id,
    )
    slot = getattr(booking, 'time_slot', None)
    worker = request.user

    allowed = False
    if profile.role == UserRole.ADMIN:
        allowed = True
    elif profile.role == UserRole.SALON_OWNER:
        allowed = booking_in_owned_salons(worker, booking)
    elif profile.role == UserRole.WORKER:
        allowed = _worker_owns_booking(worker, booking)

    if not allowed:
        return _forbidden('You can only cancel services for your team or your own jobs.')

    if booking.status == BookingStatus.CANCELLED:
        return JsonResponse({'message': 'Already cancelled.', 'booking': _booking_to_dict(booking)})

    was_logged = booking.status == BookingStatus.COMPLETED or booking.is_walk_in
    with transaction.atomic():
        booking.status = BookingStatus.CANCELLED
        booking.save(update_fields=['status'])
        if slot:
            TimeSlot.objects.filter(pk=slot.pk).update(
                status=SlotStatus.AVAILABLE,
                booking=None,
            )

    message = 'Service removed from inventory.' if was_logged else 'Booking cancelled.'
    return JsonResponse(
        {
            'message': message,
            'booking': _booking_to_dict(booking),
        }
    )


@require_http_methods(['POST'])
def off_day(request):
    worker, denied = require_approved_worker(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    slot_date = _parse_date(data.get('date'))
    if not slot_date:
        return JsonResponse({'error': 'A valid date is required (YYYY-MM-DD).'}, status=400)

    if slot_date < timezone.localdate():
        return JsonResponse({'error': 'Cannot mark a past day as off.'}, status=400)

    blocked = 0
    marked_off = 0

    with transaction.atomic():
        for start_hour in SLOT_HOURS:
            slot, _ = TimeSlot.objects.get_or_create(
                worker=worker,
                date=slot_date,
                start_hour=start_hour,
                defaults={'status': SlotStatus.UNAVAILABLE},
            )

            if slot.status == SlotStatus.BOOKED and slot.booking_id:
                blocked += 1
                continue

            slot.status = SlotStatus.UNAVAILABLE
            slot.booking = None
            slot.save(update_fields=['status', 'booking'])
            marked_off += 1

    message = f'Marked {marked_off} slot(s) off for {slot_date.isoformat()}.'
    if blocked:
        message += f' {blocked} booked slot(s) kept as-is.'

    return JsonResponse(
        {
            'message': message,
            'marked_off': marked_off,
            'blocked': blocked,
        }
    )
