import re

with open('components/auth/supabase-auth-flow.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'const [message, setMessage] = useState("");',
    'const [message, setMessage] = useState("");\n    const [rememberMe, setRememberMe] = useState(true);'
)

content = content.replace(
    'body: JSON.stringify({ email, password, captchaToken: loginCaptchaToken }),',
    'body: JSON.stringify({ email, password, rememberMe, captchaToken: loginCaptchaToken }),'
)

content = content.replace(
    'body: JSON.stringify({ email, token, captchaToken: verifyCaptchaToken }),',
    'body: JSON.stringify({ email, token, rememberMe, captchaToken: verifyCaptchaToken }),'
)

checkbox_ui = """
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-700" />
            <label htmlFor="rememberMe" className="text-sm text-gray-700">로그인 상태 유지</label>
          </div>"""

# Replace in login step
login_old = """<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700" />
          </div>"""
content = content.replace(login_old, login_old + checkbox_ui)

# Replace in otp-verify step
otp_old = """<input required type="text" maxLength={8} value={token} onChange={(e) => setToken(e.target.value.replace(/\\D/g, ""))} placeholder="8자리 코드" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm tracking-widest focus:border-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-700" />
          </div>"""
content = content.replace(otp_old, otp_old + checkbox_ui)

with open('components/auth/supabase-auth-flow.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print("UI updated")
