/**
 * 금융 법규 및 감독규정 단일 진실 공급원 (SSOT) 상수
 *
 * 법적 근거:
 * 1. 근로자퇴직급여 보장법 시행규칙 제10조 제1항 제2호 (DC/IRP 위험자산 70% 한도)
 * 2. 금융위원회고시 제2023-56호 / 퇴직연금감독규정 제11조 제1항 제5호 (채권혼합형 주식 투자한도 50% 미만)
 * 3. 퇴직연금감독규정 제11조 제1항 제9호 / 감독규정시행세칙 제5조의2 (적격 TDF 100% 안전자산)
 * 4. 금융투자협회 집합투자기구 분류 기준 (최고편입한도 50% 이하)
 */

export const RETIREMENT_PENSION_REGULATION = {
  /** 근로자퇴직급여 보장법상 DC/IRP 위험자산 투자한도 (70%) */
  RISK_ASSET_CAP_RATIO: 0.70,
  /** 근로자퇴직급여 보장법상 DC/IRP 의무 안전자산 비율 (30%) */
  SAFETY_ASSET_MIN_RATIO: 0.30,
  /** 퇴직연금감독규정 제11조 제1항 제5호상 안전자산 인정 채권혼합형 주식 최고한도 (50% 미만) */
  MIXED_BOND_EQUITY_MAX_RATIO: 0.50,
  /** 주식 70% + 채권혼합(주식 50%) 30% 편입 시 달성 가능한 최대 실질 주식 노출도 (85%) */
  MAX_EFFECTIVE_EQUITY_EXPOSURE_RATIO: 0.85,
  /** 표시용 퍼센트 문자열 SSOT */
  DISPLAY: {
    RISK_CAP: "70%",
    SAFETY_MIN: "30%",
    MIXED_BOND_EQUITY_CAP: "50%",
    MAX_EFFECTIVE_EQUITY: "85%",
    PENSION_EQUITY_LEVERAGE_STRATEGY: "퇴직연금 85% 자산배분 전략",
  },
} as const;
