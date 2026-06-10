from django.contrib import admin
from .models import Category, Product, Size, Extra, Combo, ComboProduct, Supply, SupplyMovement, RecipeIngredient, Recipe, RecipeSupply, RecipeProduction

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'display_order', 'is_active', 'products_count')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    ordering = ('display_order', 'name')

    def products_count(self, obj):
        return obj.products.count()
    products_count.short_description = 'Productos'

class SizeInline(admin.TabularInline):
    model = Size
    extra = 1

class ExtraInline(admin.TabularInline):
    model = Extra.products.through
    extra = 1

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'is_active', 'is_available', 'display_order')
    list_filter = ('category', 'is_active', 'is_available', 'is_featured')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [SizeInline]
    ordering = ('category', 'display_order', 'name')
    list_editable = ('price', 'is_active', 'is_available')

@admin.register(Size)
class SizeAdmin(admin.ModelAdmin):
    list_display = ('product', 'name', 'price_adjustment', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('product__name', 'name')

@admin.register(Extra)
class ExtraAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('name',)

class ComboProductInline(admin.TabularInline):
    model = ComboProduct
    extra = 1

@admin.register(Combo)
class ComboAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'is_active', 'is_featured')
    list_filter = ('is_active', 'is_featured')
    search_fields = ('name', 'description')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [ComboProductInline]


# --- BODEGA / INVENTARIO ---
@admin.register(Supply)
class SupplyAdmin(admin.ModelAdmin):
    list_display = ('name', 'unit', 'current_stock', 'minimum_stock', 'cost_per_unit', 'is_active', 'is_production_item')
    list_filter = ('is_active', 'unit', 'is_production_item')
    search_fields = ('name', 'description')
    ordering = ('name',)

@admin.register(SupplyMovement)
class SupplyMovementAdmin(admin.ModelAdmin):
    list_display = ('supply', 'movement_type', 'quantity', 'reason', 'created_by', 'created_at')
    list_filter = ('movement_type',)
    search_fields = ('supply__name', 'reason')
    ordering = ('-created_at',)

@admin.register(RecipeIngredient)
class RecipeIngredientAdmin(admin.ModelAdmin):
    list_display = ('product', 'supply', 'quantity')
    list_filter = ('product', 'supply')
    search_fields = ('product__name', 'supply__name')


# --- RECETAS DE PRODUCCIÓN (MEZCLAS) ---
class RecipeSupplyInline(admin.TabularInline):
    model = RecipeSupply
    extra = 1

@admin.register(Recipe)
class RecipeAdmin(admin.ModelAdmin):
    list_display = ('name', 'output_supply', 'output_quantity', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
    inlines = [RecipeSupplyInline]
    ordering = ('name',)

@admin.register(RecipeSupply)
class RecipeSupplyAdmin(admin.ModelAdmin):
    list_display = ('recipe', 'supply', 'quantity_required')
    list_filter = ('recipe',)
    search_fields = ('recipe__name', 'supply__name')

@admin.register(RecipeProduction)
class RecipeProductionAdmin(admin.ModelAdmin):
    list_display = ('recipe', 'batch_multiplier', 'created_by', 'created_at')
    list_filter = ('recipe',)
    ordering = ('-created_at',)
