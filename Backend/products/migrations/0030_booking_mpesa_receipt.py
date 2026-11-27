from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0029_booking_record_code_daily_mpesa_deposit'),
    ]

    operations = [
        migrations.CreateModel(
            name='MpesaReceipt',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(max_length=16, unique=True)),
                ('amount_kes', models.PositiveIntegerField()),
                ('client_name', models.CharField(blank=True, default='', max_length=120)),
                ('business_date', models.DateField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'recorded_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='recorded_mpesa_receipts',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'salon',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='mpesa_receipts',
                        to='products.salon',
                    ),
                ),
            ],
            options={
                'ordering': ['-business_date', '-created_at'],
            },
        ),
        migrations.AddField(
            model_name='booking',
            name='mpesa_code',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Real M-Pesa receipt from the customer message. Unique across the business; blocks double entry.',
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='mpesa_receipt',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='bookings',
                to='products.mpesareceipt',
            ),
        ),
        migrations.AlterField(
            model_name='booking',
            name='record_code',
            field=models.CharField(
                blank=True,
                help_text='Internal Dopekit code for cash or other jobs without an M-Pesa receipt.',
                max_length=16,
                null=True,
                unique=True,
            ),
        ),
    ]
