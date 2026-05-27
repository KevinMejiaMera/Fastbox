import os
import re

files_to_update = [
    r'c:\Users\HP\Documents\GitHub\Fastbox\nginx.conf',
    r'c:\Users\HP\Documents\GitHub\Fastbox\nginx-dev.conf'
]

for filepath in files_to_update:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace upstreams
    content = re.sub(r'upstream auth_backend \{.*?\}', '', content, flags=re.DOTALL)
    content = re.sub(r'upstream fastfood_backend \{.*?\}', 'upstream backend {\n        server backend:8000 max_fails=3 fail_timeout=30s;\n    }', content, flags=re.DOTALL)

    # Replace proxy_pass
    content = content.replace('proxy_pass http://auth_backend;', 'proxy_pass http://backend;')
    content = content.replace('proxy_pass http://fastfood_backend;', 'proxy_pass http://backend;')

    # Remove static files config for auth and fastfood separately, and unify to backend
    content = re.sub(r'location /static/auth/ \{.*?\}', '', content, flags=re.DOTALL)
    content = re.sub(r'location /fast-food/static/ \{.*?\}', '', content, flags=re.DOTALL)
    content = re.sub(r'location /static/fastfood/ \{.*?\}', '''location /static/ {
            alias /usr/share/nginx/html/static/backend/;
            expires 30d;
            add_header Cache-Control "public, immutable";
            access_log off;
        }''', content, flags=re.DOTALL)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print('Nginx configs updated.')

# Now update docker-desarrollo
filepath = r'c:\Users\HP\Documents\GitHub\Fastbox\docker-desarrollo'
if os.path.exists(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We will do a basic string replacement or simply notify the user.
    # It's better to just leave it as is if it's too complex, but let's try a regex for services.
    # Actually, we can just replace auth-service and fast-food-service blocks with backend block.
    # Since docker-desarrollo is similar to docker-compose.yml we can just copy the services we generated.
    pass
