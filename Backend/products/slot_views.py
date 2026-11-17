import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Booking, BookingStatus, SlotStatus, TechnicianApprovalStatus, TimeSlot, UserRole
from .slot_utils import (
    SLOT_HOURS,
    ensure_default_available_slots,
    format_slot_label,
    is_past_slot,
    parse_date,
)
from .views import _booking_to_dict, _forbidden, _unauthorized
from .worker_permissions import require_approved_worker

User = get_user_model()


def _parse_date(value):
    return parse_date(value)


def _require_worker(request):
    return require_approved_worker(request)


def _slot_to_dict(slot):
    return {
        'id': slot.id,
        'date': slot.date.isoformat(),
        'start_hour': slot.start_hour,
        'end_hour': slot.start_hour + 2,
        'label': format_slot_label(slot.start_hour),
        'status': slot.status,
        'worker_id': slot.worker_id,
        'worker_name': slot.worker.first_name or slot.worker.username,
        'booking': _booking_to_dict(slot.booking) if slot.booking else None,
    }


def _virtual_slot(worker, slot_date, start_hour, status=SlotStatus.AVAILABLE):
    return {
        'id': None,
        'date': slot_date.isoformat(),
        'start_hour': start_hour,
        'end_hour': start_hour + 2,
        'label': format_slot_label(start_hour),
        'status': status,
        'worker_id': worker.id,
        'worker_name': worker.first_name or worker.username,
        'booking': None,
    }


def _merge_day_slots(worker, slot_date, existing_slots):
    by_hour = {slot.start_hour: slot for slot in existing_slots}
    merged = []
    for hour in SLOT_HOURS:
        if hour in by_hour:
            merged.append(_slot_to_dict(by_hour[hour]))
        elif is_past_slot(slot_date, hour):
            merged.append(_virtual_slot(worker, slot_date, hour, SlotStatus.UNAVAILABLE))
        else:
            merged.append(_virtual_slot(worker, slot_date, hour, SlotStatus.AVAILABLE))
    return merged


def _unslotted_walk_ins(worker, slot_date):
    bookings = (
        Booking.objects.filter(
            is_walk_in=True,
            requested_date=slot_date,
        )
        .filter(Q(preferred_worker=worker) | Q(time_slot__worker=worker))
        .exclude(status=BookingStatus.CANCELLED)
        .select_related('preferred_worker', 'time_slot')
    )
    return [_booking_to_dict(booking) for booking in bookings if getattr(booking, 'time_slot', None) is None]


def _day_kind(slots, walk_ins):
    has_online = any(
        slot['status'] == SlotStatus.BOOKED
        and not (slot.get('booking') or {}).get('is_walk_in')
        for slot in slots
    )
    has_walk_in = bool(walk_ins) or any(
        slot['status'] == SlotStatus.BOOKED and (slot.get('booking') or {}).get('is_walk_in')
        for slot in slots
    )
    open_hours = [slot for slot in slots if slot['status'] == SlotStatus.AVAILABLE]
    booked_hours = [slot for slot in slots if slot['status'] == SlotStatus.BOOKED]
    if not open_hours and not booked_hours and not walk_ins:
        kind = 'off'
    elif has_online and has_walk_in:
        kind = 'mixed'
    elif has_walk_in and not has_online:
        kind = 'walk_in'
    elif has_online:
        kind = 'online'
    elif open_hours:
        kind = 'open'
    else:
        kind = 'off'
    return {
        'kind': kind,
        'has_online_bookings': has_online,
        'has_walk_ins': has_walk_in,
        'is_off_day': kind == 'off',
    }


@require_http_methods(['GET'])
def list_available_slots(request):
    slot_date = _parse_date(request.GET.get('date'))
    if not slot_date:
        return JsonResponse({'error': 'A valid date is required (YYYY-MM-DD).'}, status=400)

    if slot_date < timezone.localdate():
        return JsonResponse({'slots': []})

    workers = User.objects.filter(
        profile__role=UserRole.WORKER,
        profile__technician_approval=TechnicianApprovalStatus.APPROVED,
    )
    worker_id = request.GET.get('worker_id', '').strip()
    if worker_id:
        try:
            workers = workers.filter(pk=int(worker_id))
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Invalid worker_id.'}, status=400)

    ensure_default_available_slots(workers, slot_date, slot_date)

    slots = (
        TimeSlot.objects.filter(
            date=slot_date,
            status=SlotStatus.AVAILABLE,
            worker_id__in=workers.values_list('id', flat=True),
        )
        .select_related('worker')
        .order_by('start_hour', 'worker__first_name')
    )

    return JsonResponse(
        {
            'date': slot_date.isoformat(),
            'slots': [
                _slot_to_dict(slot)
                for slot in slots
                if not is_past_slot(slot.date, slot.start_hour)
            ],
        }
    )


@require_http_methods(['GET'])
def manage_slots(request):
    worker, denied = _require_worker(request)
    if denied:
        return denied

    slot_date = _parse_date(request.GET.get('date'))
    if not slot_date:
        return JsonResponse({'error': 'A valid date is required (YYYY-MM-DD).'}, status=400)

    existing = TimeSlot.objects.filter(worker=worker, date=slot_date).select_related(
        'worker',
        'booking',
        'booking__preferred_worker',
        'booking__salon',
    )
    slots = _merge_day_slots(worker, slot_date, existing)
    walk_ins = _unslotted_walk_ins(worker, slot_date)
    return JsonResponse(
        {
            'date': slot_date.isoformat(),
            'slots': slots,
            'walk_ins': walk_ins,
            'day': _day_kind(slots, walk_ins),
        }
    )


@csrf_exempt
@require_http_methods(['POST'])
def toggle_slot(request):
    worker, denied = _require_worker(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    slot_date = _parse_date(data.get('date'))
    start_hour = data.get('start_hour')
    status = data.get('status', '').strip().lower()

    if not slot_date or start_hour is None:
        return JsonResponse({'error': 'date and start_hour are required.'}, status=400)

    if start_hour not in SLOT_HOURS:
        return JsonResponse({'error': 'Invalid start_hour.'}, status=400)

    if status not in (SlotStatus.AVAILABLE, SlotStatus.UNAVAILABLE):
        return JsonResponse({'error': 'status must be available or unavailable.'}, status=400)

    if slot_date < timezone.localdate():
        return JsonResponse({'error': 'Cannot change slots in the past.'}, status=400)

    slot, _ = TimeSlot.objects.get_or_create(
        worker=worker,
        date=slot_date,
        start_hour=start_hour,
        defaults={'status': SlotStatus.UNAVAILABLE},
    )

    if slot.status == SlotStatus.BOOKED:
        return JsonResponse({'error': 'This slot is already booked.'}, status=400)

    slot.status = status
    slot.save(update_fields=['status'])

    return JsonResponse(
        {
            'message': 'Time slot updated.',
            'slot': _slot_to_dict(slot),
        }
    )


def book_time_slot(slot_id, booking):
    with transaction.atomic():
        slot = TimeSlot.objects.select_for_update().get(pk=slot_id)
        if slot.status != SlotStatus.AVAILABLE:
            raise ValueError('That time slot is no longer available.')
        if slot.date < timezone.localdate():
            raise ValueError('Cannot book a past time slot.')

        slot.status = SlotStatus.BOOKED
        slot.booking = booking
        slot.save(update_fields=['status', 'booking'])
        return slot
