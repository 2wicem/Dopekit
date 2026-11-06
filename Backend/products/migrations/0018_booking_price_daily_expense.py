from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0017_clear_platform_bootstrap'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='service_price_kes',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Menu price in KES when the booking was created.',
                null=True,
            ),
        ),
        migrations.CreateModel(
            name='DailyExpense',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('business_date', models.DateField()),
                ('label', models.CharField(max_length=120)),
                (
                    'category',
                    models.CharField(
                        choices=[
                            ('supplies', 'Supplies'),
                            ('transport', 'Transport'),
                            ('utilities', 'Utilities'),
                            ('rent', 'Rent'),
                            ('wages', 'Wages'),
                            ('other', 'Other'),
                        ],
                        default='other',
                        max_length=20,
                    ),
                ),
                ('amount_kes', models.PositiveIntegerField()),
                ('notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'recorded_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='recorded_expenses',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'salon',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='daily_expenses',
                        to='products.salon',
                    ),
                ),
            ],
            options={
                'ordering': ['-business_date', '-created_at'],
            },
        ),
    ]
