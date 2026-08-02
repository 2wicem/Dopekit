from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0012_salon_multisalon'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='technician_portfolio_urls',
            field=models.TextField(blank=True, default='', help_text='Public portfolio image URLs, one per line.'),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_rating_average',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=3, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_rating_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_work_summary',
            field=models.TextField(blank=True, default='', help_text='Public summary of nail styles and services this technician offers.'),
        ),
    ]
