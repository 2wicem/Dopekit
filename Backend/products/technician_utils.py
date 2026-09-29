from .models import TechnicianApprovalStatus, UserRole

PENDING_APPROVAL_STATUSES = {
    TechnicianApprovalStatus.PENDING,
    TechnicianApprovalStatus.PENDING_OWNER,
    TechnicianApprovalStatus.PENDING_ADMIN,
}


def is_approved_technician(profile) -> bool:
    if not profile:
        return False
    if profile.role == UserRole.ADMIN:
        return True
    if profile.role != UserRole.WORKER:
        return False
    return profile.technician_approval == TechnicianApprovalStatus.APPROVED


def technician_is_pending(profile) -> bool:
    return bool(profile and profile.technician_approval in PENDING_APPROVAL_STATUSES)


def is_pending_owner_review(profile) -> bool:
    return bool(
        profile and profile.technician_approval == TechnicianApprovalStatus.PENDING_OWNER
    )


def is_pending_admin_review(profile) -> bool:
    return bool(
        profile
        and profile.technician_approval
        in (TechnicianApprovalStatus.PENDING_ADMIN, TechnicianApprovalStatus.PENDING)
    )


def auto_approve_technician(profile) -> None:
    profile.role = UserRole.WORKER
    profile.technician_approval = TechnicianApprovalStatus.APPROVED
    if profile.technician_is_freelance:
        profile.salon = None
    elif profile.technician_application_salon_id:
        profile.salon = profile.technician_application_salon
    profile.save(update_fields=['role', 'technician_approval', 'salon'])


def forward_technician_to_admin(profile) -> None:
    profile.technician_approval = TechnicianApprovalStatus.PENDING_ADMIN
    profile.save(update_fields=['technician_approval'])


def reject_technician(profile) -> None:
    profile.role = UserRole.CLIENT
    profile.technician_approval = TechnicianApprovalStatus.REJECTED
    profile.save(update_fields=['role', 'technician_approval'])
