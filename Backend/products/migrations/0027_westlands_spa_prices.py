from django.db import migrations
from django.db.models import Q

WESTLANDS_SPA_PRICES = {
    'Just gel': 2000,
    'Builder + gel': 3000,
    'Tips + gel': 3500,
    'Tips Builder + gel': 4500,
    'Gum gel': 4000,
    'Pedicure': 3000,
    'Acrylics': 5000,
    'Custom nail art': 5000,
    'Kids gel': 1500,
    'French tips': 2500,
}


def apply_westlands_prices(apps, schema_editor):
    SalonService = apps.get_model('products', 'SalonService')
    TechnicianService = apps.get_model('products', 'TechnicianService')

    for name, price in WESTLANDS_SPA_PRICES.items():
        match = Q(name__iexact=name)
        SalonService.objects.filter(match).update(price_kes=price)
        TechnicianService.objects.filter(match).update(price_kes=price)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0026_technician_service'),
    ]

    operations = [
        migrations.RunPython(apply_westlands_prices, migrations.RunPython.noop),
    ]
