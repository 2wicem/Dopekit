import re
import secrets

from django.conf import settings
from django.core.cache import cache
from django.contrib.auth import get_user_model

from .models import UserProfile
from .notifications import normalize_ke_phone

User = get_user_model()

OTP_CACHE_PREFIX = 'pwreset_otp:'


def otp_length() -> int:
    return getattr(settings, 'PASSWORD_RESET_OTP_LENGTH', 6)


def otp_ttl() -> int:
    return getattr(settings, 'PASSWORD_RESET_OTP_TTL', 600)


def otp_max_attempts() -> int:
    return getattr(settings, 'PASSWORD_RESET_OTP_MAX_ATTEMPTS', 5)


def _cache_key(user_id: int) -> str:
    return f'{OTP_CACHE_PREFIX}{user_id}'


def generate_otp() -> str:
    return ''.join(secrets.choice('0123456789') for _ in range(otp_length()))


def store_otp(user_id: int) -> str:
    code = generate_otp()
    cache.set(
        _cache_key(user_id),
        {'otp': code, 'attempts': 0},
        timeout=otp_ttl(),
    )
    return code


def verify_otp(user_id: int, submitted: str) -> tuple[bool, str | None]:
    data = cache.get(_cache_key(user_id))
    if not data:
        return False, 'This code has expired. Request a new one.'

    attempts = data.get('attempts', 0)
    if attempts >= otp_max_attempts():
        cache.delete(_cache_key(user_id))
        return False, 'Too many incorrect attempts. Request a new code.'

    submitted = (submitted or '').strip()
    if submitted != data.get('otp'):
        attempts += 1
        if attempts >= otp_max_attempts():
            cache.delete(_cache_key(user_id))
            return False, 'Too many incorrect attempts. Request a new code.'

        cache.set(
            _cache_key(user_id),
            {'otp': data['otp'], 'attempts': attempts},
            timeout=otp_ttl(),
        )
        remaining = otp_max_attempts() - attempts
        return False, f'Incorrect code. {remaining} attempt(s) left.'

    cache.delete(_cache_key(user_id))
    return True, None


def clear_otp(user_id: int) -> None:
    cache.delete(_cache_key(user_id))


def normalize_phone_digits(phone: str) -> str:
    return re.sub(r'\D', '', normalize_ke_phone(phone))


def find_user_by_phone(phone: str):
    target = normalize_phone_digits(phone)
    if not target:
        return None

    for profile in UserProfile.objects.select_related('user').exclude(phone=''):
        if normalize_phone_digits(profile.phone) == target:
            return profile.user

    return None


def mask_email(email: str) -> str:
    email = (email or '').strip()
    if '@' not in email:
        return 'your email'

    local, domain = email.split('@', 1)
    if len(local) <= 1:
        masked_local = '*'
    else:
        masked_local = f'{local[0]}***'

    return f'{masked_local}@{domain}'


def mask_phone(phone: str) -> str:
    digits = re.sub(r'\D', '', phone or '')
    if len(digits) < 4:
        return 'your phone'
    return f'***{digits[-4:]}'
