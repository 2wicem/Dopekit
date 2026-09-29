import secrets

from django.conf import settings
from django.core.cache import cache

from .password_reset_otp import normalize_phone_digits, otp_length, otp_max_attempts, otp_ttl

SIGNUP_OTP_PREFIX = 'tech_signup_otp:'
SIGNUP_VERIFIED_PREFIX = 'tech_signup_verified:'


def _otp_cache_key(phone_digits: str) -> str:
    return f'{SIGNUP_OTP_PREFIX}{phone_digits}'


def _verified_cache_key(phone_digits: str) -> str:
    return f'{SIGNUP_VERIFIED_PREFIX}{phone_digits}'


def generate_otp() -> str:
    return ''.join(secrets.choice('0123456789') for _ in range(otp_length()))


def store_signup_otp(phone: str) -> str:
    phone_digits = normalize_phone_digits(phone)
    code = generate_otp()
    cache.set(
        _otp_cache_key(phone_digits),
        {'otp': code, 'attempts': 0},
        timeout=otp_ttl(),
    )
    cache.delete(_verified_cache_key(phone_digits))
    return code


def verify_signup_otp(phone: str, submitted: str) -> tuple[bool, str | None]:
    phone_digits = normalize_phone_digits(phone)
    if not phone_digits:
        return False, 'Enter a valid Kenyan phone number.'

    data = cache.get(_otp_cache_key(phone_digits))
    if not data:
        return False, 'Request a verification code for this phone number first.'

    attempts = data.get('attempts', 0)
    if attempts >= otp_max_attempts():
        cache.delete(_otp_cache_key(phone_digits))
        return False, 'Too many incorrect attempts. Request a new code.'

    submitted = (submitted or '').strip()
    if submitted != data.get('otp'):
        attempts += 1
        if attempts >= otp_max_attempts():
            cache.delete(_otp_cache_key(phone_digits))
            return False, 'Too many incorrect attempts. Request a new code.'

        cache.set(
            _otp_cache_key(phone_digits),
            {'otp': data['otp'], 'attempts': attempts},
            timeout=otp_ttl(),
        )
        remaining = otp_max_attempts() - attempts
        return False, f'Incorrect code. {remaining} attempt(s) left.'

    cache.delete(_otp_cache_key(phone_digits))
    cache.set(_verified_cache_key(phone_digits), True, timeout=otp_ttl())
    return True, None


def is_phone_verified_for_signup(phone: str) -> bool:
    phone_digits = normalize_phone_digits(phone)
    if not phone_digits:
        return False
    return bool(cache.get(_verified_cache_key(phone_digits)))


def clear_signup_phone_verification(phone: str) -> None:
    phone_digits = normalize_phone_digits(phone)
    cache.delete(_verified_cache_key(phone_digits))
    cache.delete(_otp_cache_key(phone_digits))
