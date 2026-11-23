from django.http import JsonResponse


def forbidden(message='Permission denied.'):
    return JsonResponse({'error': message}, status=403)


def unauthorized(message='Authentication required.'):
    return JsonResponse({'error': message}, status=401)


def public_json(payload, *, max_age=60, stale=120):
    response = JsonResponse(payload)
    response['Cache-Control'] = (
        f'public, max-age={max_age}, stale-while-revalidate={stale}'
    )
    return response
