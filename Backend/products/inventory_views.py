import json
from collections import defaultdict
from datetime import timedelta

from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Booking, BookingStatus, DailyExpense, DailyMpesaDeposit, PaymentMethod, Salon, UserRole
from .report_views import (
    _appointment_date_filter,
    _parse_date_range,
    _report_bookings_queryset,
    _report_meta,
    _worker_name,
)
from .salon_utils import (
    filter_bookings_by_salon,
    filter_bookings_for_owned_salons,
    resolve_salon_id,
)
from .payment_utils import collected_amount
from .service_prices import resolve_service_price_kes
from .inventory_permissions import (
    can_record_expenses,
    inventory_salon_scope,
    require_expense_access,
    require_staff_inventory,
)
from .technician_utils import is_freelance_technician

MAX_INVENTORY_DAYS = 62


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


def _parse_inventory_worker_id(request):
    raw = (request.GET.get('worker_id') or '').strip()
    if raw in ('', 'all'):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _filter_bookings_by_worker(queryset, worker_id):
    if worker_id is None:
        return queryset
    return queryset.filter(Q(preferred_worker_id=worker_id) | Q(time_slot__worker_id=worker_id))


def _can_cancel_inventory_booking(profile, user, booking) -> bool:
    if booking.status == BookingStatus.CANCELLED:
        return False
    if profile.role == UserRole.ADMIN:
        return True
    if profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import booking_in_owned_salons

        return booking_in_owned_salons(user, booking)
    if profile.role == UserRole.WORKER:
        slot = getattr(booking, 'time_slot', None)
        if slot and slot.worker_id:
            return slot.worker_id == user.id
        return booking.preferred_worker_id == user.id
    return False


def _inventory_bookings_queryset(user, profile, date_from, date_to, salon_id, worker_id=None):
    if profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        queryset = (
            Booking.objects.filter(_appointment_date_filter(date_from, date_to))
            .select_related('time_slot__worker', 'preferred_worker', 'user', 'salon')
        )
        queryset = filter_bookings_for_owned_salons(queryset, owned_salon_ids(user), salon_id)
        return _filter_bookings_by_worker(queryset, worker_id)
    if salon_id is not None:
        queryset = (
            Booking.objects.filter(_appointment_date_filter(date_from, date_to))
            .select_related('time_slot__worker', 'preferred_worker', 'user', 'salon')
        )
        queryset = filter_bookings_by_salon(queryset, salon_id)
        return _filter_bookings_by_worker(queryset, worker_id)
    queryset = _report_bookings_queryset(user, date_from, date_to, None)
    return _filter_bookings_by_worker(queryset, worker_id)


def _expenses_queryset(user, profile, salon_id, date_from, date_to):
    queryset = DailyExpense.objects.filter(
        business_date__gte=date_from,
        business_date__lte=date_to,
    ).select_related('recorded_by', 'salon')

    if profile.role == UserRole.ADMIN:
        if salon_id:
            queryset = queryset.filter(salon_id=salon_id)
    elif profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        ids = owned_salon_ids(user)
        if salon_id:
            queryset = queryset.filter(salon_id=salon_id) if salon_id in ids else queryset.none()
        else:
            queryset = queryset.filter(salon_id__in=ids)
    elif is_freelance_technician(profile):
        queryset = queryset.filter(recorded_by=user)
    else:
        queryset = queryset.none()

    return queryset.order_by('business_date', 'id')


def _mpesa_deposits_queryset(user, profile, salon_id, date_from, date_to):
    queryset = DailyMpesaDeposit.objects.filter(
        business_date__gte=date_from,
        business_date__lte=date_to,
    ).select_related('recorded_by', 'salon')

    if profile.role == UserRole.ADMIN:
        if salon_id:
            queryset = queryset.filter(salon_id=salon_id)
    elif profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        ids = owned_salon_ids(user)
        if salon_id:
            queryset = queryset.filter(salon_id=salon_id) if salon_id in ids else queryset.none()
        else:
            queryset = queryset.filter(salon_id__in=ids)
    elif is_freelance_technician(profile):
        queryset = queryset.filter(recorded_by=user, salon__isnull=True)
    else:
        queryset = queryset.none()

    return queryset.order_by('business_date', 'id')


def _mpesa_deposit_to_dict(deposit) -> dict:
    return {
        'id': deposit.id,
        'business_date': deposit.business_date.isoformat(),
        'mpesa_code': deposit.mpesa_code,
        'amount_kes': deposit.amount_kes,
        'notes': deposit.notes or '',
    }


@require_http_methods(['GET'])
def report_daily_inventory(request):
    profile, denied = require_staff_inventory(request)
    if denied:
        return denied

    date_from, date_to = _parse_date_range(request)
    if (date_to - date_from).days > MAX_INVENTORY_DAYS:
        date_from = date_to - timedelta(days=MAX_INVENTORY_DAYS)

    include_rows = request.GET.get('detail', '').strip().lower() in ('1', 'true', 'yes')
    if date_from == date_to:
        include_rows = True

    salon_id = inventory_salon_scope(request, profile)
    worker_id = _parse_inventory_worker_id(request)
    bookings = list(
        _inventory_bookings_queryset(
            request.user,
            profile,
            date_from,
            date_to,
            salon_id,
            worker_id=worker_id,
        )
    )

    expenses = []
    deposits = []
    if worker_id is None:
        expenses = list(_expenses_queryset(request.user, profile, salon_id, date_from, date_to))
        deposits = list(_mpesa_deposits_queryset(request.user, profile, salon_id, date_from, date_to))

    days_map = defaultdict(
        lambda: {
            'services': [],
            'expenses': [],
            'mpesa_deposit': None,
            'by_worker': defaultdict(
                lambda: {
                    'count': 0,
                    'revenue_kes': 0,
                    'cash_kes': 0,
                    'bank_kes': 0,
                    'unpaid_kes': 0,
                }
            ),
        }
    )

    for booking in bookings:
        if booking.status == BookingStatus.CANCELLED:
            continue

        day = _booking_appointment_date(booking)
        if day is None:
            continue

        price = _price_for_booking(booking)
        paid = collected_amount(booking, price)
        worker_name = _booking_worker_name(booking)
        method = booking.payment_method or ''
        entry = {
            'booking_id': booking.id,
            'client_name': booking.name,
            'client_phone': booking.phone or '',
            'service': booking.service or '—',
            'price_kes': price,
            'worker_name': worker_name,
            'status': booking.status,
            'status_label': booking.get_status_display(),
            'is_walk_in': bool(booking.is_walk_in),
            'can_complete': booking.status in (BookingStatus.PENDING, BookingStatus.ACCEPTED),
            'can_cancel': _can_cancel_inventory_booking(profile, request.user, booking),
            'worker_id': booking.preferred_worker_id
            or (booking.time_slot.worker_id if getattr(booking, 'time_slot', None) else None),
            'payment_method': method,
            'payment_method_label': (
                booking.get_payment_method_display() if method else ''
            ),
            'payment_amount_kes': booking.payment_amount_kes,
            'record_code': booking.record_code or '',
            'mpesa_code': booking.mpesa_code or '',
        }
        days_map[day.isoformat()]['services'].append(entry)

        worker_bucket = days_map[day.isoformat()]['by_worker'][worker_name]
        worker_bucket['count'] += 1
        if booking.status in (BookingStatus.ACCEPTED, BookingStatus.COMPLETED):
            worker_bucket['revenue_kes'] += price
        if booking.status == BookingStatus.COMPLETED:
            if method == PaymentMethod.CASH:
                worker_bucket['cash_kes'] += paid
            elif method == PaymentMethod.BANK:
                worker_bucket['bank_kes'] += paid
            else:
                worker_bucket['unpaid_kes'] += paid

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
                'can_delete': (
                    profile.role == UserRole.SALON_OWNER
                    or expense.recorded_by_id == request.user.id
                ),
            }
        )

    for deposit in deposits:
        days_map[deposit.business_date.isoformat()]['mpesa_deposit'] = _mpesa_deposit_to_dict(deposit)

    days = []
    cursor = date_from
    while cursor <= date_to:
        key = cursor.isoformat()
        bucket = days_map[key]
        services = bucket['services']
        expense_rows = bucket['expenses']
        mpesa_deposit = bucket['mpesa_deposit']

        counted = [
            row
            for row in services
            if row['status'] in (BookingStatus.ACCEPTED, BookingStatus.COMPLETED)
        ]
        pending = [row for row in services if row['status'] == BookingStatus.PENDING]
        completed = [row for row in services if row['status'] == BookingStatus.COMPLETED]

        revenue_kes = sum(row['price_kes'] for row in counted)
        expenses_kes = sum(row['amount_kes'] for row in expense_rows)
        cash_kes = sum(
            (row['payment_amount_kes'] if row['payment_amount_kes'] is not None else row['price_kes'])
            for row in completed
            if row['payment_method'] == PaymentMethod.CASH
        )
        bank_kes = sum(
            (row['payment_amount_kes'] if row['payment_amount_kes'] is not None else row['price_kes'])
            for row in completed
            if row['payment_method'] == PaymentMethod.BANK
        )
        unpaid_kes = sum(
            (row['payment_amount_kes'] if row['payment_amount_kes'] is not None else row['price_kes'])
            for row in completed
            if not row['payment_method']
        )

        if not services and not expense_rows and not mpesa_deposit:
            cursor += timedelta(days=1)
            continue

        by_worker = [
            {
                'worker_name': name,
                'count': stats['count'],
                'revenue_kes': stats['revenue_kes'],
                'cash_kes': stats['cash_kes'],
                'bank_kes': stats['bank_kes'],
                'unpaid_kes': stats['unpaid_kes'],
            }
            for name, stats in sorted(
                bucket['by_worker'].items(),
                key=lambda item: (-item[1]['revenue_kes'], -item[1]['count'], item[0]),
            )
        ]

        day_payload = {
            'date': key,
            'services_count': len(services),
            'accepted_count': len(counted),
            'pending_count': len(pending),
            'revenue_kes': revenue_kes,
            'cash_kes': cash_kes,
            'bank_kes': bank_kes,
            'unpaid_kes': unpaid_kes,
            'expenses_kes': expenses_kes,
            'net_kes': revenue_kes - expenses_kes,
            'mpesa_deposit': mpesa_deposit,
            'details_loaded': include_rows,
        }
        if include_rows:
            day_payload['services'] = sorted(services, key=lambda row: row['booking_id'])
            day_payload['expenses'] = expense_rows
            day_payload['by_worker'] = by_worker
        days.append(day_payload)
        cursor += timedelta(days=1)

    totals = {
        'services_count': sum(day['services_count'] for day in days),
        'accepted_count': sum(day['accepted_count'] for day in days),
        'revenue_kes': sum(day['revenue_kes'] for day in days),
        'cash_kes': sum(day['cash_kes'] for day in days),
        'bank_kes': sum(day['bank_kes'] for day in days),
        'unpaid_kes': sum(day['unpaid_kes'] for day in days),
        'expenses_kes': sum(day['expenses_kes'] for day in days),
        'net_kes': sum(day['net_kes'] for day in days),
        'mpesa_deposited_kes': sum(
            (day['mpesa_deposit'] or {}).get('amount_kes', 0) for day in days
        ),
    }

    meta = _report_meta(request.user, date_from, date_to)
    if salon_id is not None:
        meta['scope'] = 'salon'

    return JsonResponse(
        {
            **meta,
            'premium_inventory': can_record_expenses(request.user),
            'totals': totals,
            'days': days,
        }
    )


@require_http_methods(['POST'])
def create_daily_expense(request):
    profile, denied = require_expense_access(request)
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
    if profile.role == UserRole.WORKER:
        salon = None
    elif profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        owned_ids = owned_salon_ids(request.user)
        salon_id = resolve_salon_id(data.get('salon_id'))
        if salon_id not in owned_ids:
            if len(owned_ids) == 1:
                salon_id = owned_ids[0]
            else:
                return JsonResponse({'error': 'Choose one of your salon branches.'}, status=400)
        salon = Salon.objects.filter(pk=salon_id, is_active=True).first()
    else:
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


@require_http_methods(['DELETE'])
def delete_daily_expense(request, expense_id):
    profile, denied = require_expense_access(request)
    if denied:
        return denied

    expense = DailyExpense.objects.filter(pk=expense_id).first()
    if expense is None:
        return JsonResponse({'error': 'Expense not found.'}, status=404)

    if profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        if expense.salon_id not in owned_salon_ids(request.user):
            return JsonResponse({'error': 'Expense not found for this salon.'}, status=404)
    elif expense.recorded_by_id != request.user.id:
        return JsonResponse({'error': 'You can only remove expenses you recorded.'}, status=403)

    expense.delete()
    return JsonResponse({'message': 'Expense removed.'})


@require_http_methods(['POST'])
def upsert_daily_mpesa_deposit(request):
    profile, denied = require_expense_access(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    from .record_codes import normalize_mpesa_code
    from .slot_utils import parse_date

    business_date = parse_date((data.get('business_date') or '').strip())
    if not business_date:
        return JsonResponse({'error': 'Choose a valid date for this M-Pesa deposit.'}, status=400)

    mpesa_code = normalize_mpesa_code(data.get('mpesa_code') or '')
    if len(mpesa_code) < 8:
        return JsonResponse({'error': 'Enter a valid M-Pesa receipt code.'}, status=400)

    try:
        amount_kes = int(data.get('amount_kes'))
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Enter a valid amount deposited in KES.'}, status=400)

    if amount_kes <= 0:
        return JsonResponse({'error': 'Amount must be greater than zero.'}, status=400)

    notes = (data.get('notes') or '').strip()

    salon = None
    if profile.role == UserRole.WORKER:
        salon = None
    elif profile.role == UserRole.SALON_OWNER:
        from .salon_owner_permissions import owned_salon_ids

        owned_ids = owned_salon_ids(request.user)
        salon_id = resolve_salon_id(data.get('salon_id'))
        if salon_id not in owned_ids:
            if len(owned_ids) == 1:
                salon_id = owned_ids[0]
            else:
                return JsonResponse({'error': 'Choose one of your salon branches.'}, status=400)
        salon = Salon.objects.filter(pk=salon_id, is_active=True).first()
    else:
        salon_id = resolve_salon_id(data.get('salon_id'))
        if salon_id:
            salon = Salon.objects.filter(pk=salon_id, is_active=True).first()

    lookup = {'business_date': business_date}
    if salon is not None:
        lookup['salon'] = salon
    else:
        lookup['salon'] = None
        lookup['recorded_by'] = request.user

    deposit, created = DailyMpesaDeposit.objects.update_or_create(
        **lookup,
        defaults={
            'mpesa_code': mpesa_code,
            'amount_kes': amount_kes,
            'notes': notes,
            'recorded_by': request.user,
            'salon': salon,
        },
    )

    return JsonResponse(
        {
            'message': 'End-of-day M-Pesa deposit saved.' if created else 'End-of-day M-Pesa deposit updated.',
            'mpesa_deposit': _mpesa_deposit_to_dict(deposit),
        },
        status=201 if created else 200,
    )
