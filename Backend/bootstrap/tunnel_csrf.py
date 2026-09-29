"""DEBUG-only CSRF trust for public preview tunnels (Cloudflare / ngrok)."""

import re

from django.conf import settings

TUNNEL_ORIGIN_RE = re.compile(
    r'^(https://[\w-]+\.(trycloudflare\.com|ngrok-free\.app|ngrok\.io)|https://localhost|capacitor://localhost)$'
)


class TrustTunnelCsrfOriginMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if settings.DEBUG:
            origin = request.META.get('HTTP_ORIGIN', '')
            if origin and TUNNEL_ORIGIN_RE.match(origin):
                trusted = settings.CSRF_TRUSTED_ORIGINS
                if origin not in trusted:
                    trusted.append(origin)
        return self.get_response(request)
