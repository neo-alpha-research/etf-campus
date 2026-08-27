# Community Overhaul Decision Log (DECISIONS.md)

| ID | Date | Stage | Decision | Rationale | Alternatives Considered |
|---|---|---|---|---|---|
| DEC-S0-01 | 2026-08-27 | S0 | Worktree established at `.worktrees/etf-campus-overhaul` on `feat/community-overhaul` based on `origin/main` | Isolated worktree inside workspace directory protects ongoing development on other branches. | Direct branch checkout in main workspace (risks clobbering dirty state). |
| DEC-S0-02 | 2026-08-27 | S0 | PR #13/#14/#15 status verification | PR #14 (`0e71591`) and #15 (`92ce3f2`) are already merged into `origin/main`. PR #13 was absorbed/superseded. | N/A |
| DEC-S3-01 | 2026-08-27 | S3 | Implement post upvote via RPC with auth.uid() and table upvote_count | Strict session security; avoids client tampering; atomic row-locked counter updates | Direct table update with RLS (rejected due to security vulnerability) |
| DEC-S4-01 | 2026-08-27 | S4 | Client WebP Canvas Conversion + Native Workers R2 Binding | Zero AWS SDK footprint; automated EXIF metadata stripping; high edge performance | Direct client S3 presigned upload via @aws-sdk/client-s3 (rejected per Gemini Invalidation Rule §1) |
| DEC-S5-01 | 2026-08-27 | S5 | Client-Side Regex Cashtag Rendering () | Zero XSS risk, raw markdown DB portability, zero server overhead | Server-side HTML transformation at save time (rejected to avoid stored XSS & markup drift) |
| DEC-S6-01 | 2026-08-27 | S6 | Modular Legal Disclaimer Component with Selectable Variants | Ensures compliance with financial regulation while providing flexible drafting (Standard / Strict / Compact) | Static hardcoded disclaimer text without variant switching |
| DEC-S6-02 | 2026-08-27 | S6 | User Selected Disclaimer Draft C (Compact Variant) | Clear, concise legal disclaimer chosen by user for high readability and regulatory clarity | Draft A (Standard) / Draft B (Strict) |
