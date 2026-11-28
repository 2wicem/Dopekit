from decimal import Decimal
from unittest import mock

from django.test import SimpleTestCase, override_settings

from products.google_places import (
    _normalize_count,
    _normalize_rating,
    build_salon_search_query,
)
from products.models import Salon
from products.salon_utils import salon_to_dict


class GooglePlacesHelpersTests(SimpleTestCase):
    def test_normalize_rating(self):
        self.assertEqual(_normalize_rating(4.56), Decimal('4.56'))
        self.assertIsNone(_normalize_rating(None))
        self.assertIsNone(_normalize_rating(6))

    def test_normalize_count(self):
        self.assertEqual(_normalize_count('12'), 12)
        self.assertEqual(_normalize_count(None), 0)
        self.assertEqual(_normalize_count(-3), 0)

    def test_build_search_query_includes_country(self):
        salon = Salon(name='Dopekit Studio', location='Kikuyu Town')
        with override_settings(GEOCODING_DEFAULT_COUNTRY='Kenya'):
            query = build_salon_search_query(salon)
        self.assertIn('Dopekit Studio', query)
        self.assertIn('Kikuyu Town', query)
        self.assertIn('Kenya', query)

    def test_salon_to_dict_exposes_google_ratings(self):
        salon = mock.Mock(spec=Salon)
        salon.id = 1
        salon.name = 'Dopekit Studio'
        salon.slug = 'dopekit-studio'
        salon.phone_primary = '+254700000000'
        salon.phone_secondary = ''
        salon.email = 'hello@example.com'
        salon.location = 'Kikuyu Town'
        salon.latitude = None
        salon.longitude = None
        salon.services_summary = ''
        salon.page_lead = ''
        salon.instagram_url = ''
        salon.facebook_url = ''
        salon.tiktok_url = ''
        salon.whatsapp_url = ''
        salon.is_active = True
        salon.is_primary = True
        salon.updated_at.isoformat.return_value = '2026-01-01T00:00:00+00:00'
        salon.google_place_id = 'ChIJtest'
        salon.google_rating_average = Decimal('4.70')
        salon.google_rating_count = 128
        salon.google_ratings_fetched_at = None
        salon.owner_id = None

        data = salon_to_dict(salon)

        self.assertEqual(data['rating_source'], 'google')
        self.assertEqual(data['rating_average'], 4.7)
        self.assertEqual(data['rating_count'], 128)
        self.assertEqual(data['google_place_id'], 'ChIJtest')
