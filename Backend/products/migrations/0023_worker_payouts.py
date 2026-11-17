import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0022_booking_client_payment'),
    ]

    operations = [
        migrations.CreateModel(
            name='WorkerCompensation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('wage_type', models.CharField(
                    choices=[('none', 'No wage'), ('daily', 'Daily wage'), ('weekly', 'Weekly wage')],
                    default='none',
                    max_length=10,
                )),
                ('wage_kes', models.PositiveIntegerField(default=0)),
                ('commission_percent', models.DecimalField(
                    decimal_places=2,
                    default=0,
                    help_text='Percent of collected client payments for this technician.',
                    max_digits=5,
                )),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('salon', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='worker_compensations',
                    to='products.salon',
                )),
                ('worker', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='compensations',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
        ),
        migrations.CreateModel(
            name='WorkerAdvance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('business_date', models.DateField()),
                ('amount_kes', models.PositiveIntegerField()),
                ('notes', models.CharField(blank=True, default='', max_length=200)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('recorded_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='recorded_advances',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('salon', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='worker_advances',
                    to='products.salon',
                )),
                ('worker', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='advances',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-business_date', '-created_at']},
        ),
        migrations.AddConstraint(
            model_name='workercompensation',
            constraint=models.UniqueConstraint(
                fields=('worker', 'salon'),
                name='unique_worker_salon_compensation',
            ),
        ),
    ]
