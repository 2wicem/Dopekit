from django.conf import settings
from django.http import HttpResponseForbidden

from .client_ip import client_ip


class RestrictDjangoAdminMiddleware:
    """Optional IP allowlist for the Django admin path."""

    def __init__(self, get_response):
        self.get_response = get_response
        path = (getattr(settings, 'DJANGO_ADMIN_PATH', 'admin/') or 'admin/').strip()
        if not path.endswith('/'):
            path = f'{path}/'
        if not path.startswith('/'):
            path = f'/{path}'
        self.admin_prefix = path

    def __call__(self, request):
        allowed = getattr(settings, 'ADMIN_ALLOWED_IPS', [])
        if allowed and request.path.startswith(self.admin_prefix):
            if client_ip(request) not in allowed:
                return HttpResponseForbidden('Admin is not available from this network.')
        return self.get_response(request)
