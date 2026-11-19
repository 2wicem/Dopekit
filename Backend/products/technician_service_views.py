import json

from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .inventory_permissions import require_staff_inventory
from .models import TechnicianService
from .salon_utils import parse_service_price, technician_service_to_dict


def _service_payload(data):
    name = (data.get('name') or '').strip()
    if not name:
        return None, 'Service name is required.'
    if len(name) > 120:
        return None, 'Service name is too long.'
    price_kes, price_error = parse_service_price(data.get('price_kes'))
    if price_error:
        return None, price_error
    return {'name': name, 'price_kes': price_kes}, None


@require_http_methods(['GET', 'POST'])
def my_technician_services(request):
    _profile, denied = require_staff_inventory(request)
    if denied:
        return denied

    if request.method == 'GET':
        services = TechnicianService.objects.filter(technician=request.user)
        return JsonResponse(
            {'services': [technician_service_to_dict(service) for service in services]}
        )

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    payload, error = _service_payload(data)
    if error:
        return JsonResponse({'error': error}, status=400)

    service = TechnicianService.objects.create(
        technician=request.user,
        name=payload['name'],
        price_kes=payload['price_kes'],
        is_active=data.get('is_active', True) is not False,
    )
    return JsonResponse(
        {
            'message': f'{service.name} added to your technician menu.',
            'service': technician_service_to_dict(service),
        },
        status=201,
    )


@require_http_methods(['PATCH', 'DELETE'])
def update_my_technician_service(request, service_id):
    _profile, denied = require_staff_inventory(request)
    if denied:
        return denied

    service = get_object_or_404(TechnicianService, pk=service_id, technician=request.user)

    if request.method == 'DELETE':
        name = service.name
        service.delete()
        return JsonResponse({'message': f'{name} removed from your technician menu.'})

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON.'}, status=400)

    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return JsonResponse({'error': 'Service name is required.'}, status=400)
        if len(name) > 120:
            return JsonResponse({'error': 'Service name is too long.'}, status=400)
        service.name = name
    if 'price_kes' in data:
        price_kes, price_error = parse_service_price(data.get('price_kes'))
        if price_error:
            return JsonResponse({'error': price_error}, status=400)
        service.price_kes = price_kes
    if 'is_active' in data:
        service.is_active = bool(data.get('is_active'))

    service.save()
    return JsonResponse(
        {
            'message': 'Service updated.',
            'service': technician_service_to_dict(service),
        }
    )
