import re

with open('functions/api/community/_lib/supabase.js', 'r', encoding='utf-8', errors='replace') as f:
    content = f.read()

# Add updateUser method before signOut
update_user_method = """      async updateUser(attributes) {
        try {
          const response = await fetch(new URL("/auth/v1/user", url), { method: "PUT", headers: { apikey: apiKey, Authorization: \x60Bearer \x24{bearer}\x60, "Content-Type": "application/json" }, body: JSON.stringify(attributes) });
          const data = await response.json().catch(() => null);
          return response.ok ? { data: { user: data }, error: null } : { data: { user: null }, error: data ?? { message: "User update failed" } };
        } catch (error) { return { data: { user: null }, error: { message: error instanceof Error ? error.message : "User update failed" } }; }
      },
      async signOut() {"""

content = content.replace('      async signOut() {', update_user_method)

# Fix broken Korean strings in authenticatedSupabase
content = re.sub(
    r'if \(!token\) return \{ error: errorResponse\(401, "AUTH_REQUIRED", ".*?"\) \};',
    'if (!token) return { error: errorResponse(401, "AUTH_REQUIRED", "\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.") };',
    content
)
content = re.sub(
    r'try \{ client = publicSupabase\(context\.env, token\); \} catch \{ return \{ error: errorResponse\(503, "CONFIGURATION_ERROR", ".*?"\) \}; \}',
    'try { client = publicSupabase(context.env, token); } catch { return { error: errorResponse(503, "CONFIGURATION_ERROR", "\uC778\uC99D \uC11C\uBE44\uC2A4 \uC124\uC815\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.") }; }',
    content
)
content = re.sub(
    r'if \(error \|\| !data\.user\) return \{ error: errorResponse\(401, "AUTH_REQUIRED", ".*?"\) \};',
    'if (error || !data.user) return { error: errorResponse(401, "AUTH_REQUIRED", "\uB85C\uADF8\uC778 \uC0C1\uD0DC\uAC00 \uB9CC\uB8CC\uB418\uC5C8\uAC70\uB098 \uC720\uD6A8\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.") };',
    content
)

with open('functions/api/community/_lib/supabase.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Done!")
