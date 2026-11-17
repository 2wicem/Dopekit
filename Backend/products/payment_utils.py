from django.utils import timezone

from .models import PaymentMethod
from .service_prices import resolve_service_price_kes


def normalize_payment_method(raw):
    method = (raw or '').strip().lower().replace('-', '')
    if method in ('mpesa', 'm-pesa', 'till', 'bank', 'card'):
        return PaymentMethod.BANK
    if method == 'cash':
        return PaymentMethod.CASH
    return ''


def parse_payment_fields(data, *, default_amount=None, required=False):
    method = normalize_payment_method(data.get('payment_method'))
    if not method:
        if required:
            return None, 'Choose cash or bank / M-Pesa.'
        return {'payment_method': '', 'payment_amount_kes': None}, None

    raw_amount = data.get('payment_amount_kes', data.get('amount_kes'))
    if raw_amount in (None, ''):
        amount = default_amount
    else:
        try:
            amount = int(raw_amount)
        except (TypeError, ValueError):
            return None, 'Enter a valid payment amount.'
        if amount < 0:
            return None, 'Payment amount cannot be negative.'

    return {
        'payment_method': method,
        'payment_amount_kes': amount,
    }, None


def apply_client_payment(booking, payment, *, mark_paid=True):
    method = payment.get('payment_method') or ''
    amount = payment.get('payment_amount_kes')
    if amount is None:
        amount = booking.service_price_kes
        if amount is None:
            amount = resolve_service_price_kes(booking.service)

    booking.payment_method = method
    booking.payment_amount_kes = amount
    if mark_paid and method:
        booking.paid_at = timezone.now()
    elif not method:
        booking.paid_at = None

    return ['payment_method', 'payment_amount_kes', 'paid_at']


def collected_amount(booking, fallback_price=0):
    if booking.payment_amount_kes is not None:
        return booking.payment_amount_kes
    return fallback_price
