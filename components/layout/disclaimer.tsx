import React from "react";

export type DisclaimerVariant = "standard" | "strict" | "compact";

export const DISCLAIMER_TEXTS: Record<DisclaimerVariant, { title: string; body: string }> = {
  standard: {
    title: "투자 유의사항 및 법적 고지",
    body: "본 서비스(ETF Campus) 및 커뮤니티에서 제공하는 모든 정보는 투자 참고용이며, 특정 금융상품의 매수·매도 추천이나 투자 권유가 아닙니다. 커뮤니티 게시물과 댓글은 작성자 개인의 의견일 뿐 당사의 공식 견해와 무관합니다. 과거의 수익률이 미래의 수익을 보장하지 않으며, 모든 투자 결정과 그에 따른 손익의 최종 책임은 투자자 본인에게 있습니다.",
  },
  strict: {
    title: "투자 유의 및 법적 책임 고지 (자본시장법 준수)",
    body: "본 플랫폼은 자본시장법상 투자자문업 또는 유사투자자문업을 영위하지 않으며, 1:1 투자 상담 및 개별 종목 추천을 일체 수행하지 않습니다. 게시판에 등록된 글·댓글·이미지 및 티커 링크는 회원의 자발적 학습 및 토론 목적의 게시물로서 내용의 정확성과 완전성을 보증하지 않습니다. 원금 손실 위험이 따르는 금융투자상품의 특성상 투자 전 반드시 투자설명서와 핵심설명서를 확인하시기 바랍니다.",
  },
  compact: {
    title: "법적 고지",
    body: "ETF Campus는 투자 권유 및 종목 추천을 하지 않습니다. 커뮤니티의 모든 게시물은 작성자 개인의 의견이며, 투자에 따른 최종 판단과 책임은 투자자 본인에게 있습니다.",
  },
};

export function LegalDisclaimer({
  variant = "compact",
  className = "",
}: {
  variant?: DisclaimerVariant;
  className?: string;
}): React.ReactElement {
  const text = DISCLAIMER_TEXTS[variant];

  return (
    <aside
      aria-label={text.title}
      className={"rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-xs leading-6 text-slate-600 sm:p-5 " + className}
    >
      <p className="font-bold text-slate-800">※ {text.title}</p>
      <p className="mt-1">{text.body}</p>
    </aside>
  );
}
