from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0014_geo_coordinates'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userprofile',
            name='role',
            field=models.CharField(
                choices=[
                    ('client', 'Client'),
                    ('worker', 'Worker'),
                    ('admin', 'Admin'),
                    ('salon_owner', 'Salon owner'),
                ],
                default='client',
                max_length=15,
            ),
        ),
        migrations.AddField(
            model_name='salon',
            name='owner',
            field=models.ForeignKey(
                blank=True,
                help_text='Salon owner who manages this branch.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='owned_salons',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
