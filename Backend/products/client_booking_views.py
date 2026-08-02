import json
import logging

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Booking, BookingStatus, SlotStatus, TechnicianApprovalStatus, TimeSlot, UserRole
from .notifications import notify_booking_cancelled, notify_booking_rescheduled
from .slot_utils import parse_date
from .slot_views import book_time_slot
from .views import _booking_to_dict, _forbidden, _unauthorized

User = get_user_model()
logger = logging.getLogger(__name__)


def _require_client(request):
    if not request.user.is_authenticated:
        return None, _unauthorized()

    profile = getattr(request.user, 'profile', None)
    if not profile:
        return None, JsonResponse({'error': 'Account profile not found.'}, status=400)

    if profile.role != UserRole.CLIENT:
        return None, _forbidden('Only client accounts can manage bookings this way.')

    if profile.technician_approval == TechnicianApprovalStatus.PENDING:
        return None, _forbidden('Your account is pending approval.')

    return profile, None


def _client_owns_booking(user, profile, booking):
    if booking.user_id == user.id:
        return True
    if profile.phone and booking.phone == profile.phone:
        return True
    return False


def _booking_appointment_date(booking):
    slot = getattr(booking, 'time_slot', None)
    if slot:
        return slot.date
    return booking.requested_date


def _can_client_modify(booking):
    if booking.status == BookingStatus.CANCELLED:
        return False

    appointment_date = _booking_appointment_date(booking)
    if appointment_date and appointment_date < timezone.localdate():
        return False

    return True


def _get_client_booking(user, profile, booking_id):
    booking = get_object_or_404(
        Booking.objects.select_related('time_slot__worker', 'preferred_worker'),
        pk=booking_id,
    )

    if not _client_owns_booking(user, profile, booking):
        return None, _forbidden('This booking does not belong to your account.')

    if not _can_client_modify(booking):
        return None, JsonResponse(
            {'error': 'This booking can no longer be changed.'},
            status=400,
        )

    return booking, None


def _release_booking_slot(booking):
    slot = getattr(booking, 'time_slot', None)
    if not slot:
        return

    TimeSlot.objects.filter(pk=slot.pk).update(
        status=SlotStatus.AVAILABLE,
        booking=None,
    )


@csrf_exempt
@require_http_methods(['POST'])
def cancel_my_booking(request, booking_id):
    profile, denied = _require_client(request)
    if denied:
        return denied

    booking, denied = _get_client_booking(request.user, profile, booking_id)
    if denied:
        return denied

    if booking.status == BookingStatus.CANCELLED:
        return JsonResponse(
            {
                'message': 'Already cancelled.',
                'booking': _booking_to_dict(booking),
            }
        )

    with transaction.atomic():
        booking.status = BookingStatus.CANCELLED
        booking.save(update_fields=['status'])
        _release_booking_slot(booking)

    booking = Booking.objects.select_related('time_slot__worker', 'preferred_worker').get(pk=booking.pk)

    try:
        notify_booking_cancelled(booking)
    except Exception:
        logger.exception('Notification failed for cancelled booking #%s', booking.id)

    return JsonResponse(
        {
            'message': 'Booking cancelled.',
            'booking': _booking_to_dict(booking),
        }
    )


@csrf_exempt
@require_http_methods(['PATCH'])
def reschedule_my_booking(request, booking_id):
    profile, denied = _require_client(request)
    if denied:
        return denied

    booking, denied = _get_client_booking(request.user, profile, booking_id)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    slot_id = data.get('slot_id')
    requested_date_raw = data.get('requested_date', '').strip()
    preferred_worker_id = data.get('preferred_worker_id')

    if slot_id in (None, '', 'null') and not requested_date_raw:
        return JsonResponse(
            {'error': 'Choose a new date or time slot to reschedule.'},
            status=400,
        )

    try:
        with transaction.atomic():
            _release_booking_slot(booking)

            if slot_id not in (None, '', 'null'):
                try:
                    slot_id = int(slot_id)
                except (TypeError, ValueError):
                    return JsonResponse({'error': 'Invalid time slot.'}, status=400)

                booking.requested_date = None
                booking.preferred_worker = None
                booking.status = BookingStatus.PENDING
                booking.save(update_fields=['requested_date', 'preferred_worker', 'status'])
                book_time_slot(slot_id, booking)
            else:
                requested_date = parse_date(requested_date_raw)
                if not requested_date:
                    return JsonResponse(
                        {'error': 'Please choose a valid appointment date.'},
                        status=400,
                    )
                if requested_date < timezone.localdate():
                    return JsonResponse(
                        {'error': 'Cannot reschedule to a past date.'},
                        status=400,
                    )

                preferred_worker = None
                if preferred_worker_id not in (None, '', 'null'):
                    try:
                        preferred_worker = User.objects.get(
                            pk=int(preferred_worker_id),
                            profile__role__in=(UserRole.WORKER, UserRole.ADMIN),
                        )
                    except (User.DoesNotExist, TypeError, ValueError):
                        return JsonResponse({'error': 'Invalid technician selected.'}, status=400)

                booking.requested_date = requested_date
                booking.preferred_worker = preferred_worker
                booking.status = BookingStatus.PENDING
                booking.save(update_fields=['requested_date', 'preferred_worker', 'status'])
    except TimeSlot.DoesNotExist:
        return JsonResponse({'error': 'Time slot not found.'}, status=404)
    except ValueError as exc:
        return JsonResponse({'error': str(exc)}, status=400)

    booking = Booking.objects.select_related('time_slot__worker', 'preferred_worker').get(pk=booking.pk)

    try:
        notify_booking_rescheduled(booking)
    except Exception:
        logger.exception('Notification failed for rescheduled booking #%s', booking.id)

    message = (
        'Appointment rescheduled. We will confirm your new time soon.'
        if booking.requested_date and not getattr(booking, 'time_slot', None)
        else 'Appointment rescheduled successfully.'
    )

    return JsonResponse(
        {
            'message': message,
            'booking': _booking_to_dict(booking),
        }
    )
