# Community Overhaul Decision Log (DECISIONS.md)

| ID | Date | Stage | Decision | Rationale | Alternatives Considered |
|---|---|---|---|---|---|
| DEC-S0-01 | 2026-08-27 | S0 | Worktree established at `.worktrees/etf-campus-overhaul` on `feat/community-overhaul` based on `origin/main` | Isolated worktree inside workspace directory protects ongoing development on other branches. | Direct branch checkout in main workspace (risks clobbering dirty state). |
| DEC-S0-02 | 2026-08-27 | S0 | PR #13/#14/#15 status verification | PR #14 (`0e71591`) and #15 (`92ce3f2`) are already merged into `origin/main`. PR #13 was absorbed/superseded. | N/A |
| DEC-S3-01 | 2026-08-27 | S3 | Implement post upvote via RPC with auth.uid() and table upvote_count | Strict session security; avoids client tampering; atomic row-locked counter updates | Direct table update with RLS (rejected due to security vulnerability) |
