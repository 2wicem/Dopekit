from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from products.models import TechnicianApprovalStatus, UserProfile, UserRole


class Command(BaseCommand):
    help = 'Promote a user to platform admin so Dashboard and /worker work in the React app.'

    def add_arguments(self, parser):
        parser.add_argument(
            'username',
            nargs='?',
            help='Django username to promote (optional if only one superuser exists)',
        )

    def handle(self, *args, **options):
        User = get_user_model()
        username = (options.get('username') or '').strip()

        if username:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist as exc:
                raise CommandError(f'User "{username}" not found.') from exc
        else:
            user = User.objects.filter(is_superuser=True).order_by('id').first()
            if user is None:
                raise CommandError('No superuser found. Run createsuperuser first or pass a username.')
            username = user.username

        existing_phone = ''
        if hasattr(user, 'profile') and user.profile and user.profile.phone:
            existing_phone = user.profile.phone

        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                'phone': existing_phone or '+254700000000',
                'role': UserRole.ADMIN,
                'technician_approval': TechnicianApprovalStatus.NOT_APPLICABLE,
            },
        )
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=['is_staff', 'is_superuser'])

        self.stdout.write(
            self.style.SUCCESS(
                f'"{username}" is now admin. Log out on dopekit.digital, log in again, then open /worker.'
            )
        )
