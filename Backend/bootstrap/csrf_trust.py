"""Ensure the live request host is trusted for Django admin CSRF checks."""

from django.conf import settings


class TrustRequestHostCsrfMiddleware:
    """
    Railway/admin login posts from the API domain itself. If SITE_URL points at
    the frontend, CSRF_TRUSTED_ORIGINS may omit the backend host and admin login
    fails with 403 even on same-origin form posts (common on mobile).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        host = (request.get_host() or '').split(':')[0].strip()
        if host and host not in ('localhost', '127.0.0.1'):
            scheme = 'https' if settings.USE_HTTPS or request.is_secure() else 'http'
            origin = f'{scheme}://{host}'
            trusted = settings.CSRF_TRUSTED_ORIGINS
            if origin not in trusted:
                trusted.append(origin)
        return self.get_response(request)
