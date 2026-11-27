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
from .salon_utils import (
    filter_bookings_by_salon,
    filter_bookings_for_owned_salons,
    parse_admin_salon_id,
)
from .slot_utils import parse_date
from .views import _forbidden, _unauthorized
from .worker_permissions import require_approved_worker

User = get_user_model()

DEFAULT_RANGE_DAYS = 30


def _require_report_access(request):
    if not request.user.is_authenticated:
        return None, _unauthorized()

    profile = getattr(request.user, 'profile', None)
    if not profile or profile.role not in (UserRole.WORKER, UserRole.ADMIN, UserRole.SALON_OWNER):
        return None, _forbidden('Only technicians, salon owners, and admins can view reports.')

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
    elif profile and profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        queryset = filter_bookings_for_owned_salons(
            queryset,
            owned_salon_ids(user),
            salon_id,
        )

    return queryset


def _admin_salon_filter(request):
    profile = getattr(request.user, 'profile', None)
    if profile and profile.role == UserRole.ADMIN:
        return parse_admin_salon_id(request)
    if profile and profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        requested = parse_admin_salon_id(request)
        ids = owned_salon_ids(request.user)
        if requested and requested not in ids:
            return -1
        return requested
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
        'scope': (
            'salon'
            if profile and profile.role in (UserRole.ADMIN, UserRole.SALON_OWNER)
            else 'technician'
        ),
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

    if profile.role not in (UserRole.ADMIN, UserRole.SALON_OWNER):
        return _forbidden('Only salon owners and admins can view technician breakdown reports.')

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


EXPORT_HEADERS = [
    'ID',
    'Record code',
    'M-Pesa code',
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


def _booking_export_rows(request):
    date_from, date_to = _parse_date_range(request)
    bookings = (
        _report_bookings_queryset(request.user, date_from, date_to, _admin_salon_filter(request))
        .select_related('time_slot')
        .order_by('-created_at')
    )

    rows = []
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

        rows.append(
            [
                booking.id,
                booking.record_code or '',
                booking.mpesa_code or '',
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

    return date_from, date_to, rows


@require_http_methods(['GET'])
def export_bookings_csv(request):
    _, denied = _require_report_access(request)
    if denied:
        return denied

    date_from, date_to, rows = _booking_export_rows(request)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(EXPORT_HEADERS)
    writer.writerows(rows)

    response = HttpResponse(buffer.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = (
        f'attachment; filename="bookings-{date_from.isoformat()}-to-{date_to.isoformat()}.csv"'
    )
    return response


@require_http_methods(['GET'])
def export_bookings_pdf(request):
    _, denied = _require_report_access(request)
    if denied:
        return denied

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    date_from, date_to, rows = _booking_export_rows(request)
    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=f'Dopekit bookings {date_from.isoformat()} to {date_to.isoformat()}',
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DopekitTitle',
        parent=styles['Heading1'],
        fontSize=14,
        textColor=colors.HexColor('#6d3557'),
        spaceAfter=4,
    )
    meta_style = ParagraphStyle(
        'DopekitMeta',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#5c4a52'),
        spaceAfter=8,
    )
    cell_style = ParagraphStyle(
        'DopekitCell',
        parent=styles['Normal'],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#241820'),
    )
    header_style = ParagraphStyle(
        'DopekitHeader',
        parent=cell_style,
        fontName='Helvetica-Bold',
        textColor=colors.white,
    )

    def cell(value, header=False):
        text = str(value if value not in (None, '') else '—')
        return Paragraph(text.replace('&', '&amp;').replace('<', '&lt;'), header_style if header else cell_style)

    table_data = [[cell(label, header=True) for label in EXPORT_HEADERS]]
    table_data.extend([[cell(value) for value in row] for row in rows])
    if not rows:
        table_data.append([cell('No bookings in this date range.')] + [cell('')] * (len(EXPORT_HEADERS) - 1))

    table = Table(
        table_data,
        repeatRows=1,
        colWidths=[
            12 * mm,
            20 * mm,
            22 * mm,
            22 * mm,
            20 * mm,
            22 * mm,
            14 * mm,
            16 * mm,
            20 * mm,
            16 * mm,
            20 * mm,
            32 * mm,
            20 * mm,
        ],
    )
    table.setStyle(
        TableStyle(
            [
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6d3557')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#fff8fa')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#fff8fa'), colors.HexColor('#f7eef2')]),
                ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#d8c4cc')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]
        )
    )

    document.build(
        [
            Paragraph('Dopekit booking report', title_style),
            Paragraph(
                f'{date_from.isoformat()} to {date_to.isoformat()} · {len(rows)} booking'
                f'{"s" if len(rows) != 1 else ""}',
                meta_style,
            ),
            Spacer(1, 4),
            table,
        ]
    )

    response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
    response['Content-Disposition'] = (
        f'attachment; filename="bookings-{date_from.isoformat()}-to-{date_to.isoformat()}.pdf"'
    )
    return response
