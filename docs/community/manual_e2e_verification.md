# 커뮤니티 인증 보안 수동 검증 절차서 (E2E)

본 문서는 자동화 스크립트(Agent/Playwright 등)가 통과할 수 없는 Turnstile CAPTCHA 및 실제 이메일 기반 OTP 흐름을 운영자가 수동으로 검증하기 위한 절차서입니다.

## 0. 사전 준비 및 주의사항
- **반드시 Canonical Preview 도메인에서 수행할 것**: 예) `https://fix-community-auth-hardening.etf-campus.pages.dev`
- **주의**: Raw Pages deployment URL (예: `1a2b3c4d.etf-campus.pages.dev`)에서는 Turnstile의 호스트네임 검증과 일치하지 않아 캡차 통과가 실패하는 것이 정상입니다. 테스트 통과를 위해 Turnstile의 호스트네임 검증을 절대 약화(disable)하지 마십시오.
- **전용 테스트 계정 사용**: 운영자 개인 계정이 아닌 테스트 전용 이메일 계정을 사용하십시오.
- **테스트 후 정리**: 테스트가 끝난 후 작성된 게시물과 테스트 계정은 Supabase 대시보드 및 서비스 내에서 탈퇴/삭제 처리하여 정리하십시오.
- **검사 도구**: 브라우저의 개발자 도구 (F12) -> **Network 탭**을 열고 `Preserve log`를 체크한 뒤 진행하십시오.

---

## 단계별 검증 절차 (H-1 ~ H-5)

### H-1: `verify-otp` 응답 및 보안 헤더 확인
1. Preview 도메인에 접속하여 로그인을 시도하고 이메일 OTP 코드를 입력합니다.
2. Network 탭에서 `POST /api/community/auth/verify-otp` 요청을 클릭하여 응답을 확인합니다.
3. **기대 결과**:
   - Status: `200 OK`
   - Response Body: JSON 본문에 `token`, `tempAccessToken`, `tempRefreshToken` 등 어떠한 토큰 문자열도 없어야 합니다.
   - Response Headers: 
     - `Set-Cookie` 헤더에 `__Host-etf-campus-community-pwsetup` 쿠키가 설정되어야 합니다.
     - `X-Community-CSRF` 헤더가 존재하고 값이 있어야 합니다.
4. **어긋났을 때의 의미**: 토큰이 유출되거나, 후속 비밀번호 설정을 위한 상태 인계(Cookie 기반)가 실패했음을 의미합니다.

### H-2: `set-password` 완료 후 세션 발급 및 임시 쿠키 만료
1. OTP 인증 후 새 비밀번호 설정 화면에서 비밀번호를 입력하고 완료합니다.
2. Network 탭에서 `POST /api/community/auth/set-password` 요청을 확인합니다.
3. **기대 결과**:
   - Status: `200 OK`
   - Response Headers (`Set-Cookie` 확인):
     - `__Host-etf-campus-community-access` 및 `__Host-etf-campus-community-refresh` 세션 쿠키가 발급되어야 합니다.
     - `__Host-etf-campus-community-pwsetup` 쿠키가 `Max-Age=0` 또는 `Expires` 과거 시간으로 덮어씌워져 삭제(만료) 처리되어야 합니다.
4. **어긋났을 때의 의미**: 인증 세션이 발급되지 않거나, 소비된 임시 권한(pwsetup)이 남아있어 탈취에 의한 재사용 위험이 열려있음을 의미합니다.

### H-3: `set-password` 재요청 시 Rate Limit 방어 확인
1. 위 H-2 단계 직후, 이전에 사용된 pwsetup 쿠키 값을 강제로 복구하거나 브라우저 콘솔을 통해 동일한 `set-password` 요청을 재현(Replay)합니다.
2. **기대 결과**:
   - Status: `429 Too Many Requests`
   - 본문에 "너무 많은 요청입니다" 류의 에러 메시지가 반환되어야 합니다.
3. **어긋났을 때의 의미**: 한 번 사용된 OTP 인계 쿠키를 재사용할 수 있는 Replay Attack(토큰 탈취 후 재사용) 방어가 뚫렸음을 의미합니다.

### H-4: `rememberMe: false` 조건 시 Refresh 쿠키 속성
1. 로그인(또는 OTP 발송) 시 '로그인 유지' (Remember Me) 체크박스를 **해제**하고 인증을 진행합니다.
2. 세션 쿠키가 발급되는 `verify-otp` 또는 `set-password`의 `Set-Cookie` 응답 헤더를 확인합니다.
3. **기대 결과**:
   - `__Host-etf-campus-community-refresh` 쿠키에 `Max-Age`나 `Expires` 속성이 **없어야** 합니다 (Session 쿠키로 동작하여 브라우저 종료 시 소멸).
4. **어긋났을 때의 의미**: 공용 PC 등에서 브라우저를 닫아도 세션이 영구 유지되는 보안 취약점이 발생합니다.

### H-5: 전 기기 로그아웃 동기화 (Global Sign Out)
1. 브라우저 A(예: Chrome)와 브라우저 B(예: Edge 또는 시크릿 창) 양쪽에서 동일한 테스트 계정으로 로그인합니다.
2. 브라우저 A에서 **비밀번호 재설정** (또는 로그아웃)을 수행합니다.
3. 브라우저 B에서 커뮤니티에 **새 글쓰기**를 시도합니다.
4. **기대 결과**:
   - 브라우저 B의 글쓰기 요청이 `401 AUTH_REQUIRED`로 실패하고, 재로그인 화면으로 강제 이동되어야 합니다.
5. **어긋났을 때의 의미**: 비밀번호가 변경되었음에도 기존에 발급된 세션(Refresh Token 등)이 무효화되지 않아 세션 탈취자가 계속 활동할 수 있는 위험이 있습니다.