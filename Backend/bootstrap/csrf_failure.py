from django.http import HttpResponseForbidden, JsonResponse


def csrf_failure(request, reason=''):
    wants_json = (
        request.path.startswith('/products/')
        or 'application/json' in (request.headers.get('Accept') or '')
        or request.content_type == 'application/json'
    )
    if wants_json:
        return JsonResponse(
            {
                'error': 'Your login session could not be verified. Refresh the page and try again.',
            },
            status=403,
        )
    return HttpResponseForbidden('CSRF verification failed. Please refresh and try again.')
