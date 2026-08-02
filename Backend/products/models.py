from django.conf import settings
from django.db import models


class UserRole(models.TextChoices):
    CLIENT = 'client', 'Client'
    WORKER = 'worker', 'Worker'
    ADMIN = 'admin', 'Admin'
    SALON_OWNER = 'salon_owner', 'Salon owner'


class TechnicianApprovalStatus(models.TextChoices):
    NOT_APPLICABLE = 'na', 'Not applicable'
    PENDING = 'pending', 'Pending approval'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class BookingStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    ACCEPTED = 'accepted', 'Accepted'
    CANCELLED = 'cancelled', 'Cancelled'


class ServiceVenue(models.TextChoices):
    INDOOR = 'indoor', 'Indoor (at salon)'
    OUTDOOR = 'outdoor', 'Outdoor (we come to you)'


class Booking(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    location = models.CharField(max_length=200)
    service = models.CharField(max_length=100, blank=True, default='')
    venue = models.CharField(
        max_length=10,
        choices=ServiceVenue.choices,
        default=ServiceVenue.INDOOR,
    )
    status = models.CharField(
        max_length=10,
        choices=BookingStatus.choices,
        default=BookingStatus.PENDING,
    )
    requested_date = models.DateField(null=True, blank=True)
    preferred_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='preferred_bookings',
    )
    salon = models.ForeignKey(
        'Salon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.phone})'


class SlotStatus(models.TextChoices):
    AVAILABLE = 'available', 'Available'
    BOOKED = 'booked', 'Booked'
    UNAVAILABLE = 'unavailable', 'Unavailable'


class TimeSlot(models.Model):
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='time_slots',
    )
    date = models.DateField()
    start_hour = models.PositiveSmallIntegerField()
    status = models.CharField(
        max_length=12,
        choices=SlotStatus.choices,
        default=SlotStatus.UNAVAILABLE,
    )
    booking = models.OneToOneField(
        Booking,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='time_slot',
    )

    class Meta:
        ordering = ['date', 'start_hour']
        constraints = [
            models.UniqueConstraint(
                fields=['worker', 'date', 'start_hour'],
                name='unique_worker_slot',
            ),
        ]

    def __str__(self):
        return f'{self.worker} {self.date} {self.start_hour}:00 ({self.status})'


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    phone = models.CharField(max_length=20)
    role = models.CharField(
        max_length=15,
        choices=UserRole.choices,
        default=UserRole.CLIENT,
    )
    technician_approval = models.CharField(
        max_length=10,
        choices=TechnicianApprovalStatus.choices,
        default=TechnicianApprovalStatus.NOT_APPLICABLE,
    )
    default_location = models.CharField(max_length=200, blank=True, default='')
    technician_specialty = models.CharField(max_length=100, blank=True, default='')
    technician_experience_years = models.PositiveSmallIntegerField(null=True, blank=True)
    technician_reference_name = models.CharField(max_length=100, blank=True, default='')
    technician_reference_phone = models.CharField(max_length=20, blank=True, default='')
    technician_application_note = models.TextField(blank=True, default='')
    technician_invite_verified = models.BooleanField(default=False)
    technician_work_summary = models.TextField(
        blank=True,
        default='',
        help_text='Public summary of nail styles and services this technician offers.',
    )
    technician_portfolio_urls = models.TextField(
        blank=True,
        default='',
        help_text='Public portfolio image URLs, one per line.',
    )
    technician_rating_average = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
    )
    technician_rating_count = models.PositiveIntegerField(default=0)
    service_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Map pin for freelance/mobile service area.',
    )
    service_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='Map pin for freelance/mobile service area.',
    )
    salon = models.ForeignKey(
        'Salon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='staff_profiles',
        help_text='Home salon for technicians; admins may leave blank for all salons.',
    )

    def __str__(self):
        return f'{self.user.get_full_name() or self.user.username} ({self.get_role_display()})'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        should_be_staff = self.role == UserRole.ADMIN
        if self.user.is_staff != should_be_staff:
            self.user.is_staff = should_be_staff
            self.user.save(update_fields=['is_staff'])


class ContactMessage(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='contact_messages',
    )
    name = models.CharField(max_length=100, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        label = self.name or 'Anonymous'
        return f'{label}: {self.message[:40]}'


class Salon(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_salons',
        help_text='Salon owner who manages this branch.',
    )
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=120, unique=True)
    phone_primary = models.CharField(max_length=20)
    phone_secondary = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField()
    location = models.CharField(max_length=200)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='GPS latitude for map discovery.',
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        help_text='GPS longitude for map discovery.',
    )
    services_summary = models.CharField(max_length=300, blank=True, default='')
    page_lead = models.TextField(blank=True, default='')
    instagram_url = models.URLField(blank=True, default='')
    facebook_url = models.URLField(blank=True, default='')
    tiktok_url = models.URLField(blank=True, default='')
    whatsapp_url = models.URLField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    is_primary = models.BooleanField(
        default=False,
        help_text='Default salon on the public contact page and for new bookings.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class SalonContactInfo(models.Model):
    """Singleton row (pk=1) — salon details shown on the Contact page."""

    phone_primary = models.CharField(max_length=20, default='0790331108')
    phone_secondary = models.CharField(max_length=20, blank=True, default='0727083181')
    email = models.EmailField(default='dopekit@gmail.com')
    location = models.CharField(max_length=200, default='Wangige Mall')
    services_summary = models.CharField(
        max_length=300,
        default='Indoor and outdoor manicure & pedicure',
    )
    page_lead = models.TextField(
        blank=True,
        default=(
            'Have a question or want to book an appointment? '
            'Reach out — we would love to hear from you.'
        ),
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Salon contact info'
        verbose_name_plural = 'Salon contact info'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Salon contact information'
