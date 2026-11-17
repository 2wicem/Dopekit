from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0020_booking_is_walk_in'),
    ]

    operations = [
        migrations.AlterField(
            model_name='timeslot',
            name='status',
            field=models.CharField(
                choices=[
                    ('available', 'Available'),
                    ('booked', 'Booked'),
                    ('unavailable', 'Unavailable'),
                ],
                default='available',
                max_length=12,
            ),
        ),
    ]
