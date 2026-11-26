import secrets

RECORD_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
RECORD_CODE_PREFIX = 'DK-'
RECORD_CODE_BODY_LENGTH = 8


def generate_record_code() -> str:
    body = ''.join(secrets.choice(RECORD_CODE_ALPHABET) for _ in range(RECORD_CODE_BODY_LENGTH))
    return f'{RECORD_CODE_PREFIX}{body}'


def mint_record_code() -> str:
    from .models import Booking

    for _ in range(16):
        code = generate_record_code()
        if not Booking.objects.filter(record_code=code).exists():
            return code
    raise RuntimeError('Could not allocate a unique record code.')


def normalize_mpesa_code(raw_value: str) -> str:
    return ''.join(ch for ch in (raw_value or '').upper() if ch.isalnum())
