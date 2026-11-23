from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Q

from .inventory_views import _booking_appointment_date, _price_for_booking
from .models import Booking, BookingStatus, PaymentMethod, WageType, WorkerAdvance, WorkerCompensation
from .payment_utils import collected_amount
from .report_views import _appointment_date_filter, _worker_name


def booking_worker_id(booking):
    slot = getattr(booking, 'time_slot', None)
    if slot:
        return slot.worker_id
    return booking.preferred_worker_id


def worker_booking_q(worker):
    return Q(time_slot__worker=worker) | Q(time_slot__isnull=True, preferred_worker=worker)


def compensation_to_dict(plan):
    if not plan:
        return {
            'wage_type': WageType.NONE,
            'wage_type_label': 'No wage',
            'wage_kes': 0,
            'commission_percent': '0.00',
        }
    return {
        'wage_type': plan.wage_type,
        'wage_type_label': plan.get_wage_type_display(),
        'wage_kes': plan.wage_kes,
        'commission_percent': f'{plan.commission_percent:.2f}',
    }


def advance_to_dict(advance):
    return {
        'id': advance.id,
        'worker_id': advance.worker_id,
        'salon_id': advance.salon_id,
        'business_date': advance.business_date.isoformat(),
        'amount_kes': advance.amount_kes,
        'notes': advance.notes,
    }


def commission_kes(collected, percent):
    if not collected or not percent:
        return 0
    value = (Decimal(collected) * Decimal(percent) / Decimal('100')).quantize(
        Decimal('1'),
        rounding=ROUND_HALF_UP,
    )
    return int(value)


def wage_kes_for_dates(plan, work_dates):
    if not plan or plan.wage_type == WageType.NONE or not plan.wage_kes or not work_dates:
        return 0
    if plan.wage_type == WageType.DAILY:
        return plan.wage_kes * len(work_dates)
    weeks = {(date.isocalendar()[0], date.isocalendar()[1]) for date in work_dates}
    return plan.wage_kes * len(weeks)


def summarize_worker_payout(worker, salon, date_from, date_to, plan=None):
    bookings = list(
        Booking.objects.filter(
            _appointment_date_filter(date_from, date_to),
            status=BookingStatus.COMPLETED,
            salon_id=salon.id,
        )
        .filter(worker_booking_q(worker))
        .select_related('time_slot__worker', 'preferred_worker')
    )

    collected = 0
    jobs = 0
    work_dates = set()
    day_stats = defaultdict(lambda: {'jobs': 0, 'collected_kes': 0, 'advances_kes': 0})
    for booking in bookings:
        if booking_worker_id(booking) != worker.id:
            continue
        jobs += 1
        day = _booking_appointment_date(booking)
        if day:
            work_dates.add(day)
            bucket = day_stats[day.isoformat()]
            bucket['jobs'] += 1
            if booking.payment_method in (PaymentMethod.CASH, PaymentMethod.BANK):
                paid = collected_amount(booking, _price_for_booking(booking))
                collected += paid
                bucket['collected_kes'] += paid
        elif booking.payment_method in (PaymentMethod.CASH, PaymentMethod.BANK):
            collected += collected_amount(booking, _price_for_booking(booking))

    plan = plan or WorkerCompensation.objects.filter(worker=worker, salon=salon).first()
    percent = plan.commission_percent if plan else 0
    commission = commission_kes(collected, percent)
    wage = wage_kes_for_dates(plan, work_dates)
    advances = list(
        WorkerAdvance.objects.filter(
            worker=worker,
            salon=salon,
            business_date__gte=date_from,
            business_date__lte=date_to,
        )
    )
    advances_total = sum(item.amount_kes for item in advances)
    for item in advances:
        day_stats[item.business_date.isoformat()]['advances_kes'] += item.amount_kes

    daily = []
    for date_key in sorted(day_stats.keys(), reverse=True):
        bucket = day_stats[date_key]
        day_commission = commission_kes(bucket['collected_kes'], percent)
        day_wage = 0
        if plan and plan.wage_type == WageType.DAILY and bucket['jobs'] > 0 and plan.wage_kes:
            day_wage = plan.wage_kes
        day_earned = day_commission + day_wage
        daily.append(
            {
                'date': date_key,
                'jobs': bucket['jobs'],
                'income_kes': bucket['collected_kes'],
                'commission_kes': day_commission,
                'wage_kes': day_wage,
                'advances_kes': bucket['advances_kes'],
                'net_pay_kes': day_earned - bucket['advances_kes'],
            }
        )

    earned = commission + wage
    return {
        'worker_id': worker.id,
        'worker_name': _worker_name(worker),
        'salon_id': salon.id,
        'salon_name': salon.name,
        'jobs': jobs,
        'days_worked': len(work_dates),
        'collected_kes': collected,
        'income_kes': collected,
        'commission_kes': commission,
        'wage_kes': wage,
        'earned_kes': earned,
        'advances_kes': advances_total,
        'net_pay_kes': earned - advances_total,
        'compensation': compensation_to_dict(plan),
        'advances': [advance_to_dict(item) for item in advances],
        'days': daily,
    }
