from django.contrib import admin, messages

from .models import (
    Booking,
    ContactMessage,
    DailyExpense,
    DailyMpesaDeposit,
    Salon,
    SalonContactInfo,
    SalonService,
    TechnicianService,
    TimeSlot,
    UserProfile,
)


@admin.register(DailyMpesaDeposit)
class DailyMpesaDepositAdmin(admin.ModelAdmin):
    list_display = ('business_date', 'mpesa_code', 'amount_kes', 'salon', 'recorded_by', 'updated_at')
    list_filter = ('business_date', 'salon')
    search_fields = ('mpesa_code',)


@admin.register(DailyExpense)
class DailyExpenseAdmin(admin.ModelAdmin):
    list_display = ('business_date', 'label', 'category', 'amount_kes', 'salon', 'recorded_by', 'created_at')
    list_filter = ('business_date', 'category', 'salon')
    search_fields = ('label', 'notes')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        'record_code',
        'name',
        'phone',
        'service',
        'service_price_kes',
        'location',
        'user',
        'created_at',
    )
    list_filter = ('service', 'is_walk_in', 'created_at')
    search_fields = ('name', 'phone', 'location', 'record_code')


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ('worker', 'date', 'start_hour', 'status', 'booking')
    list_filter = ('status', 'date')
    search_fields = ('worker__username', 'worker__email')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = (
        'user',
        'phone',
        'role',
        'salon',
        'premium_inventory_access',
        'technician_rating_average',
        'default_location',
    )
    list_filter = ('role', 'premium_inventory_access')
    search_fields = ('user__username', 'user__email', 'phone')


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'phone', 'email', 'message_preview', 'user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'phone', 'email', 'message', 'user__email')
    readonly_fields = ('created_at',)

    @admin.display(description='Message')
    def message_preview(self, obj):
        return obj.message[:80]


@admin.register(SalonService)
class SalonServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'salon', 'price_kes', 'is_active', 'sort_order')
    list_filter = ('is_active', 'salon')
    search_fields = ('name', 'salon__name')


@admin.register(TechnicianService)
class TechnicianServiceAdmin(admin.ModelAdmin):
    list_display = ('name', 'technician', 'price_kes', 'is_active', 'sort_order')
    list_filter = ('is_active',)
    search_fields = ('name', 'technician__username', 'technician__first_name')


@admin.register(Salon)
class SalonAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'location',
        'phone_primary',
        'google_rating_average',
        'google_rating_count',
        'is_active',
        'is_primary',
        'updated_at',
    )
    list_filter = ('is_active', 'is_primary')
    search_fields = ('name', 'location', 'email', 'phone_primary', 'google_place_id')
    prepopulated_fields = {'slug': ('name',)}
    readonly_fields = (
        'google_rating_average',
        'google_rating_count',
        'google_ratings_fetched_at',
    )
    actions = ('refresh_google_ratings',)

    @admin.action(description='Refresh Google ratings for selected salons')
    def refresh_google_ratings(self, request, queryset):
        from .google_places import refresh_salon_google_ratings

        updated = 0
        failed = 0
        for salon in queryset:
            _salon, error = refresh_salon_google_ratings(salon, force=True)
            if error:
                failed += 1
                self.message_user(request, f'{salon.name}: {error}', level=messages.WARNING)
            else:
                updated += 1
        self.message_user(
            request,
            f'Google ratings refreshed for {updated} salon(s)'
            + (f'; {failed} failed.' if failed else '.'),
        )


@admin.register(SalonContactInfo)
class SalonContactInfoAdmin(admin.ModelAdmin):
    list_display = (
        'phone_primary',
        'phone_secondary',
        'email',
        'location',
        'updated_at',
    )

    def has_add_permission(self, request):
        return not SalonContactInfo.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
