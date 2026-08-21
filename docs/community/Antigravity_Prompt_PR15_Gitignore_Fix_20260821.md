# Antigravity 긴급 수정 — PR #15의 `.gitignore`가 깨졌습니다

작성일 2026-08-21 · 브랜치 `chore/remove-root-scratch-scripts` · PR #15

---

# 0. 문제

`.gitignore`에 규칙을 추가할 때 이 명령을 썼습니다.

```powershell
echo "`n# Scratch scripts`n/*.py" >> .gitignore
```

**PowerShell 5.1의 `>>`는 UTF-16LE로 기록합니다.** UTF-8 파일 뒤에 UTF-16 바이트가 그대로 붙었습니다. 실제 파일 끝부분을 바이트 단위로 본 결과입니다 (`^@`는 널 바이트).

```
data/staging/^M$
$
^@#^@ ^@S^@c^@r^@a^@t^@c^@h^@ ^@s^@c^@r^@i^@p^@t^@s^@$
^@/^@*^@.^@p^@y^@^M^@$
```

git도 이 파일을 더 이상 텍스트로 보지 않습니다.

```
 .gitignore | Bin 441 -> 522 bytes
```

`Bin`은 **git이 바이너리로 분류했다는 뜻**입니다.

## 결과

1. **`/*.py` 규칙이 동작하지 않습니다.** git은 `.gitignore`를 UTF-8 텍스트로 읽는데, 널 바이트가 섞인 줄은 의도한 패턴으로 파싱되지 않습니다. 추가한 두 줄 전체가 무의미합니다.
2. `.gitignore`가 바이너리로 취급되어 앞으로 diff가 읽히지 않고 편집이 지저분해집니다.
3. **이번 작업 흐름에서 PowerShell 인코딩 사고가 세 번째입니다.** ① 테스트 파일 UTF-8 BOM ② here-string이 백틱과 `${...}`를 먹어 치환이 조용히 실패 ③ 이번 UTF-16 append.

**`>>`·`>`·`Set-Content`로 소스나 설정 파일을 쓰지 마십시오.** 파일 작업은 에디터 도구로 하십시오.

# 1. 수정

`chore/remove-root-scratch-scripts` 브랜치에서 `.gitignore`를 **에디터 도구로 열어** 손상된 끝부분을 제거하고 아래 두 줄을 정상 텍스트로 다시 추가하십시오.

- 파일 전체를 **UTF-8(BOM 없음)**, 기존과 동일한 **CRLF 줄바꿈**으로 저장하십시오. 기존 줄들은 CRLF입니다
- 널 바이트가 하나도 남지 않아야 합니다

추가할 내용 (파일 맨 끝):

```
# Scratch scripts
/*.py
```

> 선행 `/`는 저장소 루트에만 적용한다는 뜻입니다. `scripts/` 하위의 정상 파이썬 121개는 영향받지 않습니다. 패턴 자체는 의도대로이니 그대로 쓰십시오.

# 2. 검증 — 세 가지 모두 확인하십시오

```bash
# (1) 널 바이트가 없어야 합니다. 출력이 없어야 정상
git show chore/remove-root-scratch-scripts:.gitignore | grep -c $'\0'

# (2) git이 텍스트로 인식하는지 — Bin 표기가 사라져야 합니다
git diff origin/main chore/remove-root-scratch-scripts --stat -- .gitignore

# (3) 규칙이 실제로 동작하는지
#     루트에 임시 파일을 만들어 무시되는지 확인한 뒤 반드시 삭제하십시오
```

(3)은 이렇게 하십시오.

- 루트에 `__ignore_check.py`를 만든다
- `git status --porcelain`에 나타나지 **않아야** 한다
- `git check-ignore -v __ignore_check.py`가 `.gitignore`의 해당 줄을 가리켜야 한다
- **확인 후 파일을 삭제한다**

같은 방법으로 `scripts/update_daily_data.py`가 **무시되지 않는지도** 확인하십시오. `git check-ignore -v scripts/update_daily_data.py`가 아무것도 출력하지 않아야 정상입니다.

# 3. 마무리

- 수정 커밋을 `chore/remove-root-scratch-scripts`에 푸시하십시오
- `npm test` / `npm run lint` / `npm run build`를 다시 돌리고 마지막 줄을 제시하십시오
- PR #15 링크와 함께 §2의 검증 3건 결과를 보고하십시오

# 4. 참고 — 확인된 다른 사항

## 4.1 308 리다이렉트 — 정확한 보고였습니다

`/community/read?slug=...` 요청이 `trailingSlash: true` 규칙에 걸려 308로 `/community/read/?slug=...`로 넘어가는 것을 실제로 확인해 보고한 것은 좋았습니다. **동작에는 문제가 없으니 이번에 고치지 마십시오.** 글 클릭마다 왕복이 한 번 더 생기는 성능 이슈이므로 별도 이슈로 남기십시오.

## 4.2 lint 경고 수가 35 → 65로 늘었습니다

같은 브랜치에서 직전 리포트는 `35 problems (0 errors, 35 warnings)`, 이번은 `65 problems (0 errors, 65 warnings)`였습니다. **errors가 0이므로 머지를 막지는 않습니다.** 다만 둘 중 하나는 부분 실행이나 출력 잘림일 가능성이 있습니다.

`npm run lint`를 `Select-Object -Last N` 없이 **끝까지 실행**해 실제 숫자를 확인하고, 65가 맞다면 그대로 보고하십시오. 30건이 갑자기 늘어난 것이라면 원인을 확인하십시오.

# 5. 변경하지 말 것

- PR #14의 코드를 건드리지 마십시오. 이번 작업은 PR #15의 `.gitignore` 한 파일입니다
- `/*.py` 패턴을 다른 것으로 바꾸지 마십시오. 의도대로입니다
- 삭제한 8개 스크래치 파일을 되살리지 마십시오
- `scripts/` 하위 파이썬 파일을 건드리지 마십시오
- **`>>`·`>`·`Set-Content`·here-string으로 파일을 쓰지 마십시오.** 에디터 도구를 쓰십시오
- 검증용으로 만든 임시 파일을 커밋하지 마십시오
- `git add .`를 쓰지 마십시오
- 리포트는 실제 결과와 일치해야 합니다
- 확신이 서지 않으면 임의 결정하지 말고 **멈추고 질문**하십시오
