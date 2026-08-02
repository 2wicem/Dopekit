from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from products.models import Salon, UserProfile, UserRole
from products.salon_utils import salon_to_dict

User = get_user_model()


class Command(BaseCommand):
    help = 'Developer tool: list salon branches, owners, and technician counts.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--active-only',
            action='store_true',
            help='Only show active salons.',
        )
        parser.add_argument(
            '--owner',
            metavar='USERNAME',
            help='Filter branches owned by this username.',
        )
        parser.add_argument(
            '--assign-owner',
            metavar='USERNAME',
            help='Assign all unowned salons (or one via --salon-id) to this salon owner.',
        )
        parser.add_argument(
            '--salon-id',
            type=int,
            help='Limit --assign-owner to a single salon branch.',
        )

    def handle(self, *args, **options):
        if options['assign_owner']:
            self._assign_owner(options['assign_owner'], options.get('salon_id'))
            return

        salons = Salon.objects.select_related('owner').order_by('-is_primary', 'name')
        if options['active_only']:
            salons = salons.filter(is_active=True)

        if options['owner']:
            owner = User.objects.filter(username__iexact=options['owner']).first()
            if not owner:
                raise CommandError(f'User "{options["owner"]}" not found.')
            salons = salons.filter(owner=owner)

        if not salons.exists():
            self.stdout.write(self.style.WARNING('No salons matched.'))
            return

        self.stdout.write(f'Found {salons.count()} salon branch(es):\n')
        for salon in salons:
            data = salon_to_dict(salon, include_owner=True)
            staff_count = UserProfile.objects.filter(role=UserRole.WORKER, salon_id=salon.id).count()
            flags = []
            if data['is_primary']:
                flags.append('primary')
            if not data['is_active']:
                flags.append('inactive')
            flag_text = f" [{', '.join(flags)}]" if flags else ''

            owner_email = data.get('owner_email')
            owner_suffix = f' ({owner_email})' if owner_email else ''
            self.stdout.write(
                f"#{data['id']} {data['name']}{flag_text}\n"
                f"  slug: {data['slug']}\n"
                f"  location: {data['location']}\n"
                f"  contact: {data['phone_primary']} · {data['email']}\n"
                f"  coordinates: {data['latitude']}, {data['longitude']}\n"
                f"  owner: {data['owner_name'] or '—'}{owner_suffix}\n"
                f"  technicians: {staff_count}\n"
            )

        owners = (
            UserProfile.objects.filter(role=UserRole.SALON_OWNER)
            .select_related('user')
            .order_by('user__username')
        )
        if owners.exists():
            self.stdout.write('\nSalon owners:')
            for profile in owners:
                branch_count = Salon.objects.filter(owner=profile.user).count()
                self.stdout.write(
                    f"  - {profile.user.username} ({profile.user.first_name or 'no name'}) · {branch_count} branch(es)"
                )

    def _assign_owner(self, username, salon_id=None):
        owner = User.objects.filter(username__iexact=username).select_related('profile').first()
        if not owner:
            raise CommandError(f'User "{username}" not found.')

        profile = getattr(owner, 'profile', None)
        if not profile or profile.role != UserRole.SALON_OWNER:
            raise CommandError(
                f'User "{username}" is not a salon owner. '
                'Promote them in admin or sign up with account_type=salon_owner.'
            )

        salons = Salon.objects.filter(owner__isnull=True)
        if salon_id is not None:
            salons = salons.filter(pk=salon_id)

        updated = salons.update(owner=owner)
        if updated == 0:
            self.stdout.write(self.style.WARNING('No matching unowned salons to assign.'))
            return

        self.stdout.write(
            self.style.SUCCESS(f'Assigned {updated} salon branch(es) to {owner.username}.')
        )
