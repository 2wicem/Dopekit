import logging
import re

from django.conf import settings
from django.core.mail import send_mail

from .technician_verification import technician_application_to_dict

logger = logging.getLogger(__name__)


def normalize_ke_phone(phone: str) -> str:
    digits = re.sub(r'\D', '', phone)
    if digits.startswith('254'):
        return f'+{digits}'
    if digits.startswith('0') and len(digits) >= 10:
        return f'+254{digits[1:]}'
    if len(digits) == 9:
        return f'+254{digits}'
    return f'+{digits}' if not phone.startswith('+') else phone


def _booking_email_body(booking) -> str:
    service = booking.service or 'Not specified'
    lines = [
        'New booking received at Dopekit',
        '',
        f'Booking ID: {booking.id}',
        f'Name: {booking.name}',
        f'Phone: {booking.phone}',
        f'Location: {booking.location}',
        f'Service type: {booking.get_venue_display()}',
        f'Service: {service}',
        f'Status: {booking.get_status_display()}',
        f'Submitted: {booking.created_at:%Y-%m-%d %H:%M %Z}',
    ]

    slot = getattr(booking, 'time_slot', None)
    if slot:
        from .slot_utils import format_slot_label

        lines.extend(
            [
                '',
                f'Appointment: {slot.date:%Y-%m-%d} · {format_slot_label(slot.start_hour)}',
                f'Technician: {slot.worker.first_name or slot.worker.username}',
            ]
        )
    elif booking.requested_date:
        lines.extend(['', f'Requested date: {booking.requested_date:%Y-%m-%d}'])
        lines.append('Time slot: To be confirmed by staff')
        if booking.preferred_worker_id:
            worker = booking.preferred_worker
            lines.append(f'Preferred technician: {worker.first_name or worker.username}')

    lines.append('')
    return '\n'.join(lines)


def _booking_sms_body(booking) -> str:
    service = booking.service or 'General'
    slot = getattr(booking, 'time_slot', None)
    if slot:
        when = f'{slot.date:%d/%m} {slot.start_hour}:00'
    elif booking.requested_date:
        when = f'{booking.requested_date:%d/%m} TBC'
    else:
        when = 'TBC'
    return (
        f'Dopekit booking #{booking.id}: {booking.name}, '
        f'{booking.phone}, {service} @ {when}'
    )[:160]


def send_booking_email(booking) -> bool:
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        logger.warning('Email notifications skipped: EMAIL_HOST_USER/PASSWORD not set.')
        return False

    try:
        send_mail(
            subject=f'New Dopekit booking #{booking.id}',
            message=_booking_email_body(booking),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.BOOKING_NOTIFY_EMAIL],
            fail_silently=False,
        )
        logger.info('Booking email sent for #%s', booking.id)
        return True
    except Exception:
        logger.exception('Failed to send booking email for #%s', booking.id)
        return False


def send_booking_sms(booking) -> bool:
    if not settings.AT_API_KEY:
        logger.warning('SMS notifications skipped: AT_API_KEY not set.')
        return False

    try:
        import africastalking

        africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
        sms = africastalking.SMS

        recipients = [normalize_ke_phone(settings.BOOKING_NOTIFY_PHONE)]
        kwargs = {}
        if settings.AT_SENDER_ID:
            kwargs['sender_id'] = settings.AT_SENDER_ID

        response = sms.send(_booking_sms_body(booking), recipients, **kwargs)
        logger.info('Booking SMS sent for #%s: %s', booking.id, response)
        return True
    except Exception:
        logger.exception('Failed to send booking SMS for #%s', booking.id)
        return False


def notify_booking_created(booking) -> dict:
    return {
        'email_sent': send_booking_email(booking),
        'sms_sent': send_booking_sms(booking),
    }


def _booking_update_email_body(booking, action: str) -> str:
    body = _booking_email_body(booking)
    return f'Booking {action} at Dopekit\n\n{body}'


def _booking_update_sms_body(booking, action: str) -> str:
    base = _booking_sms_body(booking)
    return f'Dopekit {action}: {base}'[:160]


def notify_booking_cancelled(booking) -> dict:
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        email_sent = False
    else:
        try:
            send_mail(
                subject=f'Dopekit booking #{booking.id} cancelled by client',
                message=_booking_update_email_body(booking, 'cancelled'),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.BOOKING_NOTIFY_EMAIL],
                fail_silently=False,
            )
            email_sent = True
        except Exception:
            logger.exception('Failed to send cancellation email for #%s', booking.id)
            email_sent = False

    sms_sent = False
    if settings.AT_API_KEY:
        try:
            import africastalking

            africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
            sms = africastalking.SMS
            recipients = [normalize_ke_phone(settings.BOOKING_NOTIFY_PHONE)]
            kwargs = {}
            if settings.AT_SENDER_ID:
                kwargs['sender_id'] = settings.AT_SENDER_ID
            sms.send(_booking_update_sms_body(booking, 'cancelled'), recipients, **kwargs)
            sms_sent = True
        except Exception:
            logger.exception('Failed to send cancellation SMS for #%s', booking.id)

    return {'email_sent': email_sent, 'sms_sent': sms_sent}


def notify_booking_rescheduled(booking) -> dict:
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        email_sent = False
    else:
        try:
            send_mail(
                subject=f'Dopekit booking #{booking.id} rescheduled by client',
                message=_booking_update_email_body(booking, 'rescheduled'),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.BOOKING_NOTIFY_EMAIL],
                fail_silently=False,
            )
            email_sent = True
        except Exception:
            logger.exception('Failed to send reschedule email for #%s', booking.id)
            email_sent = False

    sms_sent = False
    if settings.AT_API_KEY:
        try:
            import africastalking

            africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
            sms = africastalking.SMS
            recipients = [normalize_ke_phone(settings.BOOKING_NOTIFY_PHONE)]
            kwargs = {}
            if settings.AT_SENDER_ID:
                kwargs['sender_id'] = settings.AT_SENDER_ID
            sms.send(_booking_update_sms_body(booking, 'rescheduled'), recipients, **kwargs)
            sms_sent = True
        except Exception:
            logger.exception('Failed to send reschedule SMS for #%s', booking.id)

    return {'email_sent': email_sent, 'sms_sent': sms_sent}


def _technician_application_email_body(user) -> str:
    profile = getattr(user, 'profile', None)
    phone = profile.phone if profile else ''
    application = technician_application_to_dict(profile)
    lines = [
        'New technician application at Dopekit',
        '',
        f'Name: {user.first_name or user.username}',
        f'Email: {user.email}',
        f'Phone: {phone or "Not provided"}',
        f'Applied: {user.date_joined:%Y-%m-%d %H:%M %Z}',
    ]

    if application:
        lines.extend(
            [
                '',
                f'Specialty: {application.get("specialty_label") or "—"}',
                f'Experience: {application.get("experience_years", "—")} year(s)',
                f'Reference: {application.get("reference_name") or "—"} ({application.get("reference_phone") or "—"})',
                f'Invite code verified: {"Yes" if application.get("invite_verified") else "No"}',
            ]
        )
        if application.get('application_note'):
            lines.extend(['', f'Note: {application["application_note"]}'])

    lines.extend(['', 'Log in to the admin panel to approve or reject this application.'])
    return '\n'.join(lines)


def _technician_application_sms_body(user) -> str:
    name = user.first_name or user.username
    return f'Dopekit: new technician application from {name} ({user.email}). Review in admin.'[:160]


def notify_technician_application(user) -> dict:
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        email_sent = False
    else:
        try:
            send_mail(
                subject=f'New technician application — {user.first_name or user.username}',
                message=_technician_application_email_body(user),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.BOOKING_NOTIFY_EMAIL],
                fail_silently=False,
            )
            email_sent = True
        except Exception:
            logger.exception('Failed to send technician application email for %s', user.email)
            email_sent = False

    sms_sent = False
    if settings.AT_API_KEY:
        try:
            import africastalking

            africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
            sms = africastalking.SMS
            recipients = [normalize_ke_phone(settings.BOOKING_NOTIFY_PHONE)]
            kwargs = {}
            if settings.AT_SENDER_ID:
                kwargs['sender_id'] = settings.AT_SENDER_ID
            sms.send(_technician_application_sms_body(user), recipients, **kwargs)
            sms_sent = True
        except Exception:
            logger.exception('Failed to send technician application SMS for %s', user.email)

    return {'email_sent': email_sent, 'sms_sent': sms_sent}


def _contact_email_body(contact_message) -> str:
    sender = contact_message.name or 'Anonymous'
    user_line = ''
    if contact_message.user_id:
        user = contact_message.user
        user_line = f'Account: {user.email or user.username}\n'

    phone_line = f'Phone: {contact_message.phone}\n' if contact_message.phone else ''
    email_line = f'Email: {contact_message.email}\n' if contact_message.email else ''

    return (
        f'New contact note at Dopekit\n\n'
        f'Message ID: {contact_message.id}\n'
        f'From: {sender}\n'
        f'{phone_line}'
        f'{email_line}'
        f'{user_line}'
        f'Submitted: {contact_message.created_at:%Y-%m-%d %H:%M %Z}\n\n'
        f'Message:\n{contact_message.message}\n'
    )


def _contact_sms_body(contact_message) -> str:
    sender = contact_message.name or 'Someone'
    phone_bit = f', {contact_message.phone}' if contact_message.phone else ''
    preview = contact_message.message.replace('\n', ' ').strip()
    if len(preview) > 60:
        preview = f'{preview[:57]}...'
    return f'Dopekit note #{contact_message.id} from {sender}{phone_bit}: {preview}'[:160]


def send_contact_email(contact_message) -> bool:
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        logger.warning('Contact email skipped: EMAIL_HOST_USER/PASSWORD not set.')
        return False

    sender = contact_message.name or 'Website visitor'
    try:
        send_mail(
            subject=f'Dopekit contact note #{contact_message.id} — {sender}',
            message=_contact_email_body(contact_message),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[settings.BOOKING_NOTIFY_EMAIL],
            fail_silently=False,
        )
        logger.info('Contact email sent for #%s', contact_message.id)
        return True
    except Exception:
        logger.exception('Failed to send contact email for #%s', contact_message.id)
        return False


def send_contact_sms(contact_message) -> bool:
    if not settings.AT_API_KEY:
        logger.warning('Contact SMS skipped: AT_API_KEY not set.')
        return False

    try:
        import africastalking

        africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
        sms = africastalking.SMS

        recipients = [normalize_ke_phone(settings.BOOKING_NOTIFY_PHONE)]
        kwargs = {}
        if settings.AT_SENDER_ID:
            kwargs['sender_id'] = settings.AT_SENDER_ID

        response = sms.send(_contact_sms_body(contact_message), recipients, **kwargs)
        logger.info('Contact SMS sent for #%s: %s', contact_message.id, response)
        return True
    except Exception:
        logger.exception('Failed to send contact SMS for #%s', contact_message.id)
        return False


def notify_contact_message_created(contact_message) -> dict:
    return {
        'email_sent': send_contact_email(contact_message),
        'sms_sent': send_contact_sms(contact_message),
    }


def send_password_reset_email(user, reset_url: str, otp: str | None = None) -> bool:
    if not user.email:
        logger.warning('Password reset skipped: user %s has no email.', user.username)
        return False

    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        logger.warning('Password reset email skipped: EMAIL_HOST_USER/PASSWORD not set.')
        return False

    name = user.first_name or user.username
    ttl_minutes = max(1, getattr(settings, 'PASSWORD_RESET_OTP_TTL', 600) // 60)
    lines = [
        f'Hi {name},',
        '',
        'We received a request to reset your Dopekit password.',
        '',
    ]

    if otp:
        lines.extend(
            [
                f'Your reset code is: {otp}',
                f'This code expires in {ttl_minutes} minutes.',
                '',
                'Enter the code on the reset password page to choose a new password.',
                '',
            ]
        )

    lines.extend(
        [
            f'Or open this link to reset directly (valid for 24 hours):\n{reset_url}',
            '',
            'If you did not request this, you can ignore this email.',
        ]
    )

    try:
        send_mail(
            subject='Reset your Dopekit password',
            message='\n'.join(lines),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info('Password reset email sent to %s', user.email)
        return True
    except Exception:
        logger.exception('Failed to send password reset email to %s', user.email)
        return False


def send_password_reset_otp_sms(user, otp: str) -> bool:
    profile = getattr(user, 'profile', None)
    phone = profile.phone if profile else ''
    if not phone:
        logger.warning('Password reset SMS skipped: user %s has no phone.', user.username)
        return False

    if not settings.AT_API_KEY:
        logger.warning('Password reset SMS skipped: AT_API_KEY not set.')
        return False

    ttl_minutes = max(1, getattr(settings, 'PASSWORD_RESET_OTP_TTL', 600) // 60)
    message = (
        f'Dopekit password reset code: {otp}. '
        f'Expires in {ttl_minutes} min. Do not share this code.'
    )[:160]

    try:
        import africastalking

        africastalking.initialize(settings.AT_USERNAME, settings.AT_API_KEY)
        sms = africastalking.SMS
        recipients = [normalize_ke_phone(phone)]
        kwargs = {}
        if settings.AT_SENDER_ID:
            kwargs['sender_id'] = settings.AT_SENDER_ID

        response = sms.send(message, recipients, **kwargs)
        logger.info('Password reset SMS sent to user %s: %s', user.id, response)
        return True
    except Exception:
        logger.exception('Failed to send password reset SMS for user %s', user.id)
        return False
