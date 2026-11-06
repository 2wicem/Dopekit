from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0018_booking_price_daily_expense'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='premium_inventory_access',
            field=models.BooleanField(
                default=False,
                help_text='Premium: daily inventory (services, prices, expenses) for this technician.',
            ),
        ),
    ]
