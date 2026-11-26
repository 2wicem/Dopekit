from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_walk_in_codes(apps, schema_editor):
    Booking = apps.get_model('products', 'Booking')
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    used = set(
        Booking.objects.exclude(record_code__isnull=True)
        .exclude(record_code='')
        .values_list('record_code', flat=True)
    )

    def mint():
        import secrets

        for _ in range(24):
            body = ''.join(secrets.choice(alphabet) for _ in range(8))
            code = f'DK-{body}'
            if code not in used:
                used.add(code)
                return code
        raise RuntimeError('Could not backfill unique record codes.')

    to_update = []
    for booking in Booking.objects.filter(is_walk_in=True, record_code__isnull=True).iterator():
        booking.record_code = mint()
        to_update.append(booking)
        if len(to_update) >= 200:
            Booking.objects.bulk_update(to_update, ['record_code'])
            to_update = []
    if to_update:
        Booking.objects.bulk_update(to_update, ['record_code'])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0028_userprofile_google_sub'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='record_code',
            field=models.CharField(
                blank=True,
                help_text='Public authenticity code for staff-logged jobs, similar to an M-Pesa receipt.',
                max_length=16,
                null=True,
                unique=True,
            ),
        ),
        migrations.CreateModel(
            name='DailyMpesaDeposit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('business_date', models.DateField()),
                ('mpesa_code', models.CharField(max_length=16)),
                ('amount_kes', models.PositiveIntegerField()),
                ('notes', models.CharField(blank=True, default='', max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'recorded_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='recorded_mpesa_deposits',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'salon',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='daily_mpesa_deposits',
                        to='products.salon',
                    ),
                ),
            ],
            options={
                'ordering': ['-business_date', '-updated_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='dailympesadeposit',
            constraint=models.UniqueConstraint(
                condition=models.Q(('salon__isnull', False)),
                fields=('salon', 'business_date'),
                name='unique_mpesa_deposit_per_salon_day',
            ),
        ),
        migrations.AddConstraint(
            model_name='dailympesadeposit',
            constraint=models.UniqueConstraint(
                condition=models.Q(('salon__isnull', True)),
                fields=('recorded_by', 'business_date'),
                name='unique_mpesa_deposit_per_user_day',
            ),
        ),
        migrations.RunPython(backfill_walk_in_codes, migrations.RunPython.noop),
    ]
