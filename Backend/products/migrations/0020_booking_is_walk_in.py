from django.db import migrations, models


def mark_existing_walk_ins(apps, schema_editor):
    Booking = apps.get_model('products', 'Booking')
    Booking.objects.filter(user__isnull=True, time_slot__isnull=True).update(is_walk_in=True)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0019_userprofile_premium_inventory'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='is_walk_in',
            field=models.BooleanField(
                default=False,
                help_text='Recorded by staff (manual), not booked by the client online.',
            ),
        ),
        migrations.RunPython(mark_existing_walk_ins, migrations.RunPython.noop),
    ]
