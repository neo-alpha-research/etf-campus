with open('components/auth/supabase-auth-flow.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

checkbox_ui = """
            <label className="flex items-center gap-2 mt-2">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-700" />
              <span className="text-sm font-medium text-slate-700">로그인 상태 유지</span>
            </label>"""

content = content.replace(
    '</label>\n            <TurnstileCaptcha key={`community_password_login_${captchaKey}`}',
    '</label>' + checkbox_ui + '\n            <TurnstileCaptcha key={`community_password_login_${captchaKey}`}'
)

content = content.replace(
    '</label>\n            <TurnstileCaptcha key={`community_otp_verify_${captchaKey}`}',
    '</label>' + checkbox_ui + '\n            <TurnstileCaptcha key={`community_otp_verify_${captchaKey}`}'
)

with open('components/auth/supabase-auth-flow.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("UI updated 2")
