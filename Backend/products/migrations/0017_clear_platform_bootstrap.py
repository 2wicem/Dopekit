from django.db import migrations, models


def clear_platform_bootstrap(apps, schema_editor):
    Salon = apps.get_model('products', 'Salon')
    Booking = apps.get_model('products', 'Booking')
    UserProfile = apps.get_model('products', 'UserProfile')
    SalonContactInfo = apps.get_model('products', 'SalonContactInfo')
    ContactMessage = apps.get_model('products', 'ContactMessage')

    Booking.objects.update(salon_id=None)
    UserProfile.objects.update(salon_id=None, technician_application_salon_id=None)
    Salon.objects.all().delete()
    ContactMessage.objects.all().delete()

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


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0016_technician_verification_flow'),
    ]

    operations = [
        migrations.AlterField(
            model_name='saloncontactinfo',
            name='email',
            field=models.EmailField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='saloncontactinfo',
            name='phone_primary',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AlterField(
            model_name='saloncontactinfo',
            name='location',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AlterField(
            model_name='saloncontactinfo',
            name='services_summary',
            field=models.CharField(blank=True, default='', max_length=300),
        ),
        migrations.RunPython(clear_platform_bootstrap, migrations.RunPython.noop),
    ]
