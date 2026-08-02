import re

from django.conf import settings

PHONE_DIGITS = re.compile(r'\D')

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
    return bool(getattr(settings, 'TECHNICIAN_SIGNUP_CODE', '').strip())


def validate_technician_application(data) -> tuple[dict | None, str | None]:
    invite_code = data.get('technician_invite_code', '').strip()
    specialty = data.get('technician_specialty', '').strip().lower()
    experience_raw = data.get('technician_experience_years')
    reference_name = data.get('technician_reference_name', '').strip()
    reference_phone = data.get('technician_reference_phone', '').strip()
    application_note = data.get('technician_application_note', '').strip()
    staff_authorized = data.get('staff_authorized') is True

    required_code = getattr(settings, 'TECHNICIAN_SIGNUP_CODE', '').strip()
    if required_code:
        if not invite_code:
            return None, 'Salon invite code is required for technician applications.'
        if invite_code.upper() != required_code.upper():
            return None, 'Invalid salon invite code. Ask the salon admin for the team code.'

    if not staff_authorized:
        return None, 'You must confirm that you are an authorized salon team member.'

    if specialty not in VALID_SPECIALTIES:
        return None, 'Please select your nail service specialty.'

    try:
        experience_years = int(experience_raw)
    except (TypeError, ValueError):
        return None, 'Enter your years of experience as a number.'

    if experience_years < 0 or experience_years > 50:
        return None, 'Years of experience must be between 0 and 50.'

    if len(reference_name) < 2:
        return None, 'Enter the name of your salon supervisor or reference.'

    if not is_valid_ke_phone(reference_phone):
        return None, 'Enter a valid Kenyan reference phone number.'

    if len(application_note) > 500:
        return None, 'Application note is too long (max 500 characters).'

    return (
        {
            'technician_specialty': specialty,
            'technician_experience_years': experience_years,
            'technician_reference_name': reference_name,
            'technician_reference_phone': reference_phone,
            'technician_application_note': application_note,
            'technician_invite_verified': bool(required_code and invite_code),
        },
        None,
    )


def technician_application_to_dict(profile) -> dict:
    if not profile:
        return {}

    specialty = profile.technician_specialty or ''
    return {
        'specialty': specialty,
        'specialty_label': SPECIALTY_LABELS.get(specialty, specialty.replace('_', ' ').title()),
        'experience_years': profile.technician_experience_years,
        'reference_name': profile.technician_reference_name,
        'reference_phone': profile.technician_reference_phone,
        'application_note': profile.technician_application_note,
        'invite_verified': profile.technician_invite_verified,
    }
