# ETF Campus 리드 대기자(Waitlist) 운영 정책 및 배포·롤백 실행 매뉴얼

**문서 버전**: 2.1.0  
**기준 일자**: 2026-09-21  
**대상 서비스**: ETF 비용 및 계좌별 규칙 자가 점검 교육 가이드 대기자 알림 (`campaign: challenge_guide_2026`)  
**원칙**: Zero-Hallucination, 개인정보 최소화(Privacy-by-Design), Fail-Closed, 지체 없는 즉시 파기, 운영자 확정 중심의 현실적 배포/롤백  

---

## 1. 대기자 수집 목적 및 동의 범위 격리 (Scope & Consent Isolation)

1. **수집 목적의 한정 (개인정보 보호법 제15조 준수)**:
   - 본 대기자 수집(`campaign: challenge_guide_2026`)은 **"ETF 실부담비용 및 계좌별 규칙 자가 점검 교육 가이드 및 브라우저 체크리스트 무료 출시 1회성 알림"**에 엄격히 한정됩니다.
2. **마케팅·뉴스레터 자동 확대 절대 금지 (Zero Cross-Pollination)**:
   - 본 알림 수신 동의는 플랫폼의 일반 마케팅 광고, 상업적 프로모션, 정기 데일리 뉴스레터 수신으로 **자동 확대되거나 강제 전환되지 않습니다**.
   - 차후 정기 뉴스레터나 마케팅 정보를 수신하려면 별도의 명시적 선택 동의(`marketing_optional`) 절차를 거쳐야 합니다.
3. **발송 완료자(`status = 'sent'`)의 신청 범위 및 상태 엄격 보호**:
   - 1차 가이드 출시 알림이 발송 완료된 신청자(`status = 'sent'`)가 웹사이트에서 동일 이메일로 다시 신청하더라도, **후속 판본(v2 등)이나 타 캠페인 발송 대기로 상태가 `'pending'`으로 자동 확장되지 않습니다**.
   - **화면(UI)**: 일반 신규 접수 완료 화면이 아닌 **"가이드 발송 완료 안내" 화면(`alreadySent: true`)**을 명확히 구분 표시하여 기존 발송 내역과 고객센터 문의처(`neo.alpharesearch@gmail.com`)를 안내합니다.
   - **서버 및 SQL**: API 계층의 1차 검사뿐 아니라, DB 저장 SQL 레벨에서도 `status = CASE WHEN lead_waitlist.status = 'sent' THEN 'sent' ELSE 'pending' END` 방어식을 적용하여 경쟁 상태에서도 발송 완료 상태가 `'pending'`으로 덮어써지지 않도록 이중 보호합니다.

---

## 2. 개인정보 지체 없는 파기 및 수신 동의 철회 정책 (Retention & Immediate Disposal)

본 교육 가이드 사전 알림은 상거래 계약이나 금융투자상품 거래가 아닌 단순 1회성 무료 알림 서비스이므로, 전자상거래법 등 5년 보존 근거가 없습니다. 따라서 **분쟁 예방을 명목으로 철회자 명단을 계속 보관하지 않으며, 별도 보존 근거가 없는 데이터는 지체 없이 물리적 영구 파기(DELETE)**합니다.

### 2.1 수신 동의 철회 및 파기 창구 (Withdrawal Channel)
- **공식 접수 창구**: `neo.alpharesearch@gmail.com`
- **화면 표기**: 출시 알림 모달 입력 폼의 동의 박스 및 접수 완료/발송 완료 화면에 명시.
- **운영자 처리 절차 (24시간 이내 내부 목표)**:
  1. 철회 또는 삭제 요청 메일 접수 시 24시간 이내에 Cloudflare D1 `lead_waitlist`에서 지체 없이 즉시 물리적 삭제(`DELETE`) 집행:
     ```sql
     DELETE FROM lead_waitlist 
     WHERE email = ? AND campaign = 'challenge_guide_2026';
     ```
  2. 파기 완료 후 신청자에게 확인 회신 발송.
  3. 원장에서 영구 소멸되므로 향후 발송 쿼리에서 원천 배제되며, 정보주체가 차후 재신청할 경우 신규 1행으로 등록됩니다.

### 2.2 목적 달성 후 지체 없는 파기
1. **가이드 발송 완료 후**:
   - 가이드 출시 알림 발송 완료(`status = 'sent'`) 후 반송 처리 확인(최대 7일 이내)이 완료되는 즉시, 보존 근거가 없으므로 D1 원장에서 전원 지체 없이 물리적 삭제(`DELETE FROM lead_waitlist WHERE campaign = 'challenge_guide_2026'`)합니다.
2. **출시 지연 및 프로젝트 중단 시**:
   - 출시가 장기 지연되거나 프로젝트가 중단되는 경우, 취소 결정 즉시 전원 수동 영구 삭제를 집행합니다.

---

## 3. 서버 비밀키 기반 속도 제한 및 키 보유·삭제 절차 (Rate Limiting Security)

### 3.1 서버 비밀키 기반 HMAC-SHA-256 해시
- 고정된 공개 솔트를 배제하고, Cloudflare 환경 변수로 주입되는 서버 비밀키(`LEAD_RATE_LIMIT_SECRET` 또는 `AUTH_SECRET`)를 기반으로 HMAC-SHA-256 단방향 해시 키(`rl_ip_<hash>`, `rl_em_<hash>`)를 생성합니다.
- `lead_rate_limits` 테이블에는 원문 IP나 이메일이 평문으로 절대 저장되지 않습니다.

### 3.2 만료 데이터 및 키 삭제 절차 (Key Retention & Disposal)
1. **만료 레코드 정기 수동 정리 (최소 주 1회)**:
   - 윈도우가 만료된 레코드(`reset_at < now`)는 운영자가 최소 주 1회 아래 명령으로 D1 원장에서 정리합니다:
     ```bash
     npx wrangler d1 execute ETF_PRICES --remote --command "DELETE FROM lead_rate_limits WHERE reset_at < strftime('%s', 'now')"
     ```
2. **서버 비밀키 로테이션 시 폐기 절차**:
   - 서버 비밀키(`LEAD_RATE_LIMIT_SECRET`)를 갱신/교체할 경우, 기존 해시 키와 신규 해시 키의 불일치로 인한 오작동을 방지하기 위해 반드시 기존 속도 제한 테이블 데이터를 일괄 초기화합니다:
     ```bash
     npx wrangler d1 execute ETF_PRICES --remote --command "DELETE FROM lead_rate_limits"
     ```

---

## 4. 운영자 최종 확인표 (Operator Decision Matrix)

아래 항목은 운영자 결정 권고안을 바탕으로 현재 확인된 시스템 상태와 확정 대기 항목을 정리한 최종 확정표입니다:

| 항목 | 현재 확인된 상태 (As-Is) | 운영자 결정 권고안 (To-Be) | 확정 상태 및 조치 사항 |
| :--- | :--- | :--- | :--- |
| **메일 발송 시스템** | `neo.alpharesearch@gmail.com`<br>(Gmail SMTP SSL 465, OSMU 가동 중) | **Resend 트랜잭셔널 API 우선**<br>(대량 발송 한도 회피, Webhook 추적) | ⏳ **[운영자 최종 확인 대기]**<br>초기 100건 이하 파일럿은 기존 Gmail SMTP 즉시 사용 가능, 정식 배포 전 Resend API 키 발급 여부 확인 |
| **발송 도메인 소유** | `etf-campus.pages.dev` 운영 중<br>(커스텀 도메인 미확정) | `etfcampus.kr` 또는 `etfcampus.pages.dev`<br>(SPF / DKIM / DMARC 설정 필요) | ⏳ **[운영자 최종 확인 대기]**<br>공식 도메인 DNS 레코드 인증 완료 전까지는 기존 `neo.alpharesearch@gmail.com` 명의로 발송 |
| **철회 및 CS 창구** | `neo.alpharesearch@gmail.com` 운영 중 | `neo.alpharesearch@gmail.com`<br>(일원화된 공식 창구) | ✅ **[확정 반영 완료]**<br>화면, 약관, API 응답 문구에 `neo.alpharesearch@gmail.com` 일원화 적용 |
| **철회 처리 내부 목표** | 수동 접수 및 D1 명령 실행 | **접수 후 24시간 이내 D1 DELETE 집행** | ✅ **[운영 방침 수립]**<br>영업일 기준 24시간 이내 즉시 물리적 삭제 원칙 수립 |
| **목적 달성 후 파기** | 별도 보존 근거 없음 | **가이드 발송 완료 후 지체 없이 영구 파기** | ✅ **[운영 방침 수립]**<br>분쟁 예방 명목 보관 폐지, 발송 직후 원장 일괄 삭제 |
| **속도 제한 데이터 정리**| D1 수동 쿼리 실행 | **최소 주 1회 정기 수동 정리 집행** | ✅ **[운영 방침 수립]**<br>`reset_at < now` 조건으로 주간 단위 D1 삭제 집행 |

---

## 5. 접수 차단 방법 및 가짜 성공 API 복귀 금지 (Ingress Shutoff & Fail-Closed)

### 5.1 접수 차단 방법 (Ingress Shutoff Mechanism)
장애 발생, 대기자 모집 종료, 또는 보안 점검 시 접수를 즉각 차단하는 절차는 다음과 같습니다:

1. **프론트엔드 레벨 즉각 차단**:
   - `components/learning/challenge-bridge-banner.tsx`의 '출시 알림 신청하기' 버튼을 '사전 알림 마감'으로 텍스트 변경하고 `disabled` 처리하거나, 배너를 비활성화합니다.
2. **API 레벨 즉각 차단 (Cloudflare Pages Functions)**:
   - `functions/api/lead/waitlist.ts` 최상단에 차단 플래그(`MAINTENANCE_MODE = true`)를 적용하여 호출 시 즉시 503을 반환합니다:
     ```ts
     return errorResponse(503, "UNAVAILABLE", "대기자 알림 신청 접수가 일시 마감되었습니다.");
     ```

### 5.2 가짜 성공 API 복귀 금지 (Strict Fail-Closed Recovery Path)
- **과거 결함 영구 배제**: "DB 연결 누락/테이블 미적용/저장 실패 시에도 사용자에게 접수 완료(200) 화면을 띄워주는 가짜 성공" 구현을 영구 금지합니다.
- **엄격한 정상 복구 경로**:
  - 오직 D1 원장에 `result.success === true`로 확정 기록된 경우에만 `201 Created`를 반환합니다.
  - DB 또는 레이트 리밋 저장소 장애 시에는 반드시 `503 UNAVAILABLE` 또는 `500 UNAVAILABLE`로 실패를 정직하게 알리고, 사용자 입력값(이메일, 관심사)을 보존하여 복구 후 즉시 재시도할 수 있도록 지원합니다.

---

## 6. 배포 직전 원격 D1 상태 확인 (D1 Pre-Deployment Audit)

- **출처 문서**: `functions/api/lead/__tests__/fixtures/d1-remote-observation.json`
- **대상 데이터베이스**: Cloudflare D1 `ETF_PRICES` (`11c4e874-fba2-4e34-91d0-808892284c86`, APAC/ICN)
- **현재 원격 적용 상태**: `0001` ~ `0026_correct_migration_baselines_0024.sql` 완료.
- **적용 대기 마이그레이션**:
  1. `migrations/0027_lead_waitlist.sql` (기초 대기자 테이블 생성)
  2. `migrations/0028_lead_waitlist_hardening.sql` (캠페인 격리, 동의 버전/시각, 레이트 리밋 테이블, 멱등 복합 인덱스, FM-011 행수 감사)
- **실측 테이블 조회 결과**: `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%lead%'` -> `[]` (대기자 관련 테이블 0건 실측 확인 완료).
- **배포 실행 순서**: **선 D1 마이그레이션 적용 -> 후 Pages 애플리케이션 배포** 원칙 엄수.

---

## 7. 실제 모바일 화면 검증 내역 (Mobile A11y & Viewport Audit)

| 점검 항목 | 기준 규격 | 모달 적용 현황 | 검증 결과 |
| :--- | :--- | :--- | :--- |
| **모바일 뷰포트 대응** | 360px, 390px, 430px 너비 | `p-3 sm:p-4`, `max-w-lg` 가변 폭 | ✅ 패딩 및 마진 완벽 정렬, 모바일 잘림 없음 |
| **터치 타깃 최소 크기** | 최소 44x44px 이상 | 닫기(44x44), 확인(44px), 관심사(44px), 제출(44px) | ✅ 전 인터랙션 버튼 `min-h-[44px]` 확보 |
| **iOS 자동 줌 방지** | 폰트 크기 16px 이상 | 이메일 input: `text-base sm:text-sm` (16px) | ✅ 모바일 Safari 포커스 시 브라우저 화면 강제 확대 차단 |
| **키보드 가림 방지** | 가상 키보드 스크롤 | 모달 카드 `max-h-[90vh] overflow-y-auto` | ✅ 키보드 노출 시 내부 독립 스크롤로 버튼 조작 보장 |
| **화면 분기 렌더링** | 신규 접수 vs 기존 발송완료 | `alreadySent: true` 시 앰버 톤 발송 완료 화면 전환 | ✅ 기존 신청자 오인 방지 및 고객센터 안내 노출 |
| **접근성 포커스 제어** | WAI-ARIA Dialog 패턴 | Escape 닫기, Focus Trap, 완료 헤딩 포커스 이동 | ✅ 키보드 및 스크린 리더 100% 대응 |
