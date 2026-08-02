from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from products.models import Salon, TechnicianApprovalStatus, UserProfile, UserRole

USERNAME = 'steve'
EMAIL = 'steve@dopekit.local'
PASSWORD = 'Steve2026!'
PHONE = '254712345678'


class Command(BaseCommand):
    help = 'Create or update the demo technician account Steve.'

    def handle(self, *args, **options):
        User = get_user_model()
        salon = Salon.objects.filter(is_active=True).first()

        if User.objects.filter(username=USERNAME).exists():
            user = User.objects.get(username=USERNAME)
            user.set_password(PASSWORD)
            user.first_name = 'Steve'
            user.email = EMAIL
            user.save()
            profile = user.profile
            action = 'updated'
        else:
            user = User.objects.create_user(
                username=USERNAME,
                email=EMAIL,
                password=PASSWORD,
                first_name='Steve',
            )
            profile = UserProfile.objects.create(user=user, phone=PHONE)
            action = 'created'

        profile.phone = PHONE
        profile.role = UserRole.WORKER
        profile.technician_approval = TechnicianApprovalStatus.APPROVED
        profile.technician_specialty = 'general'
        profile.technician_experience_years = 3
        profile.technician_work_summary = (
            'Gel nails, nail art, and classic manicures with a clean, long-lasting finish.'
        )
        if salon:
            profile.salon = salon
        profile.save()

        salon_name = salon.name if salon else 'none'
        self.stdout.write(self.style.SUCCESS(f'{action} technician: Steve'))
        self.stdout.write(f'Username: {USERNAME}')
        self.stdout.write(f'Email: {EMAIL}')
        self.stdout.write(f'Password: {PASSWORD}')
        self.stdout.write(f'Home salon: {salon_name}')
        self.stdout.write('Login: http://localhost:5173/login then open http://localhost:5173/worker')
