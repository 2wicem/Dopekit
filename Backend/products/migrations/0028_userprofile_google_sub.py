from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0027_westlands_spa_prices'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userprofile',
            name='phone',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='google_sub',
            field=models.CharField(blank=True, max_length=64, null=True, unique=True),
        ),
    ]
