import functools

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse

from bootstrap.client_ip import client_ip


def rate_limit(scope: str):
    """IP-based rate limiter using Django cache (Redis in production when REDIS_URL is set)."""

    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapped(request, *args, **kwargs):
            limits = getattr(settings, 'RATE_LIMITS', {})
            limit, window = limits.get(scope, (60, 60))
            ip = client_ip(request)
            key = f'ratelimit:{scope}:{ip}'
            if cache.add(key, 1, timeout=window):
                return view_func(request, *args, **kwargs)
            try:
                current = cache.incr(key)
            except ValueError:
                cache.set(key, 1, timeout=window)
                current = 1
            if current > limit:
                return JsonResponse(
                    {
                        'error': 'Too many requests. Please wait a few minutes and try again.',
                    },
                    status=429,
                )
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator
