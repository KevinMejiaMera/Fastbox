import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.menu.serializers import RecipeIngredientSerializer

# We don't need real UUIDs, we just need to see validation errors.
data = {
    'product': 'c5160736-5e27-4910-aa4c-9d89a438caf4',
    'supply': '46c879ff-f596-4be4-9656-c019c2bdbec6',
    'quantity': 1
}

s = RecipeIngredientSerializer(data=data)
if not s.is_valid():
    print(s.errors)
else:
    print("Valid!")
