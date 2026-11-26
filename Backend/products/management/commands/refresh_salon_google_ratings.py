from django.core.management.base import BaseCommand

from products.google_places import google_ratings_enabled, refresh_stale_salon_google_ratings


class Command(BaseCommand):
    help = 'Fetch Google Places ratings for active salon branches and cache them for Top ratings.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Refresh even when cached ratings are still within TTL.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=None,
            help='Optional max number of salons to process.',
        )

    def handle(self, *args, **options):
        if not google_ratings_enabled():
            self.stderr.write(
                self.style.ERROR(
                    'GOOGLE_PLACES_API_KEY is not set (or GOOGLE_PLACES_RATINGS_ENABLED=False).'
                )
            )
            return

        stats = refresh_stale_salon_google_ratings(
            force=bool(options['force']),
            limit=options['limit'],
        )
        self.stdout.write(
            self.style.SUCCESS(
                'Google ratings refresh complete: '
                f"updated={stats['updated']} fresh={stats['fresh']} failed={stats['failed']}"
            )
        )
