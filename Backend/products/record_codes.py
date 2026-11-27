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


def parse_mpesa_code(raw_value, *, required=False):
    code = normalize_mpesa_code(raw_value)
    if not code:
        if required:
            return None, 'Enter the M-Pesa receipt code from the customer message.'
        return '', None
    if len(code) < 8 or len(code) > 16:
        return None, 'Enter a valid M-Pesa receipt code (usually 10 characters).'
    return code, None


def duplicate_mpesa_message(code: str) -> str:
    from .models import MpesaReceipt

    receipt = MpesaReceipt.objects.filter(code=code).first()
    if receipt is None:
        return (
            f'M-Pesa code {code} is already recorded. '
            'Owner and technician must not log the same receipt twice.'
        )
    return (
        f'M-Pesa code {code} is already recorded '
        f'({receipt.business_date.isoformat()} · {receipt.client_name or "a client"} · '
        f'KES {receipt.amount_kes}). '
        'Owner and technician must not log the same receipt twice.'
    )


def create_mpesa_receipt(*, code, amount_kes, client_name, business_date, salon, recorded_by):
    from django.db import IntegrityError, transaction

    from .models import MpesaReceipt

    try:
        with transaction.atomic():
            return MpesaReceipt.objects.create(
                code=code,
                amount_kes=amount_kes,
                client_name=client_name or '',
                business_date=business_date,
                salon=salon,
                recorded_by=recorded_by,
            )
    except IntegrityError:
        return None
