from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0010_userprofile_technician_approval'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='technician_application_note',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_experience_years',
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_invite_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_reference_name',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_reference_phone',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_specialty',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
    ]
