from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0021_timeslot_default_available'),
    ]

    operations = [
        migrations.AddField(
            model_name='booking',
            name='payment_amount_kes',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Amount collected. Defaults to the service price.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='payment_method',
            field=models.CharField(
                blank=True,
                choices=[('cash', 'Cash'), ('bank', 'Bank / M-Pesa')],
                default='',
                help_text='How the client paid when the job was completed.',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='booking',
            name='paid_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
