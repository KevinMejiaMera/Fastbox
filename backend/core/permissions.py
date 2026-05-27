from functools import wraps
from django.http import JsonResponse

def require_authentication(view_func):
    """
    Decorador para requerir autenticación en una vista
    Adaptado para monolito: usa request.user
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({
                'error': 'Autenticación requerida'
            }, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper

def require_permission(permission_code):
    """
    Decorador para requerir un permiso específico
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({'error': 'Autenticación requerida'}, status=401)
            
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # TODO: implement permission checks if needed
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator

def require_staff(view_func):
    """
    Decorador para requerir que el usuario sea staff
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Autenticación requerida'}, status=401)
        
        if not request.user.is_staff and not request.user.is_superuser:
            return JsonResponse({'error': 'Permisos de staff requeridos'}, status=403)
        
        return view_func(request, *args, **kwargs)
    return wrapper

def require_role(role_name):
    """
    Decorador para requerir un rol específico
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({'error': 'Autenticación requerida'}, status=401)
            
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Verificamos a través del modelo Role asociado
            user_role = getattr(request.user, 'role', None)
            if not user_role or user_role.name != role_name:
                return JsonResponse({'error': f'Rol {role_name} requerido'}, status=403)
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator