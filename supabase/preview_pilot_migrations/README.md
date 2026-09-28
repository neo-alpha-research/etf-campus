# Supabase Preview Pilot Migrations

이 디렉터리는 **프리뷰 환경 파일럿 검증 전용 마이그레이션**을 격리 보관하는 공간입니다.

## 1. 보관 파일
- `20260928000001_backoffice_member_read_rpc.sql`:
  - 프리뷰 DB(`vdjyuqtcqhchopbrhexd`)에서 승인된 합성 계정 3건(`00000000-0000-4000-a000-000000000001`, `0002`, `0003`)만 엄격하게 조회되도록 강제한 서버 측 RPC입니다.

## 2. 격리 및 불변성 원칙
1. **운영 배포 경로 완전 배제**:
   - 본 파일은 정규 `supabase/migrations/` 경로에 포함되지 않으므로, 운영 DB(`uetzvsfqnydzdvnpytus`) 또는 신규 환경 생성 시 절대 실행되지 않습니다.
2. **프리뷰 DB 격리 보존**:
   - 프리뷰 DB에는 본 파일럿 마이그레이션이 적용된 상태로 유지되어야 하며, 운영용 범용 RPC(`supabase/migrations/20260928000001_backoffice_member_ops_read_rpcs.sql`)를 프리뷰 DB에 적용하여 3명 제한이 의도치 않게 해제되는 일이 없도록 엄격히 통제합니다.
