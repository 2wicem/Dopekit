from django.utils.text import slugify

from .geo_utils import coordinate_pair_to_dict
from .models import Salon

def salon_to_dict(salon: Salon, *, include_owner: bool = False) -> dict:
    phones = [salon.phone_primary]
    if salon.phone_secondary:
        phones.append(salon.phone_secondary)

    data = {
        'id': salon.id,
        'name': salon.name,
        'slug': salon.slug,
        'phones': phones,
        'phone_primary': salon.phone_primary,
        'phone_secondary': salon.phone_secondary,
        'email': salon.email,
        'location': salon.location,
        'latitude': float(salon.latitude) if salon.latitude is not None else None,
        'longitude': float(salon.longitude) if salon.longitude is not None else None,
        'coordinates': coordinate_pair_to_dict(salon.latitude, salon.longitude),
        'services_summary': salon.services_summary,
        'page_lead': salon.page_lead,
        'instagram_url': salon.instagram_url,
        'facebook_url': salon.facebook_url,
        'tiktok_url': salon.tiktok_url,
        'whatsapp_url': salon.whatsapp_url,
        'is_active': salon.is_active,
        'is_primary': salon.is_primary,
        'updated_at': salon.updated_at.isoformat(),
    }

    if include_owner:
        if salon.owner_id:
            owner = salon.owner
            data['owner_id'] = salon.owner_id
            data['owner_name'] = owner.first_name or owner.username
            data['owner_email'] = owner.email
        else:
            data['owner_id'] = None
            data['owner_name'] = None
            data['owner_email'] = None

    return data


def get_primary_salon() -> Salon | None:
    salon = Salon.objects.filter(is_active=True, is_primary=True).first()
    if salon:
        return salon
    return Salon.objects.filter(is_active=True).order_by('id').first()


def resolve_salon_id(raw_value) -> int | None:
    if raw_value in (None, '', 'all'):
        return None
    try:
        salon_id = int(raw_value)
    except (TypeError, ValueError):
        return None
    if Salon.objects.filter(pk=salon_id, is_active=True).exists():
        return salon_id
    return None


def parse_admin_salon_id(request) -> int | None:
    return resolve_salon_id(request.GET.get('salon_id'))


def filter_bookings_by_salon(queryset, salon_id: int | None):
    if salon_id is None:
        return queryset
    return queryset.filter(salon_id=salon_id)


def unique_slug(name: str, salon_id: int | None = None) -> str:
    base = slugify(name) or 'salon'
    slug = base
    counter = 2
    while Salon.objects.filter(slug=slug).exclude(pk=salon_id).exists():
        slug = f'{base}-{counter}'
        counter += 1
    return slug


def assign_primary_salon(salon: Salon) -> None:
    Salon.objects.exclude(pk=salon.pk).update(is_primary=False)
    if not salon.is_primary:
        salon.is_primary = True
        salon.save(update_fields=['is_primary'])


def salon_contact_payload(salon: Salon) -> dict:
    data = salon_to_dict(salon)
    data.pop('id', None)
    data.pop('slug', None)
    data.pop('is_active', None)
    data.pop('is_primary', None)
    return data
