import os

def update_endpoint(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Read rememberMe from payload
    if 'const email =' in content:
        content = content.replace('const email =', 'const rememberMe = payload?.rememberMe !== false;\n  const email =')
    
    # Pass rememberMe to sessionHeaders
    content = content.replace('const headers = sessionHeaders(session);', 'const headers = sessionHeaders(session, undefined, rememberMe);')
    
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

update_endpoint('functions/api/community/auth/login-password.js')
update_endpoint('functions/api/community/auth/verify-otp.js')
print("Endpoints updated")
