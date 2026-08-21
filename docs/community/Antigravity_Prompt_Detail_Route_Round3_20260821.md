# Antigravity 마무리 지시문 — PR #14 정리

작성일 2026-08-21 · 브랜치 `fix/community-post-detail-route` · PR #14

---

# 0. 검증 결과 — 목표는 달성됐습니다

실제 코드로 확인했습니다.

| 항목 | 확인 |
| --- | --- |
| 목록 링크 | ``href={`/community/read/?slug=${encodeURIComponent(post.slug)}`}`` ✅ |
| composer 리다이렉트 | `/community/read/?slug=...` ✅ |
| `/community/${post.slug}/` 잔존 | 두 파일 모두 **0건** ✅ |
| slug 파싱 | `useSearchParams().get("slug")` ✅ |
| `<Suspense>` 경계 | `app/community/read/page.tsx`에 적용 ✅ |
| not-found UI | 렌더링 분기 존재 ✅ |
| 배너 문구 | "작성·댓글은 이메일 인증 회원만 가능합니다" (신고 제거) ✅ |
| `scripts/` 무결성 | `.py` 121개, `origin/main`과 **정확히 일치** ✅ |
| 워크트리 루트 `.py` | 0개 ✅ |
| PR | #14 생성됨 ✅ |

**slug가 빈 문자열일 때 `load()`가 조기 return해 `status`가 `"loading"`에 영원히 머무는 무한 로딩 버그를 직접 찾아 고친 것은 좋은 작업입니다.** 지시문에 없던 실제 결함이었습니다.

> `git rm *.py`가 git 경로지정자로 해석되어 `scripts/` 하위 파이썬 121개까지 스테이징에서 삭제될 뻔했으나, 곧바로 `git restore`로 복구한 것도 확인했습니다. 결과적으로 손실은 없습니다. 다만 이런 광범위 글로브는 앞으로 쓰지 마십시오.

**남은 것은 4건이며, 그중 1건만 실제 위험입니다.**

---

# 1. R-1 (High) — `--skip-worktree` 처리를 되돌리십시오

리포트 §7의 조치입니다.

> 해당 파일들은 워크트리에서 삭제 후 `git update-index --skip-worktree` 처리하여 `git status`에서 완전히 배제했습니다.

**이 상태는 지뢰입니다.** 대상 8개 파일은 `origin/main`에 **추적 중인 파일**입니다.

```
add_remember_me_backend.py  fix.py         fix_supabase.py   rewrite_supabase.py
update_endpoints.py         update_ui.py   update_ui2.py     write.py
```

`--skip-worktree`는 "이 파일은 변경되지 않았다고 간주하라"는 지시입니다. 그런데 파일은 **디스크에서 삭제된 상태**입니다. 이 조합에서 앞으로 벌어질 일:

- `git pull`·`git merge`·`git checkout`이 해당 파일을 건드리려 할 때 **"local changes would be overwritten"으로 실패**할 수 있습니다
- 나중에 누군가 `--no-skip-worktree`로 되돌리면 git이 **8건의 삭제**를 갑자기 감지합니다
- 이 플래그는 워크트리 로컬 설정이라 **다른 사람은 보이지 않습니다.** 원인 추적이 어려운 유형의 고장입니다

## 해야 할 일

```bash
git update-index --no-skip-worktree add_remember_me_backend.py fix.py fix_supabase.py \
  rewrite_supabase.py update_endpoints.py update_ui.py update_ui2.py write.py
git checkout -- add_remember_me_backend.py fix.py fix_supabase.py \
  rewrite_supabase.py update_endpoints.py update_ui.py update_ui2.py write.py
git status --porcelain
```

**파일을 원래대로 되살려 두십시오.** 지저분하지만 `origin/main`과 일치하는 정상 상태입니다. `git status`가 깨끗해야 합니다.

> 여기서 `git checkout -- <file>`을 쓰는 것은 예외적으로 허용합니다. **되돌린 뒤 재적용하는 패턴이 아니라, 잘못 지운 추적 파일을 원상 복구하는 용도**이기 때문입니다.

## 정리는 별도 PR로

이 8개 파일은 커밋 `4930f6c style(auth): make ETF CAMPUS logo text larger and bolder`에 딸려 `main`에 들어갔습니다. 커밋 메시지와 무관한 파일들이 `git add .`로 함께 실려간 사례입니다.

**PR #14에 섞지 말고 별도 PR로 정리하십시오.**

- 브랜치: `chore/remove-root-scratch-scripts` (origin/main 기준)
- `git rm` 8개 — **반드시 파일명을 하나씩 명시**하십시오. `*.py` 글로브를 쓰지 마십시오
- `.gitignore`에 루트 임시 스크립트 패턴 추가를 검토하되, `scripts/`의 정상 파이썬 파일이 걸리지 않도록 하십시오
- `npm test`·`npm run build`로 이 파일들을 참조하는 곳이 없음을 확인하십시오

---

# 2. R-2 (Medium) — not-found 판정이 한글 문구 정확 일치에 의존합니다

`components/community/community-post-detail.tsx:66`

```js
if (error instanceof Error && error.message === "게시물을 찾을 수 없습니다.") {
  setStatus("not-found");
}
```

서버는 `functions/api/community/posts/[slug]/index.js`에서 5곳에 걸쳐 `errorResponse(404, "NOT_FOUND", "게시물을 찾을 수 없습니다.")`를 반환합니다. 지금은 문자열이 일치하므로 동작합니다.

문제는 **`===` 정확 일치**라는 점입니다. 서버 문구에서 마침표 하나만 빠져도 이 분기가 조용히 죽고, 사용자는 not-found 화면 대신 범용 에러를 봅니다. 오류 코드(`NOT_FOUND`)라는 안정적인 신호가 있는데 사람이 읽는 문구를 프로토콜로 쓰고 있습니다.

## 지금 할 일 — 방어만 추가

이 브랜치는 `origin/main` 기준이라 `communityFetch`가 아직 오류 코드를 전달하지 않습니다. **구조 변경은 하지 마십시오.** 대신 서버 문구가 바뀌어도 최소한 눈에 띄도록, 해당 줄 바로 위에 주석 한 줄을 남기십시오.

```js
// TODO(PR #13 머지 후): communityFetch가 error.code를 전달하므로
// error.code === "NOT_FOUND"로 교체할 것. 현재는 서버 문구와 정확히 일치해야 동작함.
```

## 나중에 할 일 — PR #13 머지 후

PR #13이 `lib/community/browser-client.ts`의 `communityFetch`에 `status`·`code`·`body`를 실어 던지도록 이미 바꿔 두었습니다. **두 PR이 모두 머지된 뒤** 위 조건을 이렇게 바꾸십시오.

```js
if ((error as Error & { code?: string })?.code === "NOT_FOUND") {
  setStatus("not-found");
}
```

**이번 PR에서는 하지 마십시오.** 브랜치 베이스가 달라 충돌만 만듭니다. 별도 후속 작업으로 기록해 두십시오.

---

# 3. R-3 (Low) — D-1 단언을 조금만 조이십시오

현재 `components/community/__tests__/community-feed.test.tsx:40`

```ts
expect(link.getAttribute("href")).toContain("slug=test-slug-123");
expect(link.getAttribute("href")).not.toContain("/community/test-slug-123/");
```

원래 버그는 잡습니다. 다만 **경로가 `/community/read`인지는 확인하지 않습니다.** 링크가 엉뚱한 경로를 가리켜도 통과합니다.

한 줄만 추가하십시오.

```ts
expect(link.getAttribute("href")).toContain("/community/read");
```

`toBe` 정확 일치로 되돌릴 필요는 없습니다. 트레일링 슬래시 정규화 이슈가 있다면 그것대로 두십시오.

---

# 4. R-4 (Medium) — 트레일링 슬래시 관찰을 실제 환경에서 확인하십시오

리포트 §7-2의 관찰입니다.

> `href="/community/read/?slug=..."` 코드가 실제 렌더링 된 후 DOM에는 `href="/community/read?slug=..."` 형태로 트레일링 슬래시가 생략되어 노출됩니다.

**이 관찰이 jsdom 테스트 환경의 아티팩트인지, 실제 브라우저 동작인지 확인되지 않았습니다.** `next.config.ts`에 `trailingSlash: true`가 설정돼 있어 Next는 오히려 슬래시를 붙이는 쪽으로 동작합니다. vitest의 jsdom 환경에는 `next.config`가 적용되지 않으므로, 테스트에서 본 것이 프로덕션과 다를 수 있습니다.

슬래시가 빠진 채 요청되면 Cloudflare Pages가 `/community/read/`로 308 리다이렉트합니다. 쿼리는 보존되므로 동작 자체는 하지만, 매 클릭마다 왕복이 한 번 더 생깁니다.

## 확인 방법

Preview 배포 후 브라우저에서 목록의 글을 클릭하고, **devtools Network 탭에서 308 리다이렉트가 발생하는지** 보십시오.

- 308이 없다면: 슬래시가 유지되고 있으며 문제 없음
- 308이 있다면: 동작은 하지만 불필요한 왕복. 별도 후속 작업으로 기록

**어느 쪽인지 확인해 보고하십시오.** 확인하지 못했으면 "미확인"이라고 적으십시오.

---

# 5. 산출물

1. §1 실행 후 `git status --porcelain` — 깨끗해야 합니다
2. `git ls-files -v | Select-String "^S"` — **아무것도 나오지 않아야** 합니다 (skip-worktree 해제 확인)
3. §2 주석 추가, §3 단언 추가 후 `npm test` 마지막 20줄
4. `npm run lint` 마지막 줄 (exit 0), `npm run build` 마지막 줄
5. `git diff origin/main --stat`
6. §4 확인 결과 — 308 유무. 미확인이면 그대로 기재
7. 별도 PR(`chore/remove-root-scratch-scripts`) 생성 여부와 URL. 이번에 하지 않았다면 "미실행"으로 기재

---

# 6. 변경하지 말 것

- §0 표의 통과 항목을 되돌리지 마십시오. 특히 `community-feed.tsx`의 링크는 이미 올바릅니다
- §2의 구조 변경(`error.code` 전환)을 **이번 PR에서 하지 마십시오.** 주석만 남기십시오
- 루트 `.py` 8개를 PR #14에서 삭제하지 마십시오. 별도 PR입니다
- `git rm *.py` 같은 광범위 글로브를 쓰지 마십시오. 파일명을 명시하십시오
- `git add .`를 쓰지 마십시오
- PowerShell 인라인 문자열로 소스 파일을 생성·수정하지 마십시오
- 정규식 일괄 치환으로 기존 파일을 수정하지 마십시오
- 기존 테스트를 삭제·skip·완화하지 마십시오
- `functions/api/community/**`와 `ETF_PRICES` D1, ETF 데이터 파이프라인을 건드리지 마십시오
- 리포트는 실제 결과와 일치해야 합니다
- 확신이 서지 않으면 임의 결정하지 말고 **멈추고 질문**하십시오
