-- Local development seed only. Do not add production users, email addresses, API keys, or administrator identities here.

insert into public.community_categories (slug, name, description, sort_order, is_active)
values
  ('pension-etf-qna', '연금 ETF Q&A', '연금 계좌 ETF 판단 기준을 질문하고 검증하는 공간입니다.', 10, true),
  ('etf-information', 'ETF 정보·질문', 'ETF 구조와 정보 해석 기준을 함께 확인하는 공간입니다.', 20, true),
  ('thirty-day-challenge', '30일 챌린지', '투자 판단 기준을 학습하는 30일 실천 공간입니다.', 30, true),
  ('product-feedback', '오류·기능 제안', '데이터 오류와 기능 개선 의견을 남기는 공간입니다.', 40, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;
