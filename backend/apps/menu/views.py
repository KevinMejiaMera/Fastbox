from rest_framework import viewsets, status, filters
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly, AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch

from core.permissions import require_authentication, require_staff
from .models import Category, Product, Size, Extra, Combo, ComboProduct
from .serializers import (
    CategorySerializer,
    ProductListSerializer,
    ProductDetailSerializer,
    ProductCreateUpdateSerializer,
    SizeSerializer,
    SizeCreateUpdateSerializer,
    ExtraSerializer,
    ExtraCreateUpdateSerializer,
    ComboListSerializer,
    ComboDetailSerializer,
    ComboCreateUpdateSerializer,
)


# ============================================================================
# VIEWS DE PRUEBA Y HEALTH CHECK
# ============================================================================

@api_view(['GET'])
@require_authentication
def test_auth_view(request):
    """
    Vista de prueba para verificar que la autenticación JWT funciona
    GET /api/menu/test-auth/
    """
    return Response({
        'message': 'Autenticación exitosa',
        'user_id': request.user_id,
        'username': request.username,
        'email': request.user_email,
        'role': request.user_role,
        'is_staff': request.is_staff,
        'is_superuser': request.is_superuser
    })


@api_view(['GET'])
@require_staff
def test_staff_view(request):
    """
    Vista de prueba que requiere permisos de staff
    GET /api/menu/test-staff/
    """
    return Response({
        'message': 'Acceso de staff exitoso',
        'user': request.username
    })


@api_view(['GET'])
def health_check(request):
    """
    Health check endpoint (sin autenticación)
    GET /api/menu/health/
    """
    return Response({
        'status': 'ok',
        'service': 'fast-food-service'
    })


# ============================================================================
# VIEWSETS DEL MENÚ
# ============================================================================

class CategoryViewSet(viewsets.ModelViewSet):
    """
    ViewSet para categorías del menú
    
    list: Lista todas las categorías activas
    retrieve: Obtiene detalle de una categoría
    create: Crea una nueva categoría
    update: Actualiza una categoría
    partial_update: Actualiza parcialmente una categoría
    destroy: Elimina una categoría
    """
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['display_order', 'name', 'created_at']
    ordering = ['display_order', 'name']
    lookup_field = 'pk'  # ← CAMBIADO de 'slug' a 'pk'
    
    def get_queryset(self):
        """Optimiza queries con prefetch"""
        queryset = super().get_queryset()
        return queryset
    
    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):  # ← CAMBIADO slug a pk
        """Obtiene todos los productos de una categoría"""
        category = self.get_object()
        products = category.products.filter(
            is_active=True, 
            is_available=True
        ).select_related('category').prefetch_related('sizes', 'extras')
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Obtiene categorías destacadas con productos destacados"""
        categories = self.get_queryset().filter(
            is_active=True,
            products__is_featured=True
        ).distinct()
        
        serializer = self.get_serializer(categories, many=True)
        return Response(serializer.data)


class ProductViewSet(viewsets.ModelViewSet):
    """
    ViewSet para productos del menú
    
    list: Lista todos los productos
    retrieve: Obtiene detalle de un producto
    create: Crea un nuevo producto
    update: Actualiza un producto
    partial_update: Actualiza parcialmente un producto
    destroy: Elimina un producto
    """
    queryset = Product.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['category', 'is_active', 'is_available', 'is_featured', 'is_new']
    search_fields = ['name', 'description', 'ingredients']
    ordering_fields = ['display_order', 'name', 'price', 'created_at']
    ordering = ['category__display_order', 'display_order', 'name']
    lookup_field = 'pk'  # ← CAMBIADO de 'slug' a 'pk'
    
    def get_queryset(self):
        """Optimiza queries y filtra según contexto"""
        queryset = super().get_queryset().select_related('category').prefetch_related(
            'sizes',
            'extras'
        )
        
        # Filtros adicionales por query params
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)
        
        return queryset
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado según la acción"""
        if self.action == 'list':
            return ProductListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ProductCreateUpdateSerializer
        return ProductDetailSerializer
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Obtiene productos destacados"""
        products = self.get_queryset().filter(
            is_featured=True,
            is_active=True,
            is_available=True
        )[:10]
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def new(self, request):
        """Obtiene productos nuevos"""
        products = self.get_queryset().filter(
            is_new=True,
            is_active=True,
            is_available=True
        ).order_by('-created_at')[:10]
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def sizes(self, request, pk=None):  # ← CAMBIADO slug a pk
        """Obtiene tamaños disponibles del producto"""
        product = self.get_object()
        sizes = product.sizes.filter(is_active=True).order_by('display_order')
        
        serializer = SizeSerializer(sizes, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def extras(self, request, pk=None):  # ← CAMBIADO slug a pk
        """Obtiene extras disponibles del producto"""
        product = self.get_object()
        extras = product.extras.filter(is_active=True).order_by('display_order')
        
        serializer = ExtraSerializer(extras, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def search(self, request):
        """Búsqueda avanzada de productos"""
        query = request.query_params.get('q', '')
        
        if not query:
            return Response(
                {'error': 'El parámetro "q" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        products = self.get_queryset().filter(
            Q(name__icontains=query) |
            Q(description__icontains=query) |
            Q(ingredients__icontains=query) |
            Q(category__name__icontains=query)
        ).distinct()
        
        serializer = ProductListSerializer(products, many=True)
        return Response(serializer.data)


class SizeViewSet(viewsets.ModelViewSet):
    """
    ViewSet para tamaños de productos
    
    list: Lista todos los tamaños
    retrieve: Obtiene detalle de un tamaño
    create: Crea un nuevo tamaño
    update: Actualiza un tamaño
    partial_update: Actualiza parcialmente un tamaño
    destroy: Elimina un tamaño
    """
    queryset = Size.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['product', 'is_active', 'is_default']
    ordering_fields = ['display_order', 'price_adjustment']
    ordering = ['product', 'display_order']
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().select_related('product')
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action in ['create', 'update', 'partial_update']:
            return SizeCreateUpdateSerializer
        return SizeSerializer
    
    @action(detail=False, methods=['get'])
    def by_product(self, request):
        """Obtiene tamaños de un producto específico"""
        product_id = request.query_params.get('product_id')
        
        if not product_id:
            return Response(
                {'error': 'El parámetro "product_id" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        sizes = self.get_queryset().filter(
            product_id=product_id,
            is_active=True
        )
        
        serializer = SizeSerializer(sizes, many=True)
        return Response(serializer.data)


class ExtraViewSet(viewsets.ModelViewSet):
    """
    ViewSet para extras/adicionales
    
    list: Lista todos los extras
    retrieve: Obtiene detalle de un extra
    create: Crea un nuevo extra
    update: Actualiza un extra
    partial_update: Actualiza parcialmente un extra
    destroy: Elimina un extra
    """
    queryset = Extra.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['display_order', 'name', 'price']
    ordering = ['display_order', 'name']
    
    def get_queryset(self):
        """Optimiza queries"""
        return super().get_queryset().prefetch_related('products')
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action in ['create', 'update', 'partial_update']:
            return ExtraCreateUpdateSerializer
        return ExtraSerializer
    
    @action(detail=False, methods=['get'])
    def by_product(self, request):
        """Obtiene extras disponibles para un producto específico"""
        product_id = request.query_params.get('product_id')
        
        if not product_id:
            return Response(
                {'error': 'El parámetro "product_id" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        extras = self.get_queryset().filter(
            products__id=product_id,
            is_active=True
        )
        
        serializer = ExtraSerializer(extras, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def add_products(self, request, pk=None):
        """Asocia productos a un extra"""
        extra = self.get_object()
        product_ids = request.data.get('product_ids', [])
        
        if not product_ids:
            return Response(
                {'error': 'Se requiere una lista de product_ids'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        extra.products.add(*product_ids)
        
        serializer = self.get_serializer(extra)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def remove_products(self, request, pk=None):
        """Desasocia productos de un extra"""
        extra = self.get_object()
        product_ids = request.data.get('product_ids', [])
        
        if not product_ids:
            return Response(
                {'error': 'Se requiere una lista de product_ids'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        extra.products.remove(*product_ids)
        
        serializer = self.get_serializer(extra)
        return Response(serializer.data)


class ComboViewSet(viewsets.ModelViewSet):
    """
    ViewSet para combos
    
    list: Lista todos los combos
    retrieve: Obtiene detalle de un combo
    create: Crea un nuevo combo
    update: Actualiza un combo
    partial_update: Actualiza parcialmente un combo
    destroy: Elimina un combo
    """
    queryset = Combo.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active', 'is_featured', 'is_promotion']
    search_fields = ['name', 'description']
    ordering_fields = ['display_order', 'name', 'price', 'created_at']
    ordering = ['display_order', 'name']
    lookup_field = 'pk'  # ← CAMBIADO de 'slug' a 'pk'
    
    def get_queryset(self):
        """Optimiza queries"""
        queryset = super().get_queryset().prefetch_related(
            Prefetch(
                'combo_products',
                queryset=ComboProduct.objects.select_related('product')
            )
        )
        
        # Filtros adicionales
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')
        
        if min_price:
            queryset = queryset.filter(price__gte=min_price)
        if max_price:
            queryset = queryset.filter(price__lte=max_price)
        
        return queryset
    
    def get_serializer_class(self):
        """Retorna el serializer apropiado"""
        if self.action == 'list':
            return ComboListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ComboCreateUpdateSerializer
        return ComboDetailSerializer
    
    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Obtiene combos destacados"""
        combos = self.get_queryset().filter(
            is_featured=True,
            is_active=True
        )[:10]
        
        serializer = ComboListSerializer(combos, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def products(self, request, pk=None):  # ← CAMBIADO slug a pk
        """Obtiene productos incluidos en el combo"""
        combo = self.get_object()
        combo_products = combo.combo_products.all().select_related('product')
        
        # Retornar información detallada de los productos
        data = []
        for cp in combo_products:
            data.append({
                'id': cp.id,
                'product': ProductListSerializer(cp.product).data,
                'quantity': cp.quantity,
                'is_selectable': cp.is_selectable,
                'display_order': cp.display_order
            })
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def calculate_savings(self, request):
        """Calcula ahorro de todos los combos"""
        combos = self.get_queryset().filter(is_active=True)
        
        data = []
        for combo in combos:
            individual_price = sum(
                cp.product.price * cp.quantity 
                for cp in combo.combo_products.all()
            )
            savings = individual_price - combo.price
            savings_percentage = (savings / individual_price * 100) if individual_price > 0 else 0
            
            data.append({
                'id': combo.id,
                'name': combo.name,
                'combo_price': float(combo.price),
                'individual_price': float(individual_price),
                'savings': float(savings),
                'savings_percentage': round(savings_percentage, 2)
            })
        
        return Response(data)


class MenuViewSet(viewsets.ViewSet):
    """
    ViewSet para obtener el menú completo
    Endpoints personalizados para el menú
    """
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['get'])
    def full(self, request):
        """
        Obtiene el menú completo con todas las categorías y productos
        """
        categories = Category.objects.filter(is_active=True).prefetch_related(
            Prefetch(
                'products',
                queryset=Product.objects.filter(
                    is_active=True,
                    is_available=True
                ).prefetch_related('sizes', 'extras')
            )
        ).order_by('display_order')
        
        data = []
        for category in categories:
            category_data = CategorySerializer(category).data
            category_data['products'] = ProductListSerializer(
                category.products.all(),
                many=True
            ).data
            data.append(category_data)
        
        return Response(data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """
        Obtiene un resumen del menú (solo categorías con conteos)
        """
        categories = Category.objects.filter(is_active=True).order_by('display_order')
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)


# ============================================================================
# VIEWSETS DE BODEGA / INVENTARIO
# ============================================================================

from .models import Supply, SupplyMovement, RecipeIngredient, Recipe, RecipeSupply, RecipeProduction
from .serializers import (
    SupplySerializer, SupplyMovementSerializer, RecipeIngredientSerializer,
    RecipeListSerializer, RecipeDetailSerializer, RecipeCreateUpdateSerializer,
    RecipeProductionSerializer
)

class SupplyViewSet(viewsets.ModelViewSet):
    """
    ViewSet para Insumos (Bodega)
    """
    queryset = Supply.objects.all()
    serializer_class = SupplySerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active', 'unit', 'is_production_item']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'current_stock', 'created_at']
    ordering = ['name']

    @action(detail=True, methods=['post'])
    def record_movement(self, request, pk=None):
        """Registra un ingreso o egreso manual del insumo"""
        supply = self.get_object()
        movement_type = request.data.get('movement_type')
        quantity = request.data.get('quantity')
        reason = request.data.get('reason', '')
        
        try:
            quantity = float(quantity)
        except (TypeError, ValueError):
            return Response({'error': 'La cantidad debe ser un número válido'}, status=status.HTTP_400_BAD_REQUEST)
            
        if movement_type not in ['in', 'out', 'adjustment']:
            return Response({'error': 'Tipo de movimiento inválido'}, status=status.HTTP_400_BAD_REQUEST)
            
        if quantity <= 0:
            return Response({'error': 'La cantidad debe ser mayor a cero'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Generar movimiento
        movement = SupplyMovement.objects.create(
            supply=supply,
            movement_type=movement_type,
            quantity=quantity,
            reason=reason,
            created_by=request.user.username if hasattr(request, 'user') and not request.user.is_anonymous else 'Admin'
        )
        
        # Actualizar stock
        from decimal import Decimal
        if movement_type == 'in':
            supply.current_stock += Decimal(str(quantity))
        elif movement_type == 'out':
            supply.current_stock -= Decimal(str(quantity))
        elif movement_type == 'adjustment':
            # Ajuste puede ser reemplazar el stock o sumarle, asumiremos que adjustment quantity es la diferencia real
            # Para este caso simple, si es ajuste positivo suma, negativo resta, pero arriba validamos quantity > 0
            # Si quiere hacer un ajuste negativo, usa 'out'.
            supply.current_stock = Decimal(str(quantity)) # Replace completely if adjustment? Or let's just make adjustment replace current_stock.
            movement.quantity = Decimal(str(quantity))
            movement.save()
            
        supply.save()
        
        return Response({
            'message': 'Movimiento registrado con éxito',
            'current_stock': supply.current_stock
        })


class SupplyMovementViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para leer historial de Movimientos de Bodega (solo lectura)
    """
    queryset = SupplyMovement.objects.all().select_related('supply')
    serializer_class = SupplyMovementSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['supply', 'movement_type']
    ordering_fields = ['created_at']
    ordering = ['-created_at']


class RecipeIngredientViewSet(viewsets.ModelViewSet):
    """
    ViewSet para administrar la receta (Product -> Supply)
    """
    queryset = RecipeIngredient.objects.all().select_related('product', 'supply', 'size')
    serializer_class = RecipeIngredientSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['product', 'supply']


# ============================================================================
# VIEWSETS PARA RECETAS DE PRODUCCIÓN (MEZCLAS)
# ============================================================================

class RecipeViewSet(viewsets.ModelViewSet):
    """
    ViewSet para administrar recetas de producción (mezclas)
    """
    queryset = Recipe.objects.all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return RecipeListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return RecipeCreateUpdateSerializer
        return RecipeDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.prefetch_related('ingredients__supply').select_related('output_supply')
        if self.action in ['retrieve', 'produce']:
            qs = qs.prefetch_related('productions')
        return qs

    @action(detail=True, methods=['post'])
    def produce(self, request, pk=None):
        """Ejecuta la producción: descuenta insumos y genera el output"""
        from decimal import Decimal

        recipe = self.get_object()
        batch_multiplier = request.data.get('batch_multiplier', 1)
        notes = request.data.get('notes', '')

        try:
            multiplier = Decimal(str(batch_multiplier))
        except (TypeError, ValueError):
            return Response({'error': 'Multiplicador inválido'}, status=status.HTTP_400_BAD_REQUEST)

        if multiplier <= 0:
            return Response({'error': 'El multiplicador debe ser mayor a 0'}, status=status.HTTP_400_BAD_REQUEST)

        ingredients = recipe.ingredients.all().select_related('supply')
        if not ingredients:
            return Response({'error': 'La receta no tiene ingredientes'}, status=status.HTTP_400_BAD_REQUEST)

        # Validar stock suficiente
        stock_errors = []
        for ing in ingredients:
            needed = ing.quantity_required * multiplier
            if ing.supply.current_stock < needed:
                stock_errors.append(
                    f'{ing.supply.name}: necesita {needed} {ing.supply.get_unit_display()}, '
                    f'disponible {ing.supply.current_stock} {ing.supply.get_unit_display()}'
                )

        if stock_errors:
            return Response({
                'error': 'Stock insuficiente para producir',
                'details': stock_errors
            }, status=status.HTTP_400_BAD_REQUEST)

        created_by = request.user.username if hasattr(request, 'user') and request.user.is_authenticated else 'Admin'

        # Descontar insumos
        deductions = []
        for ing in ingredients:
            qty = ing.quantity_required * multiplier
            supply = ing.supply
            supply.current_stock -= qty
            supply.save()

            SupplyMovement.objects.create(
                supply=supply,
                movement_type='production_out',
                quantity=qty,
                reason=f'Producción: {recipe.name} x{multiplier}',
                created_by=created_by
            )
            deductions.append({
                'supply_id': str(supply.id),
                'supply_name': supply.name,
                'quantity': float(qty),
                'unit': supply.get_unit_display()
            })

        # Generar output
        output = None
        if recipe.output_supply and recipe.output_quantity > 0:
            output_qty = recipe.output_quantity * multiplier
            recipe.output_supply.current_stock += output_qty
            recipe.output_supply.save()

            SupplyMovement.objects.create(
                supply=recipe.output_supply,
                movement_type='production_in',
                quantity=output_qty,
                reason=f'Producción: {recipe.name} x{multiplier}',
                created_by=created_by
            )
            output = {
                'supply_id': str(recipe.output_supply.id),
                'supply_name': recipe.output_supply.name,
                'quantity': float(output_qty),
                'unit': recipe.output_supply.get_unit_display()
            }

        # Registrar producción
        production = RecipeProduction.objects.create(
            recipe=recipe,
            batch_multiplier=multiplier,
            notes=notes,
            created_by=created_by
        )

        return Response({
            'message': 'Producción realizada con éxito',
            'production_id': str(production.id),
            'recipe_name': recipe.name,
            'batch_multiplier': float(multiplier),
            'deductions': deductions,
            'output': output,
            'created_at': production.created_at.isoformat()
        })


class RecipeProductionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de solo lectura para historial de producciones
    """
    queryset = RecipeProduction.objects.all().select_related('recipe')
    serializer_class = RecipeProductionSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['recipe']
    ordering_fields = ['created_at']
    ordering = ['-created_at']