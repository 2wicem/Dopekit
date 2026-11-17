from django.db import migrations
from django.utils import timezone


def reopen_future_unbooked_slots(apps, schema_editor):
    TimeSlot = apps.get_model('products', 'TimeSlot')
    TimeSlot.objects.filter(
        date__gte=timezone.localdate(),
        status='unavailable',
        booking__isnull=True,
    ).update(status='available')


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0023_worker_payouts'),
    ]

    operations = [
        migrations.RunPython(reopen_future_unbooked_slots, migrations.RunPython.noop),
    ]
