# Antigravity 후속 지시문 (Round 4) — 브랜치 최신화와 머지 게이트

작성일 2026-08-20 · 대상 브랜치 `fix/community-auth-hardening` · PR #13
선행 문서: `..._Fixes_20260820.md`, `..._Round2_20260820.md`, `..._Round3_20260820.md`

---

# 0. Round 3 검증 결과 — 4건 모두 통과

실제 소스로 대조했습니다. **지적한 4건이 전부 정확히 처리됐습니다.**

| 항목 | 확인 |
| --- | --- |
| R3-1 `search_path` 원복 | `current_community_role`·`bootstrap_community_profile` 모두 `set search_path = public`. 줄바꿈 정규화 후 원본 `20260815000001_community_phase2.sql`과 **완전 동일**. `create_community_post`·`update_community_post`는 원본대로 `''` 유지 ✅ |
| R3-2 구조화 오류 | `communityFetch`가 `status`·`code`·`body`를 Error에 실어 던지고, 클라이언트가 `error.body?.passwordChanged === true`로 분기. 한글 문구 매칭 2줄 제거됨 ✅ |
| R3-3 보안 헤더 | `new Response` → `jsonResponse`로 교체, `Cache-Control: no-store`·`X-Content-Type-Options: nosniff` 보장 ✅ |
| R3-4 사본 제거 | 두 테스트 파일에서 `encodeBase64Url`/`decodeBase64Url` 사본이 **0개**. `set-password.test.ts`는 실제 `passwordSetupHeaders`로 쿠키를 만들어 `Set-Cookie`에서 추출해 사용 ✅ |
| PR·walkthrough | PR #13 생성, `docs/community/walkthrough.md`로 이동 ✅ |
| E2E 미확보 보고 | Option B를 선택하고 "미확보"라고 정직하게 기재 ✅ — 이게 맞는 처리입니다 |

**코드는 머지 가능한 상태입니다.** 남은 것은 브랜치 상태 문제 하나와 게이트 항목들입니다.

# 1. R4-1 (Blocking) — `npm run lint`가 실패하고 있습니다

리포트는 lint 결과를 이렇게 설명했습니다.

> *(이번 PR에 포함되지 않은 `origin/main`의 마켓 브리핑 파일 경고만 남았으며, 수정한 파일에는 에러가 없습니다.)*

그런데 붙여준 출력의 마지막 줄은 이렇습니다.

```
✖ 62 problems (6 errors, 56 warnings)
```

**errors가 6건입니다.** `eslint .`는 error가 하나라도 있으면 **exit code 1로 종료**합니다. 즉 `npm run lint`는 통과한 것이 아니라 **실패했습니다.** GitHub Actions에 lint 스텝이 있다면 PR #13은 지금 red 상태입니다.

warnings만 보여주고 errors 6건은 출력에서 잘려 있어 어느 파일인지 알 수 없습니다. **먼저 `npm run lint`를 다시 실행해 error 6건의 파일·규칙·라인을 그대로 제시하십시오.**

원인은 §2에 있습니다. 손으로 고치기 전에 §2를 먼저 읽으십시오.

# 2. R4-2 (High) — 브랜치가 `origin/main`보다 5커밋 뒤처져 있습니다

`git diff origin/main --stat`에 커뮤니티와 무관한 파일 3개가 들어 있었습니다.

```
 app/page.tsx                        |   9 +-
 components/screener/screener.tsx    |  11 +-
 components/site-header.tsx          |  31 +-
```

**이건 오염이 아니라 브랜치가 낡았다는 신호입니다.** 워크트리를 만든 뒤 `origin/main`이 5커밋 전진했습니다.

```
ee11222 fix(market): sync market indices date with ETF base date
2aa6a27 fix: resolve remaining lint errors on main          ← lint
5488c94 fix: lint errors blocking github actions            ← lint
1d7278a style: reposition stylechip and site navigation     ← site-header.tsx
e80aafa feat: implement DTO payload diet for screener       ← app/page.tsx, screener.tsx
```

**§1의 lint 실패가 여기서 설명됩니다.** `5488c94 fix: lint errors blocking github actions`가 `components/screener/screener.tsx`의 lint 에러를, `2aa6a27`이 `app/admin/market-briefings/editor/page.tsx`의 나머지를 이미 고쳤습니다. 우리 브랜치는 그 수정 **이전** 시점에서 갈라져 나왔으므로 옛 에러를 그대로 안고 있습니다.

**→ lint 에러를 손으로 고치지 마십시오. `origin/main`을 가져오면 사라집니다.**

## 해야 할 일

```bash
git fetch origin
git rebase origin/main        # 충돌 시 merge로 전환해도 무방합니다
```

우리 브랜치는 위 5커밋이 건드린 파일을 하나도 수정하지 않았으므로 **충돌이 없어야 정상**입니다. 충돌이 난다면 멈추고 어느 파일인지 보고하십시오.

rebase 후 `npm ci && npm test && npm run lint && npm run build`를 다시 돌리십시오. **lint가 exit 0으로 끝나는 것을 확인**하고 출력 마지막 줄을 제시하십시오.

## 격리 검증 방법을 바꾸십시오

낡은 브랜치에서 `git diff origin/main --stat`은 **격리 증명이 아닙니다.** main이 앞서간 만큼을 우리 변경인 것처럼 보여줍니다. 실제 PR diff는 merge base 기준으로 계산되므로 이것과 다릅니다.

rebase 전이라면 merge base 기준으로 보십시오.

```bash
git diff $(git merge-base origin/main HEAD) HEAD --stat
```

rebase 후에는 `git diff origin/main --stat`이 다시 정확해집니다.

## 마켓 브리핑 관련 지침 갱신

`2aa6a27`이 `app/admin/market-briefings/editor/page.tsx`를 수정했다는 것은 **마켓 브리핑 운영 콘솔이 이미 `origin/main`에 머지됐다**는 뜻입니다.

따라서 rebase 후 워킹트리에 `app/admin/`·`functions/api/admin/` 등이 나타나는 것은 **정상이며 오염이 아닙니다.** 이전 라운드의 "마켓 브리핑 파일을 PR에 넣지 마라"는 이제 이렇게 읽으십시오.

> rebase로 따라 들어온 main의 커밋은 그대로 두되, **이 브랜치에서 그 파일들을 새로 수정하지는 마십시오.** rebase 후 `git diff origin/main --stat`에 커뮤니티 인증·마이그레이션·테스트 외의 파일이 남아 있으면 안 됩니다.

# 3. R4-3 (High) — `.dev.vars`가 gitignore에 없습니다

`.gitignore` 6행에 `.env*`가 있습니다. 그런데 Wrangler의 로컬 시크릿 파일 이름은 **`.dev.vars`**이고, 이 패턴은 `.env*`에 **매칭되지 않습니다.**

Round 3에서 제가 `.dev.vars`에 Preview 자격증명을 넣는 방안을 제시했는데, 지금 상태로 그 파일을 만들면 **`git add .`에 그대로 딸려 들어가 Supabase 키와 Turnstile 시크릿이 저장소에 커밋됩니다.**

**먼저 `.gitignore`에 아래를 추가하십시오. 이건 어떤 자격증명을 만들기 전에 해야 합니다.**

```
.dev.vars
.dev.vars.*
```

이미 `.dev.vars`가 존재한다면 `git ls-files .dev.vars`로 추적 여부를 확인하고, 추적 중이면 **먼저 히스토리 노출 여부를 보고**한 뒤 지시를 기다리십시오. 임의로 이력을 다시 쓰지 마십시오.

# 4. R4-4 (Medium) — `git add .`를 쓰지 마십시오

Round 3에서 `git add . ; git commit` 을 두 번 실행했습니다. 이번엔 결과적으로 문제가 없었지만, 이 저장소에는 이전 에이전트들이 남긴 스크래치 파일(`msg0.txt`, `script.py`, `test.txt`, `scratch/` 등)이 흔히 굴러다니고 `.dev.vars` 위험도 방금 확인됐습니다.

**변경한 파일을 경로로 명시해 스테이징하십시오.** 커밋 전 `git status --porcelain`을 확인하고, 의도하지 않은 항목이 있으면 커밋하지 말고 보고하십시오.

# 5. 머지 전 남은 게이트

## 5.1 Preview E2E — Option B의 후속

Round 3에서 로컬 E2E 미확보를 정직하게 보고한 것은 올바른 처리였습니다. 이제 그 계획을 실행할 차례입니다.

Preview 배포 후 **canonical preview 도메인**에서 아래 5개를 실제로 확보하십시오. Raw Pages deployment URL은 Turnstile expected hostname과 맞지 않아 실패하는 것이 정상이므로, 통과시키려고 hostname 검증을 약화하지 마십시오.

| # | 확인 |
| --- | --- |
| 1 | `verify-otp` 200 — 본문에 토큰 문자열 없음, `Set-Cookie`에 pwsetup 쿠키, `X-Community-CSRF` 헤더 존재 |
| 2 | `set-password` 200 — 세션 쿠키 발급, pwsetup 쿠키 `Max-Age=0`으로 만료 |
| 3 | 동일 pwsetup 쿠키로 재요청 → 429 |
| 4 | CSRF 헤더 없이 `set-password` → 403 |
| 5 | `rememberMe:false`로 시작한 흐름 → refresh 쿠키에 `Max-Age` 부재 |

추가로 **전 기기 로그아웃**을 눈으로 확인하십시오: 브라우저 A·B 두 곳에서 로그인 → A에서 비밀번호 재설정 → B에서 글쓰기 시도 시 재로그인 요구.

**토큰·쿠키 값은 앞 8자만 남기고 마스킹**하십시오. 테스트는 전용 계정으로 하고 끝나면 계정·게시물을 정리하십시오.

## 5.2 Production 마이그레이션 — 승인 없이 실행 금지

`20260820000001_community_function_qualification_fix.sql`은 Production DB를 바꿉니다. **운영자의 명시적 승인 전에는 적용하지 마십시오.**

승인 요청 시 함께 제시할 것:
- 이 마이그레이션이 `create or replace`만 사용해 멱등이라는 근거
- 적용 전 Production에서 확인할 쿼리와 그 결과
  ```sql
  select version, name from supabase_migrations.schema_migrations
   where version like '20260815%' order by version;

  select p.proname, pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('create_community_post','update_community_post',
                       'current_community_role','bootstrap_community_profile');
  ```
  → 함수 본문이 이미 `public.community_categories.slug = ...` 형태로 한정돼 있으면 이 마이그레이션은 no-op입니다. 한정이 없으면 정정이 실제로 필요한 상태입니다. **어느 쪽인지 확인해 보고하십시오.**
- 롤백 절차

## 5.3 최종 리포트

1. rebase 후 `git log --oneline origin/main..HEAD` (우리 커밋만 나와야 함)
2. rebase 후 `git diff origin/main --stat` 전체
3. `npm test` / `npm run lint` / `npm run build` 각각의 마지막 줄 — **lint는 exit 0이어야 합니다**
4. lint error 6건이 rebase로 해소됐는지, 아니면 별도 수정이 필요했는지
5. §3의 `.gitignore` 조치 결과와 `git ls-files .dev.vars` 출력
6. Preview E2E 5개 결과 (마스킹 적용). 미확보 항목은 이유와 함께 그대로 기재
7. 마이그레이션 사전 조회 결과와 승인 요청

# 6. 변경하지 말 것

- Round 1~3에서 통과한 항목의 설계를 되돌리지 마십시오
- 기존 테스트를 삭제·skip·완화하지 마십시오
- lint error를 브랜치에서 손으로 고치기 전에 **반드시 rebase를 먼저** 하십시오 — main이 이미 고친 것을 중복 수정하면 충돌만 만듭니다
- `ETF_PRICES` D1, ETF 데이터 수집·정적 빌드·배포 파이프라인을 건드리지 마십시오
- 비밀값을 코드·로그·테스트 fixture·리포트에 노출하지 마십시오
- 이번 범위 밖 백로그(Turnstile 메시지 일반화, 비밀번호 정책 강화, pg_cron 증빙, mojibake 전수 점검)를 손대지 마십시오
- 소스·SQL 파일 생성·수정에 PowerShell 인라인 문자열을 쓰지 마십시오
- 리포트는 실제 수행한 명령·결과와 일치해야 합니다. 실패한 것을 통과로 적지 마십시오 — §1이 그 사례입니다
- 확신이 서지 않으면 임의 결정하지 말고 **멈추고 질문**하십시오
