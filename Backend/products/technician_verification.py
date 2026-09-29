from django.conf import settings

from .models import Salon, TechnicianApprovalStatus
from .technician_signup_otp import is_phone_verified_for_signup, verify_signup_otp

PHONE_DIGITS = __import__('re').compile(r'\D')

VALID_SPECIALTIES = {
    'manicure',
    'pedicure',
    'gel',
    'acrylic',
    'nail_art',
    'general',
}

SPECIALTY_LABELS = {
    'manicure': 'Manicure',
    'pedicure': 'Pedicure',
    'gel': 'Gel nails',
    'acrylic': 'Acrylic nails',
    'nail_art': 'Nail art',
    'general': 'General nail care',
}


def normalize_ke_phone_digits(phone: str) -> str:
    digits = PHONE_DIGITS.sub('', phone or '')
    if digits.startswith('254'):
        return digits
    if digits.startswith('0') and len(digits) >= 10:
        return f'254{digits[1:]}'
    if len(digits) == 9:
        return f'254{digits}'
    return digits


def is_valid_ke_phone(phone: str) -> bool:
    digits = normalize_ke_phone_digits(phone)
    return len(digits) >= 12 and digits.startswith('254')


def invite_code_required() -> bool:
    return True


def resolve_salon_from_invite_code(code: str) -> Salon | None:
    normalized = (code or '').strip().upper()
    if not normalized:
        return None
    return Salon.objects.filter(technician_invite_code__iexact=normalized, is_active=True).first()


def validate_technician_application(data) -> tuple[dict | None, str | None]:
    technician_type = (data.get('technician_type') or 'salon').strip().lower()
    if technician_type not in ('salon', 'freelance'):
        return None, 'Choose whether you are joining a salon team or applying as freelance.'

    phone = data.get('phone', '').strip()
    phone_otp = data.get('phone_otp', '').strip()
    if not is_valid_ke_phone(phone):
        return None, 'Enter a valid Kenyan phone number.'

    if phone_otp:
        verified, otp_error = verify_signup_otp(phone, phone_otp)
        if not verified:
            return None, otp_error
    elif not is_phone_verified_for_signup(phone):
        return None, 'Verify your phone number with the SMS code before applying.'

    invite_code = data.get('technician_invite_code', '').strip()
    specialty = data.get('technician_specialty', '').strip().lower()
    experience_raw = data.get('technician_experience_years')
    reference_name = data.get('technician_reference_name', '').strip()
    reference_phone = data.get('technician_reference_phone', '').strip()
    application_note = data.get('technician_application_note', '').strip()
    staff_authorized = data.get('staff_authorized') is True

    if not staff_authorized:
        if technician_type == 'freelance':
            return None, 'You must confirm that your application details are accurate.'
        return None, 'You must confirm that you are authorized to apply as salon staff.'

    if specialty not in VALID_SPECIALTIES:
        return None, 'Please select your nail service specialty.'

    try:
        experience_years = int(experience_raw)
    except (TypeError, ValueError):
        return None, 'Enter your years of experience as a number.'

    if experience_years < 0 or experience_years > 50:
        return None, 'Years of experience must be between 0 and 50.'

    if len(reference_name) < 2:
        return None, 'Enter the name of your supervisor or reference.'

    if not is_valid_ke_phone(reference_phone):
        return None, 'Enter a valid Kenyan reference phone number.'

    if len(application_note) > 500:
        return None, 'Application note is too long (max 500 characters).'

    application_salon = None
    invite_verified = False

    if technician_type == 'salon':
        application_salon = resolve_salon_from_invite_code(invite_code)
        if not application_salon:
            legacy_code = getattr(settings, 'TECHNICIAN_SIGNUP_CODE', '').strip()
            if legacy_code and invite_code.upper() == legacy_code.upper():
                from .salon_utils import get_primary_salon

                application_salon = get_primary_salon()
            if not application_salon:
                return None, 'Enter a valid salon invite code from your branch manager.'
        invite_verified = True
    elif invite_code:
        return None, 'Salon invite codes are only used for salon team applications.'

    return (
        {
            'technician_specialty': specialty,
            'technician_experience_years': experience_years,
            'technician_reference_name': reference_name,
            'technician_reference_phone': reference_phone,
            'technician_application_note': application_note,
            'technician_invite_verified': invite_verified,
            'technician_is_freelance': technician_type == 'freelance',
            'technician_application_salon': application_salon,
            'technician_phone_verified': True,
        },
        None,
    )


def technician_application_to_dict(profile) -> dict:
    if not profile:
        return {}

    specialty = profile.technician_specialty or ''
    application_salon = getattr(profile, 'technician_application_salon', None)
    return {
        'specialty': specialty,
        'specialty_label': SPECIALTY_LABELS.get(specialty, specialty.replace('_', ' ').title()),
        'experience_years': profile.technician_experience_years,
        'reference_name': profile.technician_reference_name,
        'reference_phone': profile.technician_reference_phone,
        'application_note': profile.technician_application_note,
        'invite_verified': profile.technician_invite_verified,
        'is_freelance': profile.technician_is_freelance,
        'phone_verified': profile.technician_phone_verified,
        'application_salon_id': application_salon.id if application_salon else None,
        'application_salon_name': application_salon.name if application_salon else None,
        'approval_stage': profile.technician_approval,
    }
