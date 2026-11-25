import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def google_signin_enabled() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID)


def verify_google_credential(credential: str) -> dict | None:
    if not credential or not settings.GOOGLE_CLIENT_ID:
        return None

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token
    except ImportError:
        logger.exception('google-auth is not installed.')
        return None

    try:
        payload = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )
    except Exception:
        logger.warning('Google ID token verification failed.', exc_info=True)
        return None

    if payload.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
        return None
    if payload.get('aud') != settings.GOOGLE_CLIENT_ID:
        return None

    email = (payload.get('email') or '').strip().lower()
    sub = (payload.get('sub') or '').strip()
    if not email or not sub or not payload.get('email_verified', False):
        return None

    return {
        'sub': sub,
        'email': email,
        'name': (payload.get('name') or payload.get('given_name') or email.split('@')[0]).strip(),
    }
