from django.contrib import admin

from .models import Booking, ContactMessage, Salon, SalonContactInfo, TimeSlot, UserProfile


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('name', 'phone', 'service', 'location', 'user', 'created_at')
    list_filter = ('service', 'created_at')
    search_fields = ('name', 'phone', 'location')


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ('worker', 'date', 'start_hour', 'status', 'booking')
    list_filter = ('status', 'date')
    search_fields = ('worker__username', 'worker__email')


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'phone', 'role', 'salon', 'technician_rating_average', 'default_location')
    list_filter = ('role',)
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


@admin.register(Salon)
class SalonAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'phone_primary', 'is_active', 'is_primary', 'updated_at')
    list_filter = ('is_active', 'is_primary')
    search_fields = ('name', 'location', 'email', 'phone_primary')
    prepopulated_fields = {'slug': ('name',)}


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
