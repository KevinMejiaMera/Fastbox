from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid
import os

def menu_item_image_path(instance, filename):
    """Genera la ruta para las imágenes de items del menú"""
    ext = filename.split('.')[-1]
    filename = f'{instance.id}.{ext}'
    return os.path.join('menu', 'items', filename)

def category_image_path(instance, filename):
    """Genera la ruta para las imágenes de categorías"""
    ext = filename.split('.')[-1]
    filename = f'{instance.id}.{ext}'
    return os.path.join('menu', 'categories', filename)


class Category(models.Model):
    """Categorías dinámicas del menú"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True, verbose_name='Nombre')
    slug = models.SlugField(max_length=100, unique=True, verbose_name='Slug')
    description = models.TextField(blank=True, verbose_name='Descripción')
    
    # Imagen
    image = models.ImageField(
        upload_to=category_image_path, 
        blank=True, 
        null=True,
        verbose_name='Imagen'
    )
    
    # Color para UI (opcional)
    color = models.CharField(
        max_length=7,
        blank=True,
        verbose_name='Color',
        help_text='Código hexadecimal, ej: #FF5733'
    )
    
    # Icono (opcional, nombre del icono o clase CSS)
    icon = models.CharField(
        max_length=50,
        blank=True,
        verbose_name='Icono',
        help_text='Nombre del icono para usar en frontend'
    )
    
    # Configuración
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Categoría'
        verbose_name_plural = 'Categorías'
        ordering = ['display_order', 'name']
        indexes = [
            models.Index(fields=['is_active', 'display_order']),
            models.Index(fields=['slug']),
        ]
    
    def __str__(self):
        return self.name


class Product(models.Model):
    """Productos del menú de fast food"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    category = models.ForeignKey(
        Category, 
        on_delete=models.CASCADE, 
        related_name='products',
        verbose_name='Categoría'
    )
    
    # Información básica
    name = models.CharField(max_length=200, verbose_name='Nombre')
    slug = models.SlugField(max_length=200, unique=True, verbose_name='Slug')
    description = models.TextField(verbose_name='Descripción')
    
    image = models.ImageField(
        upload_to=menu_item_image_path,
        verbose_name='Imagen',
        blank=True,
        null=True
    )
    
    # Precio base (precio del tamaño regular/único)
    price = models.DecimalField(
        max_digits=10, 
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Precio'
    )
    
    # Información nutricional opcional
    calories = models.PositiveIntegerField(
        null=True, 
        blank=True, 
        verbose_name='Calorías'
    )
    
    # Ingredientes y alergenos
    ingredients = models.TextField(blank=True, verbose_name='Ingredientes')
    allergens = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='Alergenos',
        help_text='Ej: Gluten, Lácteos, Huevo'
    )
    
    # Estado y disponibilidad
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    is_available = models.BooleanField(default=True, verbose_name='Disponible')
    is_featured = models.BooleanField(default=False, verbose_name='Destacado')
    is_new = models.BooleanField(default=False, verbose_name='Nuevo')
    
    # Tiempo de preparación estimado (minutos)
    prep_time = models.PositiveIntegerField(
        default=10,
        verbose_name='Tiempo de preparación (min)'
    )
    
    # Orden de visualización
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    # Auditoría
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Producto'
        verbose_name_plural = 'Productos'
        ordering = ['category', 'display_order', 'name']
        indexes = [
            models.Index(fields=['category', 'is_active', 'is_available']),
            models.Index(fields=['is_featured']),
            models.Index(fields=['slug']),
        ]
    
    def __str__(self):
        return f'{self.name} - ${self.price}'
    
    def is_available_now(self):
        """Verifica disponibilidad"""
        return self.is_active and self.is_available


class Size(models.Model):
    """Tamaños disponibles para productos (Small, Medium, Large)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='sizes',
        verbose_name='Producto'
    )
    
    name = models.CharField(
        max_length=50, 
        verbose_name='Nombre',
        help_text='Ej: Pequeño, Mediano, Grande'
    )
    
    # Precio adicional sobre el precio base
    price_adjustment = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Ajuste de precio',
        help_text='Adicional al precio base. Puede ser negativo para descuento'
    )
    
    # Calorías específicas del tamaño
    calories = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Calorías'
    )
    
    is_default = models.BooleanField(default=False, verbose_name='Por defecto')
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Tamaño'
        verbose_name_plural = 'Tamaños'
        ordering = ['product', 'display_order']
        unique_together = ['product', 'name']
    
    def __str__(self):
        return f'{self.product.name} - {self.name}'
    
    def get_final_price(self):
        """Calcula el precio final del tamaño"""
        return self.product.price + self.price_adjustment


class Extra(models.Model):
    """Extras/Adicionales para los productos (Queso extra, Bacon, etc.)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(max_length=100, verbose_name='Nombre')
    description = models.CharField(
        max_length=255, 
        blank=True, 
        verbose_name='Descripción'
    )
    
    # Precio del extra
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Precio'
    )
    
    # Imagen opcional
    image = models.ImageField(
        upload_to='menu/extras/',
        blank=True,
        null=True,
        verbose_name='Imagen'
    )
    
    # Disponibilidad
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    
    # A qué productos aplica (Many-to-Many)
    products = models.ManyToManyField(
        Product,
        related_name='extras',
        blank=True,
        verbose_name='Productos'
    )
    
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Extra/Adicional'
        verbose_name_plural = 'Extras/Adicionales'
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return f'{self.name} (+${self.price})'


class Combo(models.Model):
    """Combos de comida rápida (Burger + Fries + Drink)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    name = models.CharField(max_length=200, verbose_name='Nombre')
    slug = models.SlugField(max_length=200, unique=True, verbose_name='Slug')
    description = models.TextField(verbose_name='Descripción')
    
    # Imagen del combo
    image = models.ImageField(
        upload_to='menu/combos/',
        verbose_name='Imagen'
    )
    
    # Precio del combo (con descuento)
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name='Precio'
    )
    
    # Configuración
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    is_featured = models.BooleanField(default=False, verbose_name='Destacado')
    is_promotion = models.BooleanField(default=False, verbose_name='Es Promoción')
    
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Combo'
        verbose_name_plural = 'Combos'
        ordering = ['display_order', 'name']
    
    def __str__(self):
        return f'{self.name} - ${self.price}'


class ComboProduct(models.Model):
    """Productos incluidos en un combo"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    combo = models.ForeignKey(
        Combo,
        on_delete=models.CASCADE,
        related_name='combo_products',
        verbose_name='Combo'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        verbose_name='Producto'
    )
    
    quantity = models.PositiveIntegerField(default=1, verbose_name='Cantidad')
    
    # Si el cliente puede elegir entre varias opciones del mismo tipo
    is_selectable = models.BooleanField(
        default=False,
        verbose_name='Seleccionable',
        help_text='El cliente puede elegir de varias opciones'
    )
    
    display_order = models.PositiveIntegerField(default=0, verbose_name='Orden')
    
    class Meta:
        verbose_name = 'Producto del Combo'
        verbose_name_plural = 'Productos del Combo'
        ordering = ['display_order']
    
    def __str__(self):
        return f'{self.combo.name} - {self.product.name} (x{self.quantity})'


class Supply(models.Model):
    """Insumos y materias primas de bodega"""
    UNIT_CHOICES = [
        ('unit', 'Unidad'),
        ('kg', 'Kilogramo (kg)'),
        ('g', 'Gramo (g)'),
        ('l', 'Litro (L)'),
        ('ml', 'Mililitro (ml)'),
        ('oz', 'Onza (oz)'),
        ('lb', 'Libra (lb)'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, unique=True, verbose_name='Nombre')
    description = models.TextField(blank=True, verbose_name='Descripción')
    
    unit = models.CharField(
        max_length=20, 
        choices=UNIT_CHOICES, 
        default='unit',
        verbose_name='Unidad de medida'
    )
    
    current_stock = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=0,
        verbose_name='Stock Actual'
    )
    
    minimum_stock = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=0,
        verbose_name='Stock Mínimo'
    )
    
    cost_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Costo por unidad'
    )
    
    is_active = models.BooleanField(default=True, verbose_name='Activo')
    is_production_item = models.BooleanField(
        default=False, verbose_name='Producto de mezcla',
        help_text='Si está marcado, este insumo solo se gestiona desde Mezclas/Producción y no aparece en el POS'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Insumo / Materia Prima'
        verbose_name_plural = 'Insumos'
        ordering = ['name']
    
    def __str__(self):
        return f'{self.name} ({self.get_unit_display()})'


class SupplyMovement(models.Model):
    """Movimientos de inventario (Ingresos, Egresos, Ajustes, Ventas)"""
    MOVEMENT_TYPES = [
        ('in', 'Ingreso (Compra/Reabastecimiento)'),
        ('out', 'Egreso (Desecho/Pérdida)'),
        ('sale', 'Egreso por Venta'),
        ('adjustment', 'Ajuste de Inventario'),
        ('production_out', 'Egreso por Producción'),
        ('production_in', 'Ingreso por Producción'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supply = models.ForeignKey(Supply, on_delete=models.CASCADE, related_name='movements', verbose_name='Insumo')
    
    movement_type = models.CharField(max_length=20, choices=MOVEMENT_TYPES, verbose_name='Tipo de Movimiento')
    quantity = models.DecimalField(max_digits=12, decimal_places=3, verbose_name='Cantidad')
    
    reason = models.CharField(max_length=255, blank=True, verbose_name='Motivo / Razón')
    reference_id = models.CharField(max_length=100, blank=True, verbose_name='ID Referencia (Venta/Factura)')
    
    created_by = models.CharField(max_length=100, blank=True, verbose_name='Registrado por')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha')
    
    class Meta:
        verbose_name = 'Movimiento de Bodega'
        verbose_name_plural = 'Movimientos de Bodega'
        ordering = ['-created_at']
        
    def __str__(self):
        sign = "+" if self.movement_type in ["in", "adjustment"] and self.quantity > 0 else "-"
        return f'{self.supply.name}: {sign}{abs(self.quantity)} ({self.get_movement_type_display()})'


class RecipeIngredient(models.Model):
    """Asigna insumos a los productos del menú (La Receta)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='recipe_ingredients', verbose_name='Producto')
    
    # Opcional: si el insumo depende del tamaño (ej: vaso pequeño o vaso grande)
    size = models.ForeignKey(Size, on_delete=models.CASCADE, related_name='recipe_ingredients', null=True, blank=True, verbose_name='Tamaño (Opcional)')
    
    supply = models.ForeignKey(Supply, on_delete=models.PROTECT, related_name='used_in_recipes', verbose_name='Insumo')
    
    quantity = models.DecimalField(max_digits=10, decimal_places=3, verbose_name='Cantidad requerida')
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Ingrediente de Receta'
        verbose_name_plural = 'Ingredientes de Receta'
        unique_together = ['product', 'size', 'supply']
        
    def __str__(self):
        if self.size:
            return f'{self.quantity} {self.supply.get_unit_display()} de {self.supply.name} para {self.product.name} ({self.size.name})'
        return f'{self.quantity} {self.supply.get_unit_display()} de {self.supply.name} para {self.product.name}'


class Recipe(models.Model):
    """Receta/Mezcla de producción - combina insumos para crear un producto"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name='Nombre')
    description = models.TextField(blank=True, verbose_name='Descripción')

    output_supply = models.ForeignKey(
        Supply, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='produced_by_recipes', verbose_name='Insumo de salida'
    )
    output_quantity = models.DecimalField(
        max_digits=12, decimal_places=3, default=0,
        verbose_name='Cantidad generada por batch'
    )

    is_active = models.BooleanField(default=True, verbose_name='Activo')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Receta de Producción'
        verbose_name_plural = 'Recetas de Producción'
        ordering = ['name']

    def __str__(self):
        return self.name


class RecipeSupply(models.Model):
    """Insumo requerido por una receta de producción"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipe = models.ForeignKey(
        Recipe, on_delete=models.CASCADE,
        related_name='ingredients', verbose_name='Receta'
    )
    supply = models.ForeignKey(
        Supply, on_delete=models.PROTECT,
        related_name='recipe_supplies', verbose_name='Insumo'
    )
    quantity_required = models.DecimalField(
        max_digits=12, decimal_places=3, verbose_name='Cantidad requerida por batch'
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Ingrediente de Receta de Producción'
        verbose_name_plural = 'Ingredientes de Recetas de Producción'
        unique_together = ['recipe', 'supply']

    def __str__(self):
        return f'{self.quantity_required} de {self.supply.name} para {self.recipe.name}'


class RecipeProduction(models.Model):
    """Registro de una producción ejecutada"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipe = models.ForeignKey(
        Recipe, on_delete=models.CASCADE,
        related_name='productions', verbose_name='Receta'
    )
    batch_multiplier = models.DecimalField(
        max_digits=12, decimal_places=3, default=1,
        verbose_name='Multiplicador (cantidad de batches)'
    )
    notes = models.TextField(blank=True, verbose_name='Notas')
    created_by = models.CharField(max_length=100, blank=True, verbose_name='Realizado por')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de producción')

    class Meta:
        verbose_name = 'Producción'
        verbose_name_plural = 'Producciones'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.recipe.name} x{self.batch_multiplier} - {self.created_at.strftime("%d/%m/%Y %H:%M")}'