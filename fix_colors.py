import os

file_path = 'frontend/src/modulos/fast-food/PuntosVenta.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Calculator colors
content = content.replace('#eef2ff', 'var(--sidebar-bg)')
content = content.replace('#e0e7ff', 'var(--sidebar-bg)')
content = content.replace('#c7d2fe', 'var(--border-color)')
content = content.replace('#a5b4fc', 'var(--border-color)')
content = content.replace('#3730a3', 'var(--primary-color)')
content = content.replace('#4f46e5', 'var(--primary-color)')

# Replace Aplicar button (yellow to primary)
content = content.replace('#f59e0b', 'var(--primary-color)')

# Replace Editar Pedido gray background
content = content.replace("backgroundColor: '#9ca3af'", "backgroundColor: 'var(--secondary-color)', color: 'var(--primary-color)'")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Colors updated successfully')
