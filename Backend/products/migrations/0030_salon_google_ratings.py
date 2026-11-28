from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0029_booking_record_code_daily_mpesa_deposit'),
    ]

    operations = [
        migrations.AddField(
            model_name='salon',
            name='google_place_id',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Google Places ID used to fetch public Google ratings for this branch.',
                max_length=255,
            ),
        ),
        migrations.AddField(
            model_name='salon',
            name='google_rating_average',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Cached Google Places rating (1.00–5.00).',
                max_digits=3,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='salon',
            name='google_rating_count',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Cached Google Places review count.',
            ),
        ),
        migrations.AddField(
            model_name='salon',
            name='google_ratings_fetched_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When Google ratings were last refreshed for this salon.',
                null=True,
            ),
        ),
    ]
