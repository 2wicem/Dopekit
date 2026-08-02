from .models import TechnicianApprovalStatus, UserRole
from .technician_showcase import parse_portfolio_urls
from .technician_verification import technician_application_to_dict

TECHNICIAN_APPROVAL_LABELS = {
    TechnicianApprovalStatus.NOT_APPLICABLE: 'Not applicable',
    TechnicianApprovalStatus.PENDING: 'Pending approval',
    TechnicianApprovalStatus.APPROVED: 'Approved',
    TechnicianApprovalStatus.REJECTED: 'Rejected',
}


def user_to_dict(user):
    profile = getattr(user, 'profile', None)
    role = profile.role if profile else UserRole.CLIENT
    technician_approval = (
        profile.technician_approval if profile else TechnicianApprovalStatus.NOT_APPLICABLE
    )

    data = {
        'id': user.id,
        'username': user.username,
        'name': user.first_name or user.username,
        'email': user.email,
        'phone': profile.phone if profile else '',
        'role': role,
        'role_label': role_label(role),
        'technician_approval': technician_approval,
        'technician_approval_label': TECHNICIAN_APPROVAL_LABELS.get(
            technician_approval,
            technician_approval,
        ),
        'technician_pending': technician_approval == TechnicianApprovalStatus.PENDING,
        'default_location': profile.default_location if profile else '',
        'is_staff': user.is_staff,
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
    }

    if profile and technician_approval != TechnicianApprovalStatus.NOT_APPLICABLE:
        application = technician_application_to_dict(profile)
        if application.get('specialty') or profile.technician_experience_years:
            data['technician_application'] = application

    if profile and profile.role in (UserRole.WORKER, UserRole.ADMIN):
        data['technician_work_summary'] = profile.technician_work_summary or ''
        data['technician_portfolio_urls'] = parse_portfolio_urls(profile.technician_portfolio_urls)
        if profile.technician_rating_average is not None:
            data['technician_rating_average'] = float(profile.technician_rating_average)
        data['technician_rating_count'] = profile.technician_rating_count or 0
        if profile.service_latitude is not None:
            data['service_latitude'] = float(profile.service_latitude)
        if profile.service_longitude is not None:
            data['service_longitude'] = float(profile.service_longitude)

    return data


def role_label(role):
    return {
        UserRole.CLIENT: 'Client',
        UserRole.WORKER: 'Technician',
        UserRole.ADMIN: 'Admin',
        UserRole.SALON_OWNER: 'Salon owner',
    }.get(role, role)


SIGNUP_ACCOUNT_TYPES = {
    'client': UserRole.CLIENT,
    'technician': UserRole.WORKER,
    'worker': UserRole.WORKER,
    'salon_owner': UserRole.SALON_OWNER,
}


def signup_role_from_account_type(account_type):
    """Map public signup account type to a role. Admin is never allowed."""
    if not account_type:
        return UserRole.CLIENT

    normalized = account_type.strip().lower()
    if normalized == UserRole.ADMIN:
        return None

    return SIGNUP_ACCOUNT_TYPES.get(normalized, UserRole.CLIENT)
