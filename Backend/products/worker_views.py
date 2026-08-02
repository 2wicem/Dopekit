import json
import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import F, Q, Value
from django.db.models.functions import Coalesce
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Booking, BookingStatus, Salon, SlotStatus, TimeSlot, UserRole
from .slot_utils import SLOT_HOURS, format_slot_label
from .slot_views import _parse_date
from .technician_showcase import completed_jobs_for_worker, technician_showcase_to_dict
from .technician_utils import is_approved_technician
from .technician_verification import SPECIALTY_LABELS
from .views import _booking_to_dict, _forbidden
from .worker_permissions import require_approved_worker

User = get_user_model()
logger = logging.getLogger(__name__)


def _worker_bookings_queryset(user):
    queryset = (
        Booking.objects.exclude(status=BookingStatus.CANCELLED)
        .select_related('time_slot__worker', 'preferred_worker')
        .annotate(
            sort_date=Coalesce('time_slot__date', 'requested_date'),
            sort_hour=Coalesce('time_slot__start_hour', Value(99)),
        )
    )

    profile = getattr(user, 'profile', None)
    if profile and profile.role == UserRole.WORKER:
        queryset = queryset.filter(
            Q(time_slot__worker=user)
            | Q(time_slot__isnull=True, preferred_worker=user)
            | Q(time_slot__isnull=True, preferred_worker__isnull=True)
        )
        if profile.salon_id:
            queryset = queryset.filter(
                Q(salon_id=profile.salon_id) | Q(salon__isnull=True)
            )

    return queryset.order_by(
        F('sort_date').asc(nulls_last=True),
        F('sort_hour').asc(nulls_last=True),
        '-created_at',
    )


def _public_worker_role_label(profile) -> str:
    if profile.role == UserRole.ADMIN:
        return 'Lead stylist'
    if profile.salon_id is None:
        return 'Freelance technician'
    return 'Nail technician'


def _public_worker_queryset(salon_id=None, freelance_only=False):
    staff = (
        User.objects.filter(profile__role__in=(UserRole.WORKER, UserRole.ADMIN))
        .select_related('profile', 'profile__salon')
        .order_by('first_name', 'username')
    )

    if freelance_only:
        return staff.filter(profile__role=UserRole.WORKER, profile__salon__isnull=True)

    if salon_id is not None:
        return staff.filter(
            Q(profile__salon_id=salon_id)
            | Q(profile__role=UserRole.WORKER, profile__salon__isnull=True)
        )

    return staff


def _serialize_public_worker(user, today, horizon):
    profile = user.profile
    if profile.role == UserRole.WORKER and not is_approved_technician(profile):
        return None

    available_qs = TimeSlot.objects.filter(
        worker=user,
        date__gte=today,
        date__lte=horizon,
        status=SlotStatus.AVAILABLE,
    )
    available_count = available_qs.count()
    next_slot = available_qs.order_by('date', 'start_hour').first()
    specialty = profile.technician_specialty or ''
    showcase = technician_showcase_to_dict(profile, completed_jobs_for_worker(user))

    latitude = None
    longitude = None
    if profile.service_latitude is not None and profile.service_longitude is not None:
        latitude = float(profile.service_latitude)
        longitude = float(profile.service_longitude)
    elif profile.salon_id and profile.salon and profile.salon.latitude is not None:
        latitude = float(profile.salon.latitude)
        longitude = float(profile.salon.longitude)

    return {
        'id': user.id,
        'name': user.first_name or user.username.capitalize(),
        'role': profile.role,
        'role_label': _public_worker_role_label(profile),
        'is_freelance': profile.role == UserRole.WORKER and profile.salon_id is None,
        'salon_id': profile.salon_id,
        'salon_name': profile.salon.name if profile.salon_id else None,
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
    horizon = today + timedelta(days=14)
    staff = _public_worker_queryset(salon_id=salon_id, freelance_only=freelance_only)

    workers = []
    for user in staff:
        item = _serialize_public_worker(user, today, horizon)
        if item:
            workers.append(item)

    workers.sort(
        key=lambda item: (
            -int(item['is_available']),
            -item['available_slots'],
            item['name'].lower(),
        )
    )
    return workers


def _public_day_slots(existing_slots):
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
            if slot.status == SlotStatus.AVAILABLE:
                entry['id'] = slot.id
            day_slots.append(entry)
        else:
            day_slots.append(
                {
                    'start_hour': hour,
                    'label': format_slot_label(hour),
                    'status': SlotStatus.UNAVAILABLE,
                }
            )
    return day_slots


def _public_worker_or_404(worker_id):
    user = get_object_or_404(User, pk=worker_id)
    profile = getattr(user, 'profile', None)
    if not profile or profile.role not in (UserRole.WORKER, UserRole.ADMIN):
        return None, JsonResponse({'error': 'Technician not found.'}, status=404)
    if profile.role == UserRole.WORKER and not is_approved_technician(profile):
        return None, JsonResponse({'error': 'Technician not found.'}, status=404)
    return user, None


@require_http_methods(['GET'])
def public_worker_schedule(request, worker_id):
    user, denied = _public_worker_or_404(worker_id)
    if denied:
        return denied

    profile = user.profile
    raw_days = request.GET.get('days', '14').strip()
    try:
        days = int(raw_days)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Invalid days parameter.'}, status=400)

    days = min(max(days, 1), 28)
    today = timezone.localdate()
    horizon = today + timedelta(days=days - 1)

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
        day_slots = _public_day_slots(by_date.get(slot_date, []))
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
                'role_label': _public_worker_role_label(profile),
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

    bookings = _worker_bookings_queryset(request.user)[:100]
    pending_count = sum(1 for booking in bookings if booking.status == BookingStatus.PENDING)

    return JsonResponse(
        {
            'bookings': [_booking_to_dict(booking) for booking in bookings],
            'pending_count': pending_count,
        }
    )


@csrf_exempt
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

    if not slot:
        return JsonResponse({'error': 'Booking has no time slot.'}, status=400)

    profile = getattr(worker, 'profile', None)
    if profile.role == UserRole.WORKER and slot.worker_id != worker.id:
        return _forbidden('You can only accept your own appointments.')

    if booking.status == BookingStatus.ACCEPTED:
        return JsonResponse({'message': 'Already accepted.', 'booking': _booking_to_dict(booking)})

    if booking.status == BookingStatus.CANCELLED:
        return JsonResponse({'error': 'This booking was cancelled.'}, status=400)

    booking.status = BookingStatus.ACCEPTED
    booking.save(update_fields=['status'])

    return JsonResponse(
        {
            'message': 'Booking accepted.',
            'booking': _booking_to_dict(booking),
        }
    )


@csrf_exempt
@require_http_methods(['POST'])
def cancel_booking_worker(request, booking_id):
    worker, denied = require_approved_worker(request)
    if denied:
        return denied

    booking = get_object_or_404(
        Booking.objects.select_related('time_slot'),
        pk=booking_id,
    )
    slot = getattr(booking, 'time_slot', None)

    if slot:
        profile = getattr(worker, 'profile', None)
        if profile.role == UserRole.WORKER and slot.worker_id != worker.id:
            return _forbidden('You can only cancel your own appointments.')

    if booking.status == BookingStatus.CANCELLED:
        return JsonResponse({'message': 'Already cancelled.', 'booking': _booking_to_dict(booking)})

    with transaction.atomic():
        booking.status = BookingStatus.CANCELLED
        booking.save(update_fields=['status'])
        if slot:
            TimeSlot.objects.filter(pk=slot.pk).update(
                status=SlotStatus.AVAILABLE,
                booking=None,
            )

    return JsonResponse(
        {
            'message': 'Booking cancelled.',
            'booking': _booking_to_dict(booking),
        }
    )


@csrf_exempt
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
