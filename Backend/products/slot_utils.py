from types import SimpleNamespace

SLOT_HOURS = [8, 10, 12, 14, 16, 18]
SLOT_DURATION_HOURS = 2
PUBLIC_SCHEDULE_DAYS = 7


def parse_date(value):
    from datetime import date

    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def format_slot_label(start_hour):
    end_hour = start_hour + SLOT_DURATION_HOURS

    def fmt(hour):
        suffix = 'AM' if hour < 12 else 'PM'
        display = hour % 12
        if display == 0:
            display = 12
        return f'{display}:00 {suffix}'

    return f'{fmt(start_hour)} – {fmt(end_hour)}'


def is_past_slot(slot_date, start_hour) -> bool:
    from django.utils import timezone

    today = timezone.localdate()
    if slot_date < today:
        return True
    if slot_date > today:
        return False
    now = timezone.localtime()
    return start_hour + SLOT_DURATION_HOURS <= now.hour


def ensure_default_available_slots(workers, date_from, date_to):
    """Create open hours for the range unless a booked or off slot already exists."""
    from datetime import timedelta

    from .models import SlotStatus, TimeSlot

    worker_list = list(workers)
    if not worker_list or date_to < date_from:
        return

    worker_ids = [worker.pk for worker in worker_list]
    existing_keys = set(
        TimeSlot.objects.filter(
            worker_id__in=worker_ids,
            date__gte=date_from,
            date__lte=date_to,
        ).values_list('worker_id', 'date', 'start_hour')
    )

    to_create = []
    cursor = date_from
    while cursor <= date_to:
        for worker in worker_list:
            for hour in SLOT_HOURS:
                if is_past_slot(cursor, hour):
                    continue
                if (worker.pk, cursor, hour) in existing_keys:
                    continue
                to_create.append(
                    TimeSlot(
                        worker=worker,
                        date=cursor,
                        start_hour=hour,
                        status=SlotStatus.AVAILABLE,
                    )
                )
        cursor += timedelta(days=1)

    if to_create:
        TimeSlot.objects.bulk_create(to_create, ignore_conflicts=True)


def count_open_slots(worker, date_from, date_to):
    from datetime import timedelta

    from .models import SlotStatus, TimeSlot

    existing = {
        (slot.date, slot.start_hour): slot
        for slot in TimeSlot.objects.filter(
            worker=worker,
            date__gte=date_from,
            date__lte=date_to,
        )
    }

    open_count = 0
    next_slot = None
    cursor = date_from
    while cursor <= date_to:
        for hour in SLOT_HOURS:
            if is_past_slot(cursor, hour):
                continue
            slot = existing.get((cursor, hour))
            status = slot.status if slot else SlotStatus.AVAILABLE
            if status != SlotStatus.AVAILABLE:
                continue
            open_count += 1
            if next_slot is None:
                next_slot = slot or SimpleNamespace(date=cursor, start_hour=hour)
        cursor += timedelta(days=1)

    return open_count, next_slot
