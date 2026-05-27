import os
import re

filepath = r'c:\Users\HP\Documents\GitHub\Fastbox\backend\config\settings.py'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add apps to INSTALLED_APPS
apps_to_add = '''    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'apps.authentication',
    'apps.users',
    'apps.roles',
'''
content = re.sub(r"(\s*'apps\.menu',)", r"\n" + apps_to_add + r"\1", content)

# 2. Add AUTH_USER_MODEL
if 'AUTH_USER_MODEL' not in content:
    content = content.replace('WSGI_APPLICATION = \'config.wsgi.application\'', 'WSGI_APPLICATION = \'config.wsgi.application\'\n\n# Custom User Model\nAUTH_USER_MODEL = \'users.User\'\n')

# 3. Update REST_FRAMEWORK DEFAULT_AUTHENTICATION_CLASSES
auth_class = "        'rest_framework_simplejwt.authentication.JWTAuthentication',\n        'rest_framework.authentication.SessionAuthentication',"
content = re.sub(
    r"'DEFAULT_AUTHENTICATION_CLASSES': \[\s*# 'rest_framework\.authentication\.SessionAuthentication',  # ← DESACTIVADO - Requiere CSRF\s*\],",
    f"'DEFAULT_AUTHENTICATION_CLASSES': [\n{auth_class}\n    ],",
    content
)

# 4. Update REST_FRAMEWORK DEFAULT_PERMISSION_CLASSES
perm_class = "'rest_framework.permissions.IsAuthenticated',"
content = re.sub(
    r"'rest_framework\.permissions\.AllowAny',",
    perm_class,
    content
)

# 5. Update SIMPLE_JWT
simple_jwt_full = '''SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'VERIFYING_KEY': None,
    'AUDIENCE': None,
    'ISSUER': None,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'USER_AUTHENTICATION_RULE': 'rest_framework_simplejwt.authentication.default_user_authentication_rule',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
    'JTI_CLAIM': 'jti',
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
    'SLIDING_TOKEN_LIFETIME': timedelta(minutes=5),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
}'''

content = re.sub(
    r'SIMPLE_JWT = \{.*?\}',
    simple_jwt_full,
    content,
    flags=re.DOTALL
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Settings updated successfully.')
