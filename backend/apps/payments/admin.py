from django.contrib import admin
from .models import CashMovement, CashRegister, Currency, ExchangeRate, PaymentMethod, Payment

@admin.register(CashMovement)
class CashMovementAdmin(admin.ModelAdmin):
    list_display = ('cash_register', 'movement_type', 'reason', 'amount', 'created_at', 'performed_by')
    list_filter = ('movement_type', 'reason', 'created_at')
    search_fields = ('description', 'performed_by')
    date_hierarchy = 'created_at'

admin.site.register(CashRegister)
admin.site.register(Currency)
admin.site.register(ExchangeRate)
admin.site.register(PaymentMethod)
admin.site.register(Payment)
