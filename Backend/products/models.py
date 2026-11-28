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
    PENDING_OWNER = 'pending_owner', 'Pending salon review'
    PENDING_ADMIN = 'pending_admin', 'Pending admin review'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class BookingStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    ACCEPTED = 'accepted', 'Accepted'
    COMPLETED = 'completed', 'Completed'
    CANCELLED = 'cancelled', 'Cancelled'


class ServiceVenue(models.TextChoices):
    INDOOR = 'indoor', 'Indoor (at salon)'
    OUTDOOR = 'outdoor', 'Outdoor (we come to you)'


class PaymentMethod(models.TextChoices):
    CASH = 'cash', 'Cash'
    BANK = 'bank', 'Bank / M-Pesa'


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
    service_price_kes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Menu price in KES when the booking was created.',
    )
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
    is_walk_in = models.BooleanField(
        default=False,
        help_text='Recorded by staff (manual), not booked by the client online.',
    )
    payment_method = models.CharField(
        max_length=10,
        choices=PaymentMethod.choices,
        blank=True,
        default='',
        help_text='How the client paid when the job was completed.',
    )
    payment_amount_kes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Amount collected. Defaults to the service price.',
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    record_code = models.CharField(
        max_length=16,
        unique=True,
        null=True,
        blank=True,
        help_text='Internal Dopekit code for cash or other jobs without an M-Pesa receipt.',
    )
    mpesa_code = models.CharField(
        max_length=16,
        blank=True,
        default='',
        db_index=True,
        help_text='Real M-Pesa receipt from the customer message. Unique across the business; blocks double entry.',
    )
    mpesa_receipt = models.ForeignKey(
        'MpesaReceipt',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )

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
        default=SlotStatus.AVAILABLE,
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
    phone = models.CharField(max_length=20, blank=True, default='')
    google_sub = models.CharField(max_length=64, unique=True, null=True, blank=True)
    role = models.CharField(
        max_length=15,
        choices=UserRole.choices,
        default=UserRole.CLIENT,
    )
    technician_approval = models.CharField(
        max_length=15,
        choices=TechnicianApprovalStatus.choices,
        default=TechnicianApprovalStatus.NOT_APPLICABLE,
    )
    technician_is_freelance = models.BooleanField(default=False)
    technician_phone_verified = models.BooleanField(default=False)
    default_location = models.CharField(max_length=200, blank=True, default='')
    technician_specialty = models.CharField(max_length=100, blank=True, default='')
    technician_experience_years = models.PositiveSmallIntegerField(null=True, blank=True)
    technician_reference_name = models.CharField(max_length=100, blank=True, default='')
    technician_reference_phone = models.CharField(max_length=20, blank=True, default='')
    technician_application_note = models.TextField(blank=True, default='')
    technician_invite_verified = models.BooleanField(default=False)
    technician_application_salon = models.ForeignKey(
        'Salon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='technician_applications',
        help_text='Salon branch the technician applied to join.',
    )
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
    premium_inventory_access = models.BooleanField(
        default=False,
        help_text='Premium: daily expense tracking for this technician.',
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


class DailyExpense(models.Model):
    class Category(models.TextChoices):
        SUPPLIES = 'supplies', 'Supplies'
        TRANSPORT = 'transport', 'Transport'
        UTILITIES = 'utilities', 'Utilities'
        RENT = 'rent', 'Rent'
        WAGES = 'wages', 'Wages'
        OTHER = 'other', 'Other'

    salon = models.ForeignKey(
        'Salon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='daily_expenses',
    )
    business_date = models.DateField()
    label = models.CharField(max_length=120)
    category = models.CharField(
        max_length=20,
        choices=Category.choices,
        default=Category.OTHER,
    )
    amount_kes = models.PositiveIntegerField()
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_expenses',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-business_date', '-created_at']

    def __str__(self):
        return f'{self.business_date} {self.label} KES {self.amount_kes}'


class MpesaReceipt(models.Model):
    code = models.CharField(max_length=16, unique=True)
    amount_kes = models.PositiveIntegerField()
    client_name = models.CharField(max_length=120, blank=True, default='')
    business_date = models.DateField()
    salon = models.ForeignKey(
        'Salon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mpesa_receipts',
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_mpesa_receipts',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-business_date', '-created_at']

    def __str__(self):
        return f'{self.code} KES {self.amount_kes}'


class DailyMpesaDeposit(models.Model):
    salon = models.ForeignKey(
        'Salon',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='daily_mpesa_deposits',
    )
    business_date = models.DateField()
    mpesa_code = models.CharField(max_length=16)
    amount_kes = models.PositiveIntegerField()
    notes = models.CharField(max_length=200, blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_mpesa_deposits',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-business_date', '-updated_at']
        constraints = [
            models.UniqueConstraint(
                fields=['salon', 'business_date'],
                condition=models.Q(salon__isnull=False),
                name='unique_mpesa_deposit_per_salon_day',
            ),
            models.UniqueConstraint(
                fields=['recorded_by', 'business_date'],
                condition=models.Q(salon__isnull=True),
                name='unique_mpesa_deposit_per_user_day',
            ),
        ]

    def __str__(self):
        return f'{self.business_date} {self.mpesa_code} KES {self.amount_kes}'


class Salon(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_salons',
        help_text='Salon owner who manages this branch.',
    )
    technician_invite_code = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True,
        help_text='Per-branch code technicians use when applying to join this salon.',
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
    google_place_id = models.CharField(
        max_length=255,
        blank=True,
        default='',
        help_text='Google Places ID used to fetch public Google ratings for this branch.',
    )
    google_rating_average = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        null=True,
        blank=True,
        help_text='Cached Google Places rating (1.00–5.00).',
    )
    google_rating_count = models.PositiveIntegerField(
        default=0,
        help_text='Cached Google Places review count.',
    )
    google_ratings_fetched_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When Google ratings were last refreshed for this salon.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class SalonService(models.Model):
    salon = models.ForeignKey(
        'Salon',
        on_delete=models.CASCADE,
        related_name='menu_services',
    )
    name = models.CharField(max_length=120)
    price_kes = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f'{self.salon.name}: {self.name}'


class TechnicianService(models.Model):
    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='menu_services',
    )
    name = models.CharField(max_length=120)
    price_kes = models.PositiveIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f'{self.technician}: {self.name}'


class WageType(models.TextChoices):
    NONE = 'none', 'No wage'
    DAILY = 'daily', 'Daily wage'
    WEEKLY = 'weekly', 'Weekly wage'


class WorkerCompensation(models.Model):
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='compensations',
    )
    salon = models.ForeignKey(
        'Salon',
        on_delete=models.CASCADE,
        related_name='worker_compensations',
    )
    wage_type = models.CharField(
        max_length=10,
        choices=WageType.choices,
        default=WageType.NONE,
    )
    wage_kes = models.PositiveIntegerField(default=0)
    commission_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        help_text='Percent of collected client payments for this technician.',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['worker', 'salon'],
                name='unique_worker_salon_compensation',
            ),
        ]

    def __str__(self):
        return f'{self.worker_id} @ {self.salon_id}'


class WorkerAdvance(models.Model):
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='advances',
    )
    salon = models.ForeignKey(
        'Salon',
        on_delete=models.CASCADE,
        related_name='worker_advances',
    )
    business_date = models.DateField()
    amount_kes = models.PositiveIntegerField()
    notes = models.CharField(max_length=200, blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recorded_advances',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-business_date', '-created_at']

    def __str__(self):
        return f'{self.worker_id} {self.business_date} KES {self.amount_kes}'


class SalonContactInfo(models.Model):
    """Singleton row (pk=1) — salon details shown on the Contact page."""

    phone_primary = models.CharField(max_length=20, blank=True, default='')
    phone_secondary = models.CharField(max_length=20, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    location = models.CharField(max_length=200, blank=True, default='')
    services_summary = models.CharField(max_length=300, blank=True, default='')
    page_lead = models.TextField(blank=True, default='')
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
