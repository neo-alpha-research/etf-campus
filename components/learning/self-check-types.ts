export type CheckItemStatus = "unanswered" | "confirmed" | "needs_review" | "not_applicable";

export type SelectableStatus = "confirmed" | "needs_review" | "not_applicable";

export interface SelfCheckItem {
  id: number;
  category: string;
  prompt: string;
  sourceLabel: string;
  sourceUrl?: string; // Optional: when empty, render as plain instructional guidance text
}

export const SELF_CHECK_ITEMS: SelfCheckItem[] = [
  {
    id: 1,
    category: "비용 공시",
    prompt: "내가 확인한 보수 수치가 운용사 약관상의 '명목 총보수'인지, 결산 후 사후 집계되는 기타비용과 매매수수료율이 포함된 '실부담비용'인지 구분하여 확인하였는가?",
    sourceLabel: "금융투자협회 전자공시(DIS) 펀드별 보수비용 비교 공시",
    sourceUrl: "https://dis.kofia.or.kr",
  },
  {
    id: 2,
    category: "비용 공시",
    prompt: "ETF 간 비용을 비교할 때 공시 기준일자(As-of Date)와 집계 회계연도 결산월이 동일한 조건인지 대조하였는가?",
    sourceLabel: "각 ETF 자산운용사 정기 영업보고서 및 금융투자협회 공시 기준일자",
    sourceUrl: "https://dis.kofia.or.kr",
  },
  {
    id: 3,
    category: "거래 비용",
    prompt: "공시된 펀드 보수 외에 본인이 거래하는 증권사의 위탁매매수수료 및 매수·매도 호가 스프레드가 개인 거래비용으로 별도 발생함을 인지하였는가?",
    sourceLabel: "이용 중인 각 증권사 HTS/MTS 수수료 안내 및 장중 호가창 (개인별·증권사별 상이)",
    // Individual broker commissions have no public universal URL -> text guidance without misleading link
  },
  {
    id: 4,
    category: "공시 확인",
    prompt: "신규 상장 ETF 등에서 기타비용 데이터가 비어 있는 경우, 비용이 0%인 것으로 간주하거나 추정하지 않고, 결측 원인 및 실제 공시 여부를 협회 DIS 및 자산운용사 공시를 통해 직접 확인하였는가?",
    sourceLabel: "금융투자협회 전자공시(DIS) 신규 상장 ETF 투자설명서 및 운용보고서",
    sourceUrl: "https://dis.kofia.or.kr",
  },
  {
    id: 5,
    category: "세제 한도",
    prompt: "연간 최대로 넣을 수 있는 '납입한도(1,800만 원)'와 연말정산 시 '세액공제 대상 한도(최대 900만 원)'의 차이를 확인하고, 세액공제 계산액이 실제 환급세액 자체를 의미하지 않음을 확인하였는가?",
    sourceLabel: "소득세법 제59조의3 및 국세청 홈택스 세액공제 안내",
    sourceUrl: "https://mob.tbht.hometax.go.kr/jsonAction.do?actionId=UTBRNAAT31F001&subMenuId=01",
  },
  {
    id: 6,
    category: "퇴직연금 규정",
    prompt: "확정기여형(DC) 퇴직연금에서 회사가 납입하는 법정 부담금(연 임금의 1/12 이상)과 근로자가 직접 추가 납입하는 자기부담금(연 1,800만 원 한도 및 세액공제 대상)이 구분됨을 확인하였는가?",
    sourceLabel: "근로자퇴직급여 보장법 제20조(부담금의 납입 등)",
    sourceUrl: "https://www.law.go.kr/법령/근로자퇴직급여보장법",
  },
  {
    id: 7,
    category: "퇴직연금 규정",
    prompt: "DC 및 IRP 계좌에서는 주식형 ETF 등 위험자산에 대해 70% 투자한도가 적용되며, 연금저축펀드는 주식형 ETF를 100% 편입할 수 있음을 확인하였는가?",
    sourceLabel: "금융위원회 「퇴직연금감독규정」 제9조 및 제12조",
    sourceUrl: "https://www.law.go.kr/행정규칙/퇴직연금감독규정",
  },
  {
    id: 8,
    category: "안전자산 구분",
    prompt: "퇴직연금의 30% 안전자산 슬롯에 편입되는 자산 중 예금자보호 대상 상품(은행 예금 등, 1인당 1억 원)과 비보호 원리금보장 상품(ELB 등), 실적배당 상품(채권형 ETF)의 차이를 확인하였는가?",
    sourceLabel: "금융위원회 예금보호한도 상향 안내 및 퇴직연금 보호 범위 안내",
    sourceUrl: "https://www.fsc.go.kr/no010101/85200?curPage=59",
  },
  {
    id: 9,
    category: "퇴직연금 이전",
    prompt: "퇴직 시 퇴직급여는 원칙적으로 IRP로 의무 이전해야 하나, 55세 이상 퇴직이거나 퇴직금이 300만 원 이하인 경우 일반 급여계좌 수령이 가능함을 확인하였는가?",
    sourceLabel: "근로자퇴직급여 보장법 제17조 제4항 및 동법 시행령 제9조(이전 예외)",
    sourceUrl: "https://law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=71020",
  },
  {
    id: 10,
    category: "인출 및 과세",
    prompt: "연금 인출 시 세액공제 미신청 원금(과세 제외), 이연퇴직소득(법정 연금수령 요건 충족 시 퇴직소득세율의 70%→60%→50% 과세), 공제분·수익(연령별 3.3~5.5% 또는 16.5%)의 재원별 과세 차이와 계좌별 인출 가능 조건을 확인하였는가?",
    sourceLabel: "국세청 연금소득 과세 안내 및 법정 연금수령 요건",
    sourceUrl: "https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=7888&mi=2312",
  },
];
