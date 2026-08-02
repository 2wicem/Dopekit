import django.db.models.deletion
from django.db import migrations, models
from django.utils.text import slugify


def seed_salons_from_contact_info(apps, schema_editor):
    SalonContactInfo = apps.get_model('products', 'SalonContactInfo')
    Salon = apps.get_model('products', 'Salon')
    Booking = apps.get_model('products', 'Booking')

    info, _ = SalonContactInfo.objects.get_or_create(pk=1)
    slug = slugify('Dopekit Main') or 'dopekit-main'
    salon, _ = Salon.objects.get_or_create(
        slug=slug,
        defaults={
            'name': 'Dopekit Main',
            'phone_primary': info.phone_primary,
            'phone_secondary': info.phone_secondary,
            'email': info.email,
            'location': info.location,
            'services_summary': info.services_summary,
            'page_lead': info.page_lead,
            'is_active': True,
            'is_primary': True,
        },
    )
    Booking.objects.filter(salon__isnull=True).update(salon=salon)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0011_userprofile_technician_application'),
    ]

    operations = [
        migrations.CreateModel(
            name='Salon',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=120)),
                ('slug', models.SlugField(max_length=120, unique=True)),
                ('phone_primary', models.CharField(max_length=20)),
                ('phone_secondary', models.CharField(blank=True, default='', max_length=20)),
                ('email', models.EmailField(max_length=254)),
                ('location', models.CharField(max_length=200)),
                ('services_summary', models.CharField(blank=True, default='', max_length=300)),
                ('page_lead', models.TextField(blank=True, default='')),
                ('instagram_url', models.URLField(blank=True, default='')),
                ('facebook_url', models.URLField(blank=True, default='')),
                ('tiktok_url', models.URLField(blank=True, default='')),
                ('whatsapp_url', models.URLField(blank=True, default='')),
                ('is_active', models.BooleanField(default=True)),
                ('is_primary', models.BooleanField(
                    default=False,
                    help_text='Default salon on the public contact page and for new bookings.',
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.AddField(
            model_name='booking',
            name='salon',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='bookings',
                to='products.salon',
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='salon',
            field=models.ForeignKey(
                blank=True,
                help_text='Home salon for technicians; admins may leave blank for all salons.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='staff_profiles',
                to='products.salon',
            ),
        ),
        migrations.RunPython(seed_salons_from_contact_info, migrations.RunPython.noop),
    ]
