import secrets

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def generate_invite_code(existing):
    while True:
        code = secrets.token_hex(4).upper()
        if code not in existing:
            return code


def seed_salon_invite_codes(apps, schema_editor):
    Salon = apps.get_model('products', 'Salon')
    existing = set(
        Salon.objects.exclude(technician_invite_code__isnull=True)
        .exclude(technician_invite_code='')
        .values_list('technician_invite_code', flat=True)
    )
    for salon in Salon.objects.all():
        if salon.technician_invite_code:
            continue
        code = generate_invite_code(existing)
        existing.add(code)
        salon.technician_invite_code = code
        salon.save(update_fields=['technician_invite_code'])


def migrate_pending_to_admin(apps, schema_editor):
    UserProfile = apps.get_model('products', 'UserProfile')
    UserProfile.objects.filter(technician_approval='pending').update(technician_approval='pending_admin')


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('products', '0015_salon_owner'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userprofile',
            name='technician_approval',
            field=models.CharField(
                choices=[
                    ('na', 'Not applicable'),
                    ('pending', 'Pending approval'),
                    ('pending_owner', 'Pending salon review'),
                    ('pending_admin', 'Pending admin review'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                ],
                default='na',
                max_length=15,
            ),
        ),
        migrations.AddField(
            model_name='salon',
            name='technician_invite_code',
            field=models.CharField(
                blank=True,
                help_text='Per-branch code technicians use when applying to join this salon.',
                max_length=32,
                null=True,
                unique=True,
            ),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_is_freelance',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_phone_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='technician_application_salon',
            field=models.ForeignKey(
                blank=True,
                help_text='Salon branch the technician applied to join.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='technician_applications',
                to='products.salon',
            ),
        ),
        migrations.RunPython(seed_salon_invite_codes, migrations.RunPython.noop),
        migrations.RunPython(migrate_pending_to_admin, migrations.RunPython.noop),
    ]
