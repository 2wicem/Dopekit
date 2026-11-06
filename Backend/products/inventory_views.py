import json
from collections import defaultdict
from datetime import timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Booking, BookingStatus, DailyExpense, Salon
from .report_views import (
    _appointment_date_filter,
    _parse_date_range,
    _report_bookings_queryset,
    _report_meta,
    _worker_name,
)
from .salon_utils import filter_bookings_by_salon, parse_admin_salon_id, resolve_salon_id
from .admin_views import _require_admin
from .service_prices import resolve_service_price_kes
from .inventory_permissions import inventory_salon_scope, require_premium_inventory


def _booking_appointment_date(booking):
    slot = getattr(booking, 'time_slot', None)
    if slot:
        return slot.date
    if booking.requested_date:
        return booking.requested_date
    return timezone.localdate(booking.created_at)


def _booking_worker_name(booking):
    slot = getattr(booking, 'time_slot', None)
    if slot:
        return _worker_name(slot.worker)
    if booking.preferred_worker_id:
        return _worker_name(booking.preferred_worker)
    return 'Unassigned'


def _price_for_booking(booking) -> int:
    if booking.service_price_kes is not None:
        return booking.service_price_kes
    resolved = resolve_service_price_kes(booking.service)
    return resolved if resolved is not None else 0


def _inventory_bookings_queryset(user, profile, date_from, date_to, salon_id):
    if salon_id is not None:
        queryset = (
            Booking.objects.filter(_appointment_date_filter(date_from, date_to))
            .select_related('time_slot__worker', 'preferred_worker', 'user', 'salon')
        )
        return filter_bookings_by_salon(queryset, salon_id)
    return _report_bookings_queryset(user, date_from, date_to, None)


def _expenses_queryset(salon_id, date_from, date_to):
    queryset = DailyExpense.objects.filter(
        business_date__gte=date_from,
        business_date__lte=date_to,
    ).select_related('recorded_by', 'salon')

    if salon_id:
        queryset = queryset.filter(salon_id=salon_id)

    return queryset.order_by('business_date', 'id')


@require_http_methods(['GET'])
def report_daily_inventory(request):
    profile, denied = require_premium_inventory(request)
    if denied:
        return denied

    date_from, date_to = _parse_date_range(request)
    salon_id = inventory_salon_scope(request, profile)
    bookings = list(
        _inventory_bookings_queryset(
            request.user,
            profile,
            date_from,
            date_to,
            salon_id,
        )
    )

    expenses = list(_expenses_queryset(salon_id, date_from, date_to))

    days_map = defaultdict(
        lambda: {
            'services': [],
            'expenses': [],
            'by_worker': defaultdict(lambda: {'count': 0, 'revenue_kes': 0}),
        }
    )

    for booking in bookings:
        if booking.status == BookingStatus.CANCELLED:
            continue

        day = _booking_appointment_date(booking)
        if day is None:
            continue

        price = _price_for_booking(booking)
        worker_name = _booking_worker_name(booking)
        entry = {
            'booking_id': booking.id,
            'client_name': booking.name,
            'service': booking.service or '—',
            'price_kes': price,
            'worker_name': worker_name,
            'status': booking.status,
            'status_label': booking.get_status_display(),
        }
        days_map[day.isoformat()]['services'].append(entry)

        worker_bucket = days_map[day.isoformat()]['by_worker'][worker_name]
        worker_bucket['count'] += 1
        if booking.status == BookingStatus.ACCEPTED:
            worker_bucket['revenue_kes'] += price

    for expense in expenses:
        day_key = expense.business_date.isoformat()
        days_map[day_key]['expenses'].append(
            {
                'id': expense.id,
                'label': expense.label,
                'category': expense.category,
                'category_label': expense.get_category_display(),
                'amount_kes': expense.amount_kes,
                'notes': expense.notes,
            }
        )

    days = []
    cursor = date_from
    while cursor <= date_to:
        key = cursor.isoformat()
        bucket = days_map[key]
        services = bucket['services']
        expense_rows = bucket['expenses']

        accepted = [row for row in services if row['status'] == BookingStatus.ACCEPTED]
        pending = [row for row in services if row['status'] == BookingStatus.PENDING]

        revenue_kes = sum(row['price_kes'] for row in accepted)
        expenses_kes = sum(row['amount_kes'] for row in expense_rows)

        by_worker = [
            {
                'worker_name': name,
                'count': stats['count'],
                'revenue_kes': stats['revenue_kes'],
            }
            for name, stats in sorted(
                bucket['by_worker'].items(),
                key=lambda item: (-item[1]['revenue_kes'], -item[1]['count'], item[0]),
            )
        ]

        days.append(
            {
                'date': key,
                'services_count': len(services),
                'accepted_count': len(accepted),
                'pending_count': len(pending),
                'revenue_kes': revenue_kes,
                'expenses_kes': expenses_kes,
                'net_kes': revenue_kes - expenses_kes,
                'services': sorted(services, key=lambda row: row['booking_id']),
                'expenses': expense_rows,
                'by_worker': by_worker,
            }
        )
        cursor += timedelta(days=1)

    totals = {
        'services_count': sum(day['services_count'] for day in days),
        'accepted_count': sum(day['accepted_count'] for day in days),
        'revenue_kes': sum(day['revenue_kes'] for day in days),
        'expenses_kes': sum(day['expenses_kes'] for day in days),
        'net_kes': sum(day['net_kes'] for day in days),
    }

    meta = _report_meta(request.user, date_from, date_to)
    if salon_id is not None:
        meta['scope'] = 'salon'

    return JsonResponse(
        {
            **meta,
            'premium_inventory': True,
            'totals': totals,
            'days': days,
        }
    )


@csrf_exempt
@require_http_methods(['POST'])
def create_daily_expense(request):
    denied = _require_admin(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    label = (data.get('label') or '').strip()
    business_date_raw = (data.get('business_date') or '').strip()
    amount_raw = data.get('amount_kes')
    category = (data.get('category') or DailyExpense.Category.OTHER).strip().lower()
    notes = (data.get('notes') or '').strip()

    if not label:
        return JsonResponse({'error': 'Expense label is required.'}, status=400)

    from .slot_utils import parse_date

    business_date = parse_date(business_date_raw)
    if not business_date:
        return JsonResponse({'error': 'Choose a valid date for this expense.'}, status=400)

    try:
        amount_kes = int(amount_raw)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Enter a valid amount in KES.'}, status=400)

    if amount_kes <= 0:
        return JsonResponse({'error': 'Amount must be greater than zero.'}, status=400)

    valid_categories = {choice.value for choice in DailyExpense.Category}
    if category not in valid_categories:
        return JsonResponse({'error': 'Invalid expense category.'}, status=400)

    salon = None
    salon_id = resolve_salon_id(data.get('salon_id'))
    if salon_id:
        salon = Salon.objects.filter(pk=salon_id, is_active=True).first()

    expense = DailyExpense.objects.create(
        salon=salon,
        business_date=business_date,
        label=label,
        category=category,
        amount_kes=amount_kes,
        notes=notes,
        recorded_by=request.user,
    )

    return JsonResponse(
        {
            'message': 'Expense recorded.',
            'expense': {
                'id': expense.id,
                'business_date': expense.business_date.isoformat(),
                'label': expense.label,
                'category': expense.category,
                'category_label': expense.get_category_display(),
                'amount_kes': expense.amount_kes,
                'notes': expense.notes,
            },
        },
        status=201,
    )


@csrf_exempt
@require_http_methods(['DELETE'])
def delete_daily_expense(request, expense_id):
    denied = _require_admin(request)
    if denied:
        return denied

    expense = DailyExpense.objects.filter(pk=expense_id).first()
    if expense is None:
        return JsonResponse({'error': 'Expense not found.'}, status=404)

    salon_id = parse_admin_salon_id(request)
    if salon_id and expense.salon_id not in (None, salon_id):
        return JsonResponse({'error': 'Expense not found for this salon.'}, status=404)

    expense.delete()
    return JsonResponse({'message': 'Expense removed.'})
