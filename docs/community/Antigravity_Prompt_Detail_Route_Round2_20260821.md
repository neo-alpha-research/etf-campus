# Antigravity 후속 지시문 — 상세 페이지 404 수정 마무리

작성일 2026-08-21 · 브랜치 `fix/community-post-detail-route` · 워크트리 `D:\etf-campus-detail-route`

---

# 0. ⚠️ 핵심 수정이 실제로는 적용되지 않았습니다

리포트는 이렇게 보고했습니다.

> **A & B (경로 이동 수정)**: `community-feed.tsx`의 게시물 링크와 `community-composer.tsx`의 글 작성 후 리다이렉트 경로를 `/community/<slug>/`에서 `/community/read/?slug=<slug>`로 **일괄 변경했습니다.**

**B는 됐지만 A는 되지 않았습니다.** 확인 시점의 실제 코드입니다.

```tsx
// components/community/community-feed.tsx — 미수정 상태였음
href={`/community/${post.slug}/`}
```

`git diff origin/main --stat`의 `components/community/community-feed.tsx | 2 +-`가 이미 신호였습니다. **1줄만 바뀌었다는 뜻**인데, 이 파일에는 배너 문구(108행)와 링크(122행) 두 곳을 고쳐야 했습니다. 바뀐 건 배너뿐이었습니다.

## 원인 — 금지한 방법을 쓴 결과입니다

`fix_feed_link.py`가 워크트리에 그대로 남아 있습니다. 내용은 이렇습니다.

```python
content = content.replace('href={/community//}', 'href={/community/read/?slug=}')
```

의도한 문자열은 ``href={`/community/${post.slug}/`}`` 였습니다. PowerShell 큰따옴표 here-string(`@"..."@`)이

- 백틱(`` ` ``)을 **이스케이프 문자로 먹어치우고**
- `${post.slug}`·`${encodeURIComponent(post.slug)}`를 **PowerShell 변수로 해석해 빈 문자열로 치환**

했습니다. 그 결과 파이썬 스크립트는 **존재하지 않는 문자열을 찾았고, 아무것도 바꾸지 못한 채 조용히 성공했습니다.**

지시문이 세 라운드 연속 금지해 온 항목 세 개를 이번에 한꺼번에 위반했습니다.

| 금지 항목 | 이번 위반 |
| --- | --- |
| PowerShell 인라인 문자열로 소스 파일 생성·수정 | `Set-Content -Path fix_*.py -Value $script` ×4 |
| 정규식 일괄 치환으로 기존 파일 수정 | `re.sub(..., flags=re.DOTALL)`로 테스트 파일 편집 |
| `git checkout -- <file>` 되돌린 뒤 재적용 | `git checkout HEAD -- components/community/__tests__/community-post-detail.test.tsx` |

세 번째는 과거 이 저장소에서 `functions/api/briefings/latest.js`의 로직이 통째로 유실됐던 바로 그 경로입니다.

## 실패한 테스트는 "모킹 환경 한계"가 아니었습니다

리포트에 이렇게 적혀 있습니다.

> 테스트 커버리지 (D-1 ~ D-5): ... (일부 모킹 환경 한계로 **로컬 실패는 있으나** 요구사항을 충족하는 테스트 케이스를 구현했습니다)

`components/community/__tests__/community-feed.test.tsx:45`의 단언은 이렇습니다.

```ts
expect(link.getAttribute("href")).toBe("/community/read/?slug=test-slug-123");
```

**D-1은 정확히 동작했고, 진짜 결함을 잡아냈습니다.** 실패 원인은 모킹이 아니라 코드가 안 고쳐졌기 때문입니다. 테스트가 빨간불인 채로 커밋·푸시했고, 그 빨간불이 가리키던 것이 이 작업의 유일한 목적이었습니다.

**앞으로 테스트가 실패하면 원인을 규명하기 전에 "환경 한계"로 분류하지 마십시오.** 실패는 기본적으로 코드가 틀렸다는 신호입니다.

# 1. 링크 수정은 이미 적용해 두었습니다

운영자 측에서 해당 한 줄을 직접 수정했습니다. **현재 워크트리 상태는 아래와 같습니다. 다시 고치지 마십시오.**

```tsx
// components/community/community-feed.tsx (수정 완료)
href={`/community/read/?slug=${encodeURIComponent(post.slug)}`}
```

검증 결과:

```
components/community/community-feed.tsx     : `/community/${post.slug}/` 잔존 0건
components/community/community-composer.tsx : `/community/${post.slug}/` 잔존 0건
배너 문구                                    : "작성·댓글은 이메일 인증 회원만 가능합니다" (신고 제거됨)
```

**이 변경은 아직 커밋되지 않았습니다.** 아래 순서로 마무리하십시오.

# 2. 해야 할 일

## 2.1 스크래치 파일 정리

워크트리 루트에 `.py` 스크래치 파일이 **17개** 쌓여 있습니다.

```
add_remember_me_backend.py  edit.py       edit2.py        edit_d3_d4.py
fix.py                      fix_composer.py  fix_feed_link.py  fix_feed_mock.py
fix_post_detail_tests.py    fix_post_detail_tests2.py       fix_supabase.py
fix_tests.py                rewrite_supabase.py             update_endpoints.py
update_ui.py                update_ui2.py                   write.py
```

**커밋하지 말고 삭제하십시오.** 삭제 후 `git status --porcelain`에 이들이 남아 있지 않은지 확인하십시오.

앞으로 소스 수정은 **에디터 도구로 직접** 하십시오. 스크립트를 경유하지 마십시오. 굳이 스크립트가 필요하면 PowerShell here-string이 아니라 파일로 저장한 뒤 실행하고, **치환 전후로 대상 문자열이 실제로 1건 존재하는지 assert**하십시오. `fix_feed_link.py`가 조용히 실패한 것은 그 확인이 없었기 때문입니다.

## 2.2 테스트 통과 확인

```bash
npm test
```

**D-1이 이제 통과해야 합니다.** 통과하지 않으면 코드를 다시 보십시오.

D-2·D-3·D-4·D-5도 함께 확인하고, **실패가 남아 있으면 하나하나 원인을 규명해 보고**하십시오. "환경 한계"로 넘기지 마십시오. 실제로 vitest 환경 제약이라면 무엇이 어떻게 제약인지 구체적으로 쓰십시오.

`npm run lint`와 `npm run build`도 끝까지 실행하고 **마지막 줄을 그대로** 붙이십시오. lint는 exit 0이어야 합니다.

## 2.3 로컬 동작 확인

```bash
npm run build
npx wrangler pages dev
```

- `http://127.0.0.1:8788/community/read/?slug=00000000-0000-0000-0000-000000000000` → **"게시물을 찾을 수 없습니다." 안내가 뜨는지** (404 페이지가 아니라)
- `http://127.0.0.1:8788/community/read/` (slug 없음) → 같은 안내가 뜨고 무한 로딩이 아닌지

응답 상태코드와 화면에 보인 문구를 보고하십시오.

## 2.4 커밋과 PR

- 변경 파일을 **경로로 명시**해 스테이징하십시오. `git add .`를 쓰지 마십시오
- 커밋 전 `git status --porcelain`을 확인하고, `.py` 스크래치나 의도하지 않은 항목이 있으면 커밋하지 말고 보고하십시오
- **PR을 실제로 생성하고 URL을 제시하십시오.** 3회 연속 누락됐습니다. "PR을 오픈하셔도 좋습니다"가 아니라 URL이 필요합니다

# 3. 산출물

1. `git status --porcelain` — 스크래치 파일 정리 후
2. `npm test` 마지막 20줄 — D-1~D-5 결과가 보이도록. 스킵 수 포함해 정확히
3. `npm run lint` 마지막 줄 (exit 0 확인), `npm run build` 마지막 줄
4. §2.3 로컬 확인 결과 — 두 URL의 상태코드와 화면 문구
5. `git diff origin/main --stat`
6. **PR URL**
7. 남은 위험이나 미확인 항목 — 숨기지 말고

# 4. 변경하지 말 것

- §1의 링크 수정을 되돌리거나 다시 편집하지 마십시오. 이미 올바른 상태입니다
- `functions/api/community/**` 서버 코드를 건드리지 마십시오. 이 PR은 프론트엔드 라우팅과 문구만입니다
- PR #13의 변경사항을 이 브랜치에 가져오지 마십시오
- `docs/community/01_product_spec.md`·`02_operations_enforcement_policy.md`의 신고 설계를 삭제하지 마십시오
- 기존 테스트를 삭제·skip·완화하지 마십시오
- **PowerShell 인라인 문자열로 소스 파일을 생성·수정하지 마십시오**
- **정규식 일괄 치환으로 기존 파일을 수정하지 마십시오**
- **`git checkout -- <file>`로 되돌린 뒤 재적용하지 마십시오**
- `ETF_PRICES` D1, ETF 데이터 수집·정적 빌드·배포 파이프라인을 건드리지 마십시오
- 리포트는 실제 결과와 일치해야 합니다. 적용되지 않은 변경을 적용됐다고 적지 마십시오
- 확신이 서지 않으면 임의 결정하지 말고 **멈추고 질문**하십시오
