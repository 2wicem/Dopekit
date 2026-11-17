import json
from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .models import UserRole, WageType, WorkerAdvance, WorkerCompensation
from .payout_utils import (
    advance_to_dict,
    compensation_to_dict,
    summarize_worker_payout,
)
from .report_views import _parse_date_range
from .salon_owner_permissions import get_owned_salon, owned_salon_queryset, require_salon_owner
from .slot_utils import parse_date
from .technician_utils import is_approved_technician
from .worker_permissions import require_approved_worker

User = get_user_model()


def _owned_salon_ids(owner):
    return list(owned_salon_queryset(owner).values_list('id', flat=True))


def _parse_owned_salon(request, owner):
    owned_ids = _owned_salon_ids(owner)
    raw = request.GET.get('salon_id', '').strip()
    if not raw:
        return owned_ids, None, None
    try:
        salon_id = int(raw)
    except (TypeError, ValueError):
        return None, None, JsonResponse({'error': 'Invalid salon.'}, status=400)
    if salon_id not in owned_ids:
        return None, None, JsonResponse(
            {'error': 'You can only view payouts for your branches.'},
            status=403,
        )
    return [salon_id], salon_id, None


def _staff_on_salons(salon_ids):
    return (
        User.objects.filter(
            profile__role=UserRole.WORKER,
            profile__salon_id__in=salon_ids,
        )
        .select_related('profile', 'profile__salon')
        .order_by('first_name', 'username')
    )


@require_http_methods(['GET'])
def owner_payouts(request):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    salon_ids, _, error = _parse_owned_salon(request, owner)
    if error:
        return error

    date_from, date_to = _parse_date_range(request)
    plans = {
        (plan.worker_id, plan.salon_id): plan
        for plan in WorkerCompensation.objects.filter(salon_id__in=salon_ids)
    }

    workers = []
    for user in _staff_on_salons(salon_ids):
        if not is_approved_technician(user.profile):
            continue
        salon = user.profile.salon
        plan = plans.get((user.id, salon.id))
        workers.append(summarize_worker_payout(user, salon, date_from, date_to, plan))

    totals = {
        'jobs': sum(row['jobs'] for row in workers),
        'collected_kes': sum(row['collected_kes'] for row in workers),
        'commission_kes': sum(row['commission_kes'] for row in workers),
        'wage_kes': sum(row['wage_kes'] for row in workers),
        'earned_kes': sum(row['earned_kes'] for row in workers),
        'advances_kes': sum(row['advances_kes'] for row in workers),
        'net_pay_kes': sum(row['net_pay_kes'] for row in workers),
    }

    return JsonResponse(
        {
            'from': date_from.isoformat(),
            'to': date_to.isoformat(),
            'totals': totals,
            'workers': workers,
        }
    )


@require_http_methods(['PUT', 'PATCH'])
def update_worker_pay_plan(request, user_id):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    target = get_object_or_404(User.objects.select_related('profile', 'profile__salon'), pk=user_id)
    profile = getattr(target, 'profile', None)
    if not profile or profile.role != UserRole.WORKER or not profile.salon_id:
        return JsonResponse({'error': 'Technician is not assigned to a salon.'}, status=400)
    if profile.salon.owner_id != owner.id:
        return JsonResponse({'error': 'You can only set pay for technicians at your branches.'}, status=403)

    wage_type = (data.get('wage_type') or WageType.NONE).strip().lower()
    if wage_type not in WageType.values:
        return JsonResponse({'error': 'Choose no wage, daily, or weekly.'}, status=400)

    try:
        wage_kes = int(data.get('wage_kes') or 0)
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Enter a valid wage amount.'}, status=400)
    if wage_kes < 0:
        return JsonResponse({'error': 'Wage cannot be negative.'}, status=400)

    try:
        commission = Decimal(str(data.get('commission_percent') or 0))
    except (InvalidOperation, TypeError, ValueError):
        return JsonResponse({'error': 'Enter a valid commission percent.'}, status=400)
    if commission < 0 or commission > 100:
        return JsonResponse({'error': 'Commission must be between 0 and 100.'}, status=400)

    plan, _ = WorkerCompensation.objects.update_or_create(
        worker=target,
        salon=profile.salon,
        defaults={
            'wage_type': wage_type,
            'wage_kes': wage_kes,
            'commission_percent': commission,
        },
    )

    return JsonResponse(
        {
            'message': 'Pay plan saved.',
            'compensation': compensation_to_dict(plan),
            'worker_id': target.id,
        }
    )


@require_http_methods(['POST'])
def create_worker_advance(request):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    try:
        worker_id = int(data.get('worker_id'))
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Choose a technician.'}, status=400)

    target = get_object_or_404(User.objects.select_related('profile', 'profile__salon'), pk=worker_id)
    profile = getattr(target, 'profile', None)
    if not profile or profile.role != UserRole.WORKER or not profile.salon_id:
        return JsonResponse({'error': 'Technician is not assigned to a salon.'}, status=400)
    if profile.salon.owner_id != owner.id:
        return JsonResponse({'error': 'You can only record advances at your branches.'}, status=403)

    business_date = parse_date((data.get('business_date') or '').strip())
    if not business_date:
        return JsonResponse({'error': 'Choose a date for this advance.'}, status=400)

    try:
        amount = int(data.get('amount_kes'))
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Enter a valid advance amount.'}, status=400)
    if amount <= 0:
        return JsonResponse({'error': 'Advance must be greater than zero.'}, status=400)

    advance = WorkerAdvance.objects.create(
        worker=target,
        salon=profile.salon,
        business_date=business_date,
        amount_kes=amount,
        notes=(data.get('notes') or '').strip()[:200],
        recorded_by=owner,
    )

    return JsonResponse(
        {
            'message': 'Advance recorded.',
            'advance': advance_to_dict(advance),
        },
        status=201,
    )


@require_http_methods(['DELETE'])
def delete_worker_advance(request, advance_id):
    owner, denied = require_salon_owner(request)
    if denied:
        return denied

    advance = get_object_or_404(WorkerAdvance.objects.select_related('salon'), pk=advance_id)
    if advance.salon.owner_id != owner.id:
        return JsonResponse({'error': 'You can only remove advances at your branches.'}, status=403)
    advance.delete()
    return JsonResponse({'message': 'Advance removed.'})


@require_http_methods(['GET'])
def worker_payouts(request):
    worker, denied = require_approved_worker(request)
    if denied:
        return denied

    profile = getattr(worker, 'profile', None)
    if not profile or profile.role != UserRole.WORKER or not profile.salon_id:
        return JsonResponse(
            {
                'error': 'Payouts are set by your salon. You are not assigned to a branch yet.',
                'code': 'no_salon',
            },
            status=403,
        )

    date_from, date_to = _parse_date_range(request)
    summary = summarize_worker_payout(worker, profile.salon, date_from, date_to)
    return JsonResponse(
        {
            'from': date_from.isoformat(),
            'to': date_to.isoformat(),
            **summary,
        }
    )
