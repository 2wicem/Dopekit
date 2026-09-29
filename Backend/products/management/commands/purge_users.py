from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from products.models import Booking, ContactMessage, Salon, SalonContactInfo, TimeSlot


class Command(BaseCommand):
    help = (
        'Developer tool: delete platform user accounts. '
        'By default also removes bookings and time slots. Salons are kept.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip interactive confirmation.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Allow running when DEBUG is False.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without making changes.',
        )
        parser.add_argument(
            '--keep-superusers',
            action='store_true',
            help='Do not delete Django superuser accounts.',
        )
        parser.add_argument(
            '--keep-bookings',
            action='store_true',
            help='Keep booking rows (user links are cleared when users are deleted).',
        )
        parser.add_argument(
            '--include-salons',
            action='store_true',
            help='Also delete all salon branches and reset contact info to blank.',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options['force']:
            raise CommandError(
                'Refusing to purge users while DEBUG is False. Pass --force if you really mean it.'
            )

        User = get_user_model()
        users_qs = User.objects.all().order_by('username')
        if options['keep_superusers']:
            users_qs = users_qs.filter(is_superuser=False)

        user_count = users_qs.count()
        slot_count = TimeSlot.objects.count()
        booking_count = Booking.objects.count()
        salon_count = Salon.objects.count()
        message_count = ContactMessage.objects.count()

        if user_count == 0:
            self.stdout.write(self.style.WARNING('No matching users found; nothing to delete.'))
            return

        self.stdout.write(f'Users to delete: {user_count}')
        for user in users_qs:
            role = getattr(getattr(user, 'profile', None), 'role', '—')
            self.stdout.write(f'  - {user.username} ({user.first_name or "no name"}, role={role})')

        if not options['keep_bookings']:
            self.stdout.write(f'Time slots to delete: {slot_count}')
            self.stdout.write(f'Bookings to delete: {booking_count}')
        else:
            self.stdout.write('Bookings: kept (user/preferred_worker will be cleared)')
            self.stdout.write(f'Time slots removed via worker delete: {slot_count}')

        if options['include_salons']:
            self.stdout.write(f'Salon branches to delete: {salon_count}')
            self.stdout.write(f'Contact messages to delete: {message_count}')
            self.stdout.write('Salon contact info will be reset to blank.')

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run only — no data was changed.'))
            return

        if not options['yes']:
            self.stdout.write('')
            if options['include_salons']:
                self.stdout.write('All salon branches and contact messages will be deleted.')
            else:
                self.stdout.write('Salons and salon contact info will NOT be deleted.')
            confirm = input('Type "delete all users" to confirm: ').strip()
            if confirm != 'delete all users':
                raise CommandError('Aborted.')

        with transaction.atomic():
            slots_deleted = 0
            bookings_deleted = 0

            if not options['keep_bookings']:
                slots_deleted, _ = TimeSlot.objects.all().delete()
                bookings_deleted, _ = Booking.objects.all().delete()

            users_deleted, breakdown = users_qs.delete()

            if options['include_salons']:
                ContactMessage.objects.all().delete()
                Salon.objects.all().delete()
                SalonContactInfo.objects.update_or_create(
                    pk=1,
                    defaults={
                        'phone_primary': '',
                        'phone_secondary': '',
                        'email': '',
                        'location': '',
                        'services_summary': '',
                        'page_lead': '',
                    },
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Deleted {users_deleted} user-related row(s).'))
        if breakdown:
            for model_label, count in sorted(breakdown.items()):
                self.stdout.write(f'  {model_label}: {count}')

        if not options['keep_bookings']:
            self.stdout.write(f'Removed {slots_deleted} time slot(s) and {bookings_deleted} booking(s).')

        self.stdout.write('')
        self.stdout.write('Next steps for a clean platform:')
        self.stdout.write('  python manage.py createsuperuser')
        self.stdout.write('  Add salons and staff via /admin or owner signup — no demo accounts are seeded.')
