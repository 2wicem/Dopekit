import csv
import io
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.db.models.functions import Coalesce, TruncDate
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Booking, BookingStatus, UserRole
from .salon_utils import filter_bookings_by_salon, parse_admin_salon_id
from .slot_utils import parse_date
from .views import _forbidden, _unauthorized
from .worker_permissions import require_approved_worker

User = get_user_model()

DEFAULT_RANGE_DAYS = 30


def _require_report_access(request):
    if not request.user.is_authenticated:
        return None, _unauthorized()

    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role not in (UserRole.WORKER, UserRole.ADMIN):
        return None, _forbidden('Only technicians and admins can view reports.')

    if profile.role == UserRole.WORKER:
        _, denied = require_approved_worker(request)
        if denied:
            return None, denied

    return profile, None


def _parse_date_range(request):
    today = timezone.localdate()
    default_from = today - timedelta(days=DEFAULT_RANGE_DAYS)

    date_from = parse_date(request.GET.get('from', '').strip()) or default_from
    date_to = parse_date(request.GET.get('to', '').strip()) or today

    if date_from > date_to:
        date_from, date_to = date_to, date_from

    return date_from, date_to


def _appointment_date_filter(date_from, date_to):
    return Q(
        time_slot__date__gte=date_from,
        time_slot__date__lte=date_to,
    ) | Q(
        time_slot__isnull=True,
        requested_date__gte=date_from,
        requested_date__lte=date_to,
    ) | Q(
        time_slot__isnull=True,
        requested_date__isnull=True,
        created_at__date__gte=date_from,
        created_at__date__lte=date_to,
    )


def _report_bookings_queryset(user, date_from, date_to, salon_id=None):
    queryset = (
        Booking.objects.filter(_appointment_date_filter(date_from, date_to))
        .select_related('time_slot__worker', 'preferred_worker', 'user', 'salon')
    )

    profile = getattr(user, 'profile', None)
    if profile and profile.role == UserRole.WORKER:
        queryset = queryset.filter(
            Q(time_slot__worker=user)
            | Q(time_slot__isnull=True, preferred_worker=user)
        )
    elif profile and profile.role == UserRole.ADMIN:
        queryset = filter_bookings_by_salon(queryset, salon_id)

    return queryset


def _admin_salon_filter(request):
    profile = getattr(request.user, 'profile', None)
    if profile and profile.role == UserRole.ADMIN:
        return parse_admin_salon_id(request)
    return None


def _worker_name(user):
    if not user:
        return 'Unassigned'
    return user.first_name or user.username


def _report_meta(user, date_from, date_to):
    profile = getattr(user, 'profile', None)
    return {
        'from': date_from.isoformat(),
        'to': date_to.isoformat(),
        'scope': 'salon' if profile and profile.role == UserRole.ADMIN else 'technician',
        'generated_at': timezone.now().isoformat(),
    }


@require_http_methods(['GET'])
def report_summary(request):
    profile, denied = _require_report_access(request)
    if denied:
        return denied

    date_from, date_to = _parse_date_range(request)
    bookings = _report_bookings_queryset(
        request.user,
        date_from,
        date_to,
        _admin_salon_filter(request),
    )

    status_counts = {
        row['status']: row['count']
        for row in bookings.values('status').annotate(count=Count('id'))
    }

    return JsonResponse(
        {
            **_report_meta(request.user, date_from, date_to),
            'total': bookings.count(),
            'pending': status_counts.get(BookingStatus.PENDING, 0),
            'accepted': status_counts.get(BookingStatus.ACCEPTED, 0),
            'cancelled': status_counts.get(BookingStatus.CANCELLED, 0),
        }
    )


@require_http_methods(['GET'])
def report_by_service(request):
    _, denied = _require_report_access(request)
    if denied:
        return denied

    date_from, date_to = _parse_date_range(request)
    bookings = _report_bookings_queryset(
        request.user,
        date_from,
        date_to,
        _admin_salon_filter(request),
    )

    rows = (
        bookings.exclude(service='')
        .values('service')
        .annotate(count=Count('id'))
        .order_by('-count', 'service')[:50]
    )

    return JsonResponse(
        {
            **_report_meta(request.user, date_from, date_to),
            'items': [{'service': row['service'], 'count': row['count']} for row in rows],
        }
    )


@require_http_methods(['GET'])
def report_by_venue(request):
    _, denied = _require_report_access(request)
    if denied:
        return denied

    date_from, date_to = _parse_date_range(request)
    bookings = _report_bookings_queryset(
        request.user,
        date_from,
        date_to,
        _admin_salon_filter(request),
    )

    rows = (
        bookings.values('venue')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    venue_labels = dict(Booking._meta.get_field('venue').choices)

    return JsonResponse(
        {
            **_report_meta(request.user, date_from, date_to),
            'items': [
                {
                    'venue': row['venue'],
                    'venue_label': venue_labels.get(row['venue'], row['venue']),
                    'count': row['count'],
                }
                for row in rows
            ],
        }
    )


@require_http_methods(['GET'])
def report_by_worker(request):
    profile, denied = _require_report_access(request)
    if denied:
        return denied

    if profile.role != UserRole.ADMIN:
        return _forbidden('Only admins can view technician breakdown reports.')

    date_from, date_to = _parse_date_range(request)
    bookings = _report_bookings_queryset(
        request.user,
        date_from,
        date_to,
        _admin_salon_filter(request),
    )

    assigned = (
        bookings.filter(time_slot__worker__isnull=False)
        .values('time_slot__worker_id', 'time_slot__worker__first_name', 'time_slot__worker__username')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    preferred = (
        bookings.filter(time_slot__isnull=True, preferred_worker__isnull=False)
        .values('preferred_worker_id', 'preferred_worker__first_name', 'preferred_worker__username')
        .annotate(count=Count('id'))
    )

    worker_totals = {}
    for row in assigned:
        worker_id = row['time_slot__worker_id']
        name = row['time_slot__worker__first_name'] or row['time_slot__worker__username']
        worker_totals[worker_id] = {'worker_id': worker_id, 'worker_name': name, 'count': row['count']}

    for row in preferred:
        worker_id = row['preferred_worker_id']
        name = row['preferred_worker__first_name'] or row['preferred_worker__username']
        if worker_id in worker_totals:
            worker_totals[worker_id]['count'] += row['count']
        else:
            worker_totals[worker_id] = {'worker_id': worker_id, 'worker_name': name, 'count': row['count']}

    unassigned = bookings.filter(
        time_slot__isnull=True,
        preferred_worker__isnull=True,
    ).count()

    items = sorted(worker_totals.values(), key=lambda entry: (-entry['count'], entry['worker_name']))
    if unassigned:
        items.append({'worker_id': None, 'worker_name': 'Unassigned', 'count': unassigned})

    return JsonResponse(
        {
            **_report_meta(request.user, date_from, date_to),
            'items': items,
        }
    )


@require_http_methods(['GET'])
def report_timeline(request):
    _, denied = _require_report_access(request)
    if denied:
        return denied

    date_from, date_to = _parse_date_range(request)
    bookings = _report_bookings_queryset(
        request.user,
        date_from,
        date_to,
        _admin_salon_filter(request),
    )

    dated = bookings.annotate(
        appointment_date=Coalesce('time_slot__date', 'requested_date', TruncDate('created_at'))
    )

    rows = (
        dated.values('appointment_date')
        .annotate(count=Count('id'))
        .order_by('appointment_date')
    )

    return JsonResponse(
        {
            **_report_meta(request.user, date_from, date_to),
            'items': [
                {
                    'date': row['appointment_date'].isoformat() if row['appointment_date'] else None,
                    'count': row['count'],
                }
                for row in rows
            ],
        }
    )


@require_http_methods(['GET'])
def export_bookings_csv(request):
    _, denied = _require_report_access(request)
    if denied:
        return denied

    date_from, date_to = _parse_date_range(request)
    bookings = (
        _report_bookings_queryset(request.user, date_from, date_to, _admin_salon_filter(request))
        .select_related('time_slot')
        .order_by('-created_at')
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            'ID',
            'Client name',
            'Phone',
            'Service',
            'Venue',
            'Status',
            'Appointment date',
            'Time slot',
            'Technician',
            'Location',
            'Booked on',
        ]
    )

    for booking in bookings:
        slot = getattr(booking, 'time_slot', None)
        appointment_date = ''
        slot_label = ''
        technician = ''

        if slot:
            appointment_date = slot.date.isoformat()
            from .slot_utils import format_slot_label

            slot_label = format_slot_label(slot.start_hour)
            technician = _worker_name(slot.worker)
        elif booking.requested_date:
            appointment_date = booking.requested_date.isoformat()
            if booking.preferred_worker_id:
                technician = _worker_name(booking.preferred_worker)

        writer.writerow(
            [
                booking.id,
                booking.name,
                booking.phone,
                booking.service,
                booking.get_venue_display(),
                booking.get_status_display(),
                appointment_date,
                slot_label,
                technician,
                booking.location,
                booking.created_at.strftime('%Y-%m-%d %H:%M'),
            ]
        )

    response = HttpResponse(buffer.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = (
        f'attachment; filename="bookings-{date_from.isoformat()}-to-{date_to.isoformat()}.csv"'
    )
    return response
