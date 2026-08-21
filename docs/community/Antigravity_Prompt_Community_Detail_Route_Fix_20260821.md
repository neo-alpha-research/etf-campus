# Antigravity 작업 지시문 — 커뮤니티 상세 페이지 404 수정 (별도 PR)

작성일 2026-08-21 · **PR #13(`fix/community-auth-hardening`)과 분리된 새 PR입니다**

---

# 0. 배경 — 지금 커뮤니티는 글을 열어볼 수 없습니다

`https://etf-campus.pages.dev/community/` 는 정상 동작합니다. 카테고리 탭이 뜨고 `GET /api/community/posts`도 200을 반환합니다. **그런데 게시물 상세 페이지에 도달할 수 없습니다.**

## 실측 결과

```
GET https://etf-campus.pages.dev/community/00000000-0000-0000-0000-000000000000/
→ HTTP 404
```

## 원인

`next.config.ts`가 `output: "export"`라서 `app/community/[slug]/` 동적 라우트가 존재하지 않습니다. 빌드 산출물은 이것뿐입니다.

```
out/community/
├── index.html      → /community/
├── read/           → /community/read/
└── write/          → /community/write/
```

그런데 **코드 세 곳이 아직 없어진 동적 라우트를 가리키고 있습니다.**

| # | 파일·행 | 현재 코드 | 결과 |
| --- | --- | --- | --- |
| A | `components/community/community-feed.tsx:122` | `href={\`/community/${post.slug}/\`}` | 목록에서 글 클릭 → **404** |
| B | `components/community/community-composer.tsx:57` | `window.location.assign(\`/community/${result.post.slug}/\`)` | **글을 쓰고 등록하면 즉시 404** |
| C | `components/community/community-post-detail.tsx:34` | `window.location.pathname.split("/").filter(Boolean).at(-1)` | 경로 마지막 조각을 slug로 읽음 → `/community/read/`로 들어오면 slug가 `"read"`가 됨 |

`app/community/read/page.tsx`는 이미 `CommunityPostDetail`을 렌더링하도록 만들어져 있습니다. **의도했던 구조는 정적 라우트 + 쿼리 파라미터인데, 링크와 slug 파싱만 옛 구조로 남아 있는 상태입니다.**

게시물이 0건이라 아무도 밟지 않았을 뿐, 회원이 글을 쓰는 순간 바로 드러납니다.

# 1. 작업 범위

**이 PR은 위 404 수정과 §3의 문구 정리만 담습니다.** 인증 보안 수정(PR #13)과 섞지 마십시오.

## 브랜치

PR #13은 Production 마이그레이션 승인을 기다리는 중이므로, 이 수정은 **`origin/main`에서 갈라진 별도 브랜치**로 먼저 머지해 실사용을 엽니다.

```bash
cd D:\ETFCampus
git fetch origin
git worktree add ../etf-campus-detail-route -b fix/community-post-detail-route origin/main
cd ../etf-campus-detail-route
npm ci
```

`git status`가 깨끗하고 `git log --oneline -1`이 `origin/main`과 같은지 확인한 뒤 시작하십시오.

> `D:\ETFCampus`의 워킹트리에는 마켓 브리핑 관련 미커밋 변경이 남아 있을 수 있습니다. `git worktree`를 쓰는 이유가 그것이니 `git checkout -b`로 대체하지 마십시오.

# 2. 수정 내용

## 2.1 URL 규약 확정

게시물 상세의 정규 URL을 **`/community/read/?slug=<uuid>`** 로 통일합니다. `output: "export"` 제약 아래 프로젝트가 이미 채택한 방식(정적 라우트 + 쿼리 파라미터)과 일치합니다.

## 2.2 A — 목록 링크

`components/community/community-feed.tsx` 122행

```tsx
href={`/community/${post.slug}/`}
```
→
```tsx
href={`/community/read/?slug=${encodeURIComponent(post.slug)}`}
```

## 2.3 B — 작성 완료 후 이동

`components/community/community-composer.tsx` 57행

```tsx
window.location.assign(`/community/${result.post.slug}/`);
```
→
```tsx
window.location.assign(`/community/read/?slug=${encodeURIComponent(result.post.slug)}`);
```

## 2.4 C — slug 파싱

`components/community/community-post-detail.tsx` 34행이 경로에서 읽는 방식을 **쿼리 파라미터**로 바꾸십시오.

```tsx
const slug = useMemo(() => typeof window === "undefined" ? "" :
  window.location.pathname.split("/").filter(Boolean).at(-1) ?? "", []);
```

**두 가지를 함께 고쳐야 합니다.**

1. **`?slug=`에서 읽기**
2. **의존성 배열이 `[]`라 마운트 시 한 번만 계산됩니다.** 지금은 글마다 경로가 달라 새 페이지로 취급됐지만, 앞으로는 상세 → 상세 이동이 **같은 라우트에서 쿼리만 바뀌는 클라이언트 내비게이션**이 됩니다. 이대로 두면 다른 글을 눌러도 이전 글이 그대로 보입니다.

Next.js `useSearchParams()`를 쓰는 것이 정석입니다. **다만 `output: "export"`에서는 `useSearchParams()`를 쓰는 컴포넌트가 `<Suspense>` 경계 안에 있어야 빌드가 통과합니다.** `app/community/read/page.tsx`에서 `<CommunityPostDetail />`을 `<Suspense fallback={...}>`으로 감싸십시오.

`useSearchParams()` 도입이 부담되면 `window.location.search`를 읽되 의존성 문제를 반드시 해결하십시오. 어느 쪽을 택했는지 근거와 함께 보고하십시오.

## 2.5 slug 없음 / 잘못된 slug 처리

`/community/read/` 를 slug 없이 열었을 때(북마크·직접 진입) **에러 화면이나 무한 로딩이 아니라** "게시물을 찾을 수 없습니다" 안내와 목록으로 돌아가는 링크를 보여주십시오. 삭제된 글의 slug로 들어온 경우도 같습니다.

## 2.6 삭제 후 이동은 그대로 둡니다

`community-post-detail.tsx:120`의 `window.location.assign("/community/")`는 목록으로 가는 것이 맞습니다. 건드리지 마십시오.

# 3. 운영 공지 문구에서 "신고" 제거 — 운영자 결정 완료

`components/community/community-feed.tsx` 108행 배너에 이렇게 쓰여 있습니다.

> 게시물은 공개로 읽을 수 있으며, 작성·댓글·**신고**는 이메일 인증 회원만 가능합니다.

**그런데 신고 기능은 코드에 존재하지 않습니다.** 신고 API도, RPC도, 버튼도 없습니다. 사용자에게 없는 기능을 안내하고 있습니다.

**운영자 결정**: 지금 단계에서는 신고 기능을 구현하지 않고 **문구에서 제거**합니다. 문제 게시물은 이메일로 접수합니다.

수정 방향:

- 배너에서 "작성·댓글·신고는" → "작성·댓글은"
- 같은 배너에 문제 게시물 접수 경로를 한 문장으로 안내하십시오. 접수용 이메일 주소는 **운영자에게 확인한 뒤** 넣으십시오. **임의의 주소를 지어내지 마십시오.** 확인 전이라면 문구만 제거하고, 접수 안내는 주소 확인 후 추가하겠다고 보고하십시오.

> `docs/community/01_product_spec.md`·`02_operations_enforcement_policy.md`에는 신고 접수·처리 절차가 상세히 설계돼 있습니다. **이 문서들은 수정하지 마십시오.** 향후 구현 시의 설계 문서이며, 지금 지우면 설계가 사라집니다. 대신 `docs/community/06_ssot_decision_log.md`에 "신고 기능은 Phase 3 이후로 유예, 초기에는 이메일 접수" 취지의 결정 항목을 한 줄 추가하십시오.

# 4. 테스트

## 4.1 필수 신규 테스트

| # | 검증 |
| --- | --- |
| D-1 | 목록의 게시물 링크 `href`가 `/community/read/?slug=<slug>` 형태이고 `/community/<slug>/` 형태가 **아님** |
| D-2 | 글 등록 성공 시 이동 대상이 `/community/read/?slug=<새 글 slug>` |
| D-3 | `?slug=abc`로 진입하면 `/api/community/posts/abc`를 호출 (경로 마지막 조각을 쓰지 않음) |
| D-4 | slug 없이 진입하면 API를 호출하지 않고 "찾을 수 없음" 안내를 렌더링 |
| D-5 | 배너 문구에 "신고" 문자열 부재 |

`components/community/__tests__/`의 기존 패턴(`@testing-library/react`)을 따르십시오. 기존 테스트를 삭제·skip·완화하지 마십시오.

## 4.2 빌드 산출물 확인

```bash
npm run build
```

빌드 후 `out/community/read/index.html`이 존재하는지 확인하고 결과를 보고하십시오. `<Suspense>`를 추가했다면 **빌드가 통과하는지가 핵심 확인 지점**입니다.

## 4.3 실제 동작 확인 — 이번에는 반드시 수행하십시오

이 수정은 Turnstile이나 자격증명 없이도 검증할 수 있습니다.

```bash
npx wrangler pages dev
```

1. `http://127.0.0.1:8788/community/read/?slug=00000000-0000-0000-0000-000000000000` 접속 → **404가 아니라 "찾을 수 없음" 안내가 뜨는지**
2. `http://127.0.0.1:8788/community/read/` (slug 없음) → 에러·무한로딩이 아닌 안내 화면

Preview 배포 후에는 실제 글을 하나 작성해 **목록 → 상세 → 목록** 왕복이 되는지 확인하십시오. 이것이 이 PR의 성패 기준입니다. 확인하지 못했다면 그대로 "미확인"이라고 적으십시오.

# 5. 산출물

1. PR URL (`origin/main` 대상, PR #13과 별개)
2. `git diff origin/main --stat` — **커뮤니티 컴포넌트 3개 + 테스트 + 결정 로그만** 나와야 합니다
3. `npm test` / `npm run lint` / `npm run build` 마지막 줄 (스킵 수 포함해 정확히)
4. `out/community/read/index.html` 존재 확인 결과
5. §4.3 로컬 확인 결과 — 화면 캡처 또는 응답 상태코드
6. 2.4에서 `useSearchParams()`와 `window.location.search` 중 무엇을 택했는지와 이유
7. 접수용 이메일 주소를 넣었는지, 아니면 운영자 확인 대기 중인지

# 6. 변경하지 말 것

- **PR #13의 변경사항을 이 브랜치에 가져오지 마십시오.** 이 PR은 `origin/main` 기준입니다
- `functions/api/community/**` 서버 코드를 건드리지 마십시오. 이 수정은 프론트엔드 라우팅만입니다
- `docs/community/01_product_spec.md`·`02_operations_enforcement_policy.md`의 신고 설계를 삭제하지 마십시오
- 접수용 이메일 주소를 임의로 지어내지 마십시오
- `ETF_PRICES` D1, ETF 데이터 수집·정적 빌드·배포 파이프라인을 건드리지 마십시오
- 소스 파일 생성·수정에 PowerShell 인라인 문자열을 쓰지 마십시오
- `git add .`를 쓰지 마십시오. 경로를 명시해 스테이징하십시오
- 리포트는 실제 결과와 일치해야 합니다. 미확인을 확인으로 적지 마십시오
- 확신이 서지 않으면 임의 결정하지 말고 **멈추고 질문**하십시오

---

# 부록: 이번 범위 밖 — 확인만 해 두십시오

| 항목 | 내용 |
| --- | --- |
| 검색 노출 | `app/community/read/page.tsx`의 metadata가 `robots: { index: false, follow: false }`입니다. 이대로면 **커뮤니티 글이 검색엔진에 전혀 노출되지 않습니다.** 쿼리 파라미터 URL은 원래 SEO에 불리하기도 합니다. 유입을 원한다면 별도 설계가 필요하니 운영자 결정 대상으로만 남기고 이번에 바꾸지 마십시오 |
| 페이지네이션 | 목록 API가 `limit` 1~50만 지원하고 커서·오프셋이 없습니다. "더보기"도 없습니다. 글이 50건을 넘으면 오래된 글에 도달할 수 없습니다 |
| 모더레이션 화면 | admin이 글을 숨기거나 삭제할 UI가 없어 DB 직접 조작이 필요합니다 |
| 알림 | 내 글에 댓글이 달려도 알 방법이 없습니다 |
| mojibake | `docs/community/02_operations_enforcement_policy.md:32`에 `표의 조���는` 같은 손상 문자가 있습니다. 전수 점검 대상 |
