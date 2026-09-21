# ETF Campus 리드 대기자(Waitlist) 운영 정책 및 배포 실행 계획

**문서 버전**: 1.0.0  
**기준 일자**: 2026-09-21  
**대상 서비스**: ETF 비용 및 계좌별 규칙 자가 점검 교육 가이드 대기자 알림  

---

## 1. 대기자 수집 목적 및 동의 범위 격리 (Scope & Consent Isolation)

1. **수집 목적의 한정**:
   - 본 대기자 수집(`campaign: challenge_guide_2026`)은 **"ETF 실부담비용 및 계좌별 규칙 자가 점검 교육 가이드 및 브라우저 체크리스트 무료 출시 알림"**에 한정됩니다.
2. **마케팅·뉴스레터 자동 확대 절대 금지 (Zero Cross-Pollination)**:
   - 본 알림 수신 동의는 플랫폼의 일반 마케팅 광고, 상업적 프로모션, 정기 데일리 뉴스레터 수신으로 **자동 확대되거나 강제 전환되지 않습니다**.
   - 차후 정기 뉴스레터나 마케팅 정보를 수신하려면 별도의 명시적 선택 동의(`marketing_optional`) 절차를 거쳐야 합니다.

---

## 2. 접수 및 발송 운영 정책 (Operations)

### 2.1 접수 안내 메일 발송 수단
- **현재 검증 환경**: n8n 자동화 워크플로 및 Cloudflare Email Workers 기반 테스트 파이프라인.
- **프로덕션 발송 수단**: **`[미확정: 운영자 의사결정 필요]`**
  - 후보 1: Resend API (높은 도달률, 템플릿 제어 용이)
  - 후보 2: n8n + 온프레미스 SMTP / Gmail Relay
  - 확정 전제: 발송 공식 도메인(`noreply@etfcampus.kr`)에 대한 SPF, DKIM, DMARC 인증 설정 완료 후 최종 확정.

### 2.2 수신 동의 철회 창구 (Withdrawal Channel)
- **공식 철회 접수 메일**: `etfcampus@gmail.com`
- **철회 안내 표기**: 출시 알림 모달 입력 폼 및 접수 완료 화면에 명시.
- **운영자 처리 절차**:
  1. 철회 요청 메일 접수 시 24시간 이내에 Cloudflare D1 `lead_waitlist`에서 상태를 철회(`status = 'withdrawn'`)로 갱신:
     ```sql
     UPDATE lead_waitlist 
     SET status = 'withdrawn', updated_at = datetime('now') 
     WHERE email = ? AND campaign = 'challenge_guide_2026';
     ```
  2. 철회 처리 완료 즉시 신청자에게 확인 회신 메일 발송.
  3. 향후 가이드 배포 쿼리(`WHERE status = 'pending'`)에서 원천 배제.

### 2.3 명단 보관 및 파기 시점 (Retention & Disposal Triggers)
개인정보 보호법 제21조(개인정보의 파기)에 따라 목적 달성 시 복구 불가능한 방법으로 영구 파기합니다:
1. **정상 출시 시**:
   - 가이드 출시 알림 발송 완료(`status = 'sent'`) 후 **`[미확정: 운영자 의사결정 필요 — 발송 완료 30일 후 vs 즉시 파기]`** 내 DB 행 완전 물리적 삭제(`DELETE`).
2. **출시 지연 시**:
   - 당초 예정일 대비 출시가 지연될 경우, 사유 및 예상 일정을 담은 안내 메일을 1회 발송하고 대기 지속 여부를 확인.
   - 대기 유지를 원하지 않는 신청자는 즉시 파기.
   - 최대 지연 유예 기간 90일 경과 시 전원 자동 파기.
3. **프로젝트 취소/중단 시**:
   - 가이드 제작이 취소되거나 프로젝트가 중단되는 경우, 취소 결정 즉시 전원 영구 삭제 (`DELETE FROM lead_waitlist WHERE campaign = 'challenge_guide_2026'`).

---

## 3. D1 배포 실행 계획 (Deployment Execution Plan)

### 3.1 배포 대상 인프라
- **대상 DB**: Cloudflare D1 `ETF_PRICES`
- **Database ID**: `11c4e874-fba2-4e34-91d0-808892284c86`
- **Binding Name**: `env.ETF_PRICES`
- **호스팅 플랫폼**: Cloudflare Pages (`etf-campus.pages.dev`)

### 3.2 미적용 마이그레이션 목록 (Wrangler D1 Migrations)
1. `migrations/0027_lead_waitlist.sql` (대기자 기초 테이블 생성)
2. `migrations/0028_lead_waitlist_hardening.sql` (캠페인 격리, 동의 버전/시각, 레이트 리밋 테이블, 멱등 복합 인덱스)

### 3.3 단계별 배포 순서 (Deployment Sequence)
1. **사전 검증**:
   - 로컬 테스트 전량 통과 검증: `npm test` (96개 테스트 파일, 590+ 테스트)
   - 정적 타입 체크: `npx tsc --noEmit` (0 에러)
   - 린트 검증: `npm run lint` (0 에러)
2. **코드 병합**:
   - 작업 브랜치(`fix/oauth-unauth-start-and-captcha-stabilization`) 커밋 및 원격 푸시.
   - Main 브랜치 병합 PR 생성 및 승인 병합.
3. **원격 D1 마이그레이션 적용**:
   - Main 브랜치 최신 상태에서 명령어 실행:
     ```bash
     npx wrangler d1 migrations apply ETF_PRICES --remote
     ```
   - 적용 후 테이블 및 인덱스 상태 실측:
     ```bash
     npx wrangler d1 execute ETF_PRICES --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%lead%'"
     ```
4. **Cloudflare Pages 프로덕션 배포 확인**:
   - GitHub Actions 또는 Cloudflare Pages 빌드 파이프라인 정상 완료 확인 (`gh run list -L 3`).
5. **프로덕션 헬스체크**:
   - 실제 페이지 접속 후 브라우저 콘솔 및 모달 폼 정상 작동 확인.

### 3.4 롤백 절차 (Rollback Plan)
- **D1 스키마 롤백**:
  - 만약 마이그레이션 실행 중 예외가 발생하거나 비정상 동작 시:
    `migrations/0028_lead_waitlist_hardening.sql`의 역작업 수행 (인덱스 제거 및 필요 시 테이블 삭제) 또는 Cloudflare D1 Time Travel 백업 시점 복구:
    ```bash
    npx wrangler d1 time-travel restore ETF_PRICES --bookmark <bookmark-id>
    ```
- **Pages 웹 애플리케이션 롤백**:
  - 배포 즉시 오류 발생 시 Cloudflare Pages 관리자 콘솔에서 직전 정상 배포 버전으로 1클릭 롤백(Instant Rollback) 실행.
