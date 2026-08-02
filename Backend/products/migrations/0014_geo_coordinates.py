from decimal import Decimal

from django.db import migrations, models


DEFAULT_LAT = Decimal('-1.246600')
DEFAULT_LNG = Decimal('36.664700')


def seed_salon_coordinates(apps, schema_editor):
    Salon = apps.get_model('products', 'Salon')
    for salon in Salon.objects.all():
        if salon.latitude is None or salon.longitude is None:
            salon.latitude = DEFAULT_LAT
            salon.longitude = DEFAULT_LNG
            salon.save(update_fields=['latitude', 'longitude'])


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0013_userprofile_technician_showcase'),
    ]

    operations = [
        migrations.AddField(
            model_name='salon',
            name='latitude',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='GPS latitude for map discovery.',
                max_digits=9,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='salon',
            name='longitude',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='GPS longitude for map discovery.',
                max_digits=9,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='service_latitude',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='Map pin for freelance/mobile service area.',
                max_digits=9,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='service_longitude',
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                help_text='Map pin for freelance/mobile service area.',
                max_digits=9,
                null=True,
            ),
        ),
        migrations.RunPython(seed_salon_coordinates, migrations.RunPython.noop),
    ]
