export interface TutorialQuestion {
  id: string;
  shortTitle: string;
  text: string;
  answer: boolean;
  options: {
    trueLabel: string;
    trueHint: string;
    falseLabel: string;
    falseHint: string;
  };
  correctFeedback: string;
  incorrectFeedback: string;
}

export interface TutorialStep {
  step: number;
  title: string;
  benefitBadge: string;
  intro: string;
  questions: TutorialQuestion[];
}

export const tutorialSteps: TutorialStep[] = [
  {
    step: 1,
    title: "[계좌 배분] 연금저축 vs IRP, 왜 600만 원부터 채워야 할까?",
    benefitBadge: "💰 연말정산 최대 148.5만 원 법정 확정 환급 비법",
    intro: "세액공제 혜택과 위험자산(주식형 ETF) 투자 한도를 고려한 1순위 계좌 배분 골든룰입니다.",
    questions: [
      {
        id: "1-1",
        shortTitle: "주식형 ETF 편입 한도 규제",
        text: "연금저축과 IRP는 모두 세액공제를 받지만, 연금저축은 주식형 ETF를 100%까지 자유롭게 담을 수 있는 반면 IRP는 안전자산을 30% 의무 편입해야 한다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "주식 ETF 100% 자율",
          falseLabel: "아닙니다",
          falseHint: "동일한 규제 적용"
        },
        correctFeedback: "정확합니다! 연금저축은 위험자산 편입 제한이 없어 공격적인 자산 배분이 가능하지만, IRP는 30%의 안전자산(채권·예금 등) 규제를 받습니다.",
        incorrectFeedback: "충분히 헷갈릴 수 있습니다. IRP는 근로자퇴직급여보장법의 규제를 받아 안전자산 30% 의무 룰이 강제됩니다. 그래서 유동성과 자율성이 높은 연금저축 600만 원을 먼저 채우는 것이 정석입니다."
      },
      {
        id: "1-2",
        shortTitle: "세액공제 최대 환급액 팩트",
        text: "연금저축에 연 600만 원을 넣고 IRP에 300만 원을 추가로 넣으면, 총급여 5,500만 원 이하 직장인은 최대 148.5만 원을 연말정산으로 돌려받는다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "최대 148.5만 원 환급",
          falseLabel: "아닙니다",
          falseHint: "환급 한도 상이"
        },
        correctFeedback: "정답입니다! 900만 원 한도에 16.5% 공제율이 적용되어 148.5만 원의 법정 확정 수익이 완성됩니다. (총급여 5,500만 원 초과 시 13.2% 적용으로 118.8만 원 환급)",
        incorrectFeedback: "공제 한도가 자주 바뀌어 헷갈리기 쉽습니다. 2023년 세법 개정 이후 연금저축 600만 + IRP 합산 900만 원 한도로 확대되어, 16.5% 적용 시 148.5만 원(5,500만 원 초과 시 13.2% 적용으로 118.8만 원)이 환급됩니다."
      }
    ]
  },
  {
    step: 2,
    title: "[유동성] 급전이 필요할 때, 세금 0원 인출 서열",
    benefitBadge: "🛡️ 급전 필요 시 중도인출 세금 0원 방어 서열",
    intro: "인생의 급전 상황에서도 페널티 없이 내 피 같은 원금을 지켜내는 절세계좌 인출의 기술입니다.",
    questions: [
      {
        id: "2-1",
        shortTitle: "연금저축 중도인출 세금 팩트",
        text: "연금저축에 납입한 돈은 만 55세 이전에는 어떤 경우에도 세금 페널티 없이 1원도 꺼내 쓸 수 없다.",
        answer: false,
        options: {
          trueLabel: "맞습니다",
          trueHint: "무조건 묶임",
          falseLabel: "아닙니다",
          falseHint: "미공제 원금 세금 0원"
        },
        correctFeedback: "정답입니다! 연말정산 때 세액공제를 받지 않은 순수 초과 납입 원금은 세금이나 페널티 없이 언제든 자유롭게 인출할 수 있습니다.",
        incorrectFeedback: "많은 분들이 연금은 무조건 돈이 묶인다고 오해하십니다. 세법상 세액공제 혜택을 받지 않은 '미공제 원금'은 원천징수 대상이 아니므로 언제든 세금 0원으로 인출 가능합니다."
      },
      {
        id: "2-2",
        shortTitle: "중개형 ISA 납입원금 인출 룰",
        text: "중개형 ISA는 3년 의무가입 기간이 끝나기 전이라도, 내가 납입한 원금 범위 내에서는 세금이나 페널티 없이 언제든 자유롭게 출금할 수 있다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "납입 원금 자유 인출",
          falseLabel: "아닙니다",
          falseHint: "3년간 출금 불가"
        },
        correctFeedback: "정확합니다! ISA는 수익금이 아닌 '납입 원금'에 대해서는 만기 전이라도 중도인출 페널티가 전혀 없습니다.",
        incorrectFeedback: "ISA를 3년 동안 강제로 묶이는 통장으로 오해하시는 경우가 많습니다. 발생한 수익을 제외한 '순수 납입 원금'은 언제 빼더라도 비과세 혜택이 취소되지 않고 자유롭게 인출됩니다."
      }
    ]
  },
  {
    step: 3,
    title: "[특례 점프] 3년 만기 ISA 자금의 198만 원 연금 이전 마법",
    benefitBadge: "🚀 ISA 3년 만기 198만 원 세액공제 특례 점프",
    intro: "ISA 3년 만기 자금을 연금 계좌로 넘겨 세액공제 한도를 극대화하는 실전 테크닉입니다.",
    questions: [
      {
        id: "3-1",
        shortTitle: "ISA 만기자금 연금 이전 세액공제",
        text: "ISA 3년 만기 해지 자금을 60일 이내에 연금저축으로 이전하면, 이전 금액의 10%(최대 300만 원)를 기존 연간 공제 한도와 별개로 추가 세액공제 받는다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "10% 추가 세액공제",
          falseLabel: "아닙니다",
          falseHint: "기존 한도 내 포함"
        },
        correctFeedback: "정답입니다! 조특법 제86조의3에 따른 특례로, 당해 연도 세액공제 한도가 최대 1,200만 원(기본 900만 + 이전 300만)까지 확장됩니다.",
        incorrectFeedback: "이 제도는 고수들만 챙기는 숨겨진 세법 보너스입니다. 만기 자금 3,000만 원을 연금으로 넘기면 10%인 300만 원이 추가 공제되어 그해 환급금이 최대 198만 원까지 뜁니다."
      },
      {
        id: "3-2",
        shortTitle: "ISA 계좌 무한 재개설 여부",
        text: "ISA 만기 자금을 연금 계좌로 넘기고 나면, ISA 계좌는 평생 다시 개설할 수 없다.",
        answer: false,
        options: {
          trueLabel: "맞습니다",
          trueHint: "평생 1회 한정",
          falseLabel: "아닙니다",
          falseHint: "즉시 무한 재개설"
        },
        correctFeedback: "정답입니다! 연금 이전 즉시 새로운 ISA를 개설하여 3년 비과세 시계를 무한히 다시 돌릴 수 있습니다.",
        incorrectFeedback: "안심하셔도 됩니다! 만기 이전 완료 즉시 새 ISA를 개설할 수 있어, 3년 주기 비과세와 198만 원 연금 점프를 평생 무한 선순환시킬 수 있습니다."
      }
    ]
  },
  {
    step: 4,
    title: "[숨은 비용] 증권사 앱 총보수 이면에 숨은 실부담비용",
    benefitBadge: "🔍 겉보기 총보수 이면 숨은 비용 0.2% 절감",
    intro: "겉보기 보수 뒤에 가려진 기타비용과 매매수수료까지 완벽하게 간파하는 비용 분석법입니다.",
    questions: [
      {
        id: "4-1",
        shortTitle: "증권사 총보수 vs 실부담비용",
        text: "동일한 S&P500 지수를 추종하는 ETF라면, 증권사 앱 상품 설명서에 적힌 '총보수'만 가장 저렴한 것을 고르면 비용을 100% 아낄 수 있다.",
        answer: false,
        options: {
          trueLabel: "맞습니다",
          trueHint: "총보수만 보면 충분",
          falseLabel: "아닙니다",
          falseHint: "기타비용 숨어있음"
        },
        correctFeedback: "정답입니다! 총보수 외에 '기타비용'과 '매매중개수수료율'이 빠져 있어, 겉보기 총보수와 실제 계좌에서 빠져나가는 실부담비용은 크게 다릅니다.",
        incorrectFeedback: "가장 많은 분들이 걸려드는 착시입니다. 앱에 적힌 총보수 0.009% 뒤에는 결제비용, 회계감사비 등 '기타비용'과 '지수 매매수수료'가 숨어 있어, 반드시 금융투자협회 공시 실부담비용을 확인해야 합니다."
      },
      {
        id: "4-2",
        shortTitle: "숨은 비용 투명 공시 확인법",
        text: "ETF Campus의 비교 검색기를 활용하면, 총보수 뒤에 숨겨진 기타비용과 실부담비용 합계를 1초 만에 투명하게 확인할 수 있다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "합산 실부담비용 공시",
          falseLabel: "아닙니다",
          falseHint: "직접 계산 필요"
        },
        correctFeedback: "정답입니다! 캠퍼스는 금융투자협회 매월 공시 데이터를 투명하게 결합하여 진짜 실부담비용을 추적합니다.",
        incorrectFeedback: "일반 포털에서는 기타비용을 보여주지 않아 찾기 어렵습니다. ETF Campus는 투자자가 억울한 숨은 수수료를 내지 않도록 모든 비용을 합산 공시합니다."
      }
    ]
  },
  {
    step: 5,
    title: "[절세의 힘] 국내 상장 해외 ETF와 과세이연 복리",
    benefitBadge: "📈 해외 ETF 과세이연 수천만 원 복리 마법",
    intro: "일반 계좌 대비 수천만 원의 수익 격차를 만들어내는 절세계좌 과세이연의 힘입니다.",
    questions: [
      {
        id: "5-1",
        shortTitle: "해외 ETF 매매차익 과세이연 복리",
        text: "일반 주식 계좌에서 미국 S&P500 ETF를 매매하면 수익금에 매번 15.4% 세금이 즉시 원천징수되지만, ISA나 연금 계좌에서는 세금을 떼지 않고 재투자하는 과세이연 혜택을 누린다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "세금 유예 복리 재투자",
          falseLabel: "아닙니다",
          falseHint: "매번 15.4% 즉시 징수"
        },
        correctFeedback: "정답입니다! 15.4%를 떼이지 않고 원금에 붙여 복리로 굴리는 힘이 10년 뒤 수천만 원의 격차를 만듭니다.",
        incorrectFeedback: "절세계좌의 진짜 위력은 당장의 세금 절약보다 '세금 낼 돈까지 투자금으로 굴려 복리를 누리는 과세이연'에 있습니다."
      },
      {
        id: "5-2",
        shortTitle: "일반 계좌 vs 중개형 ISA 절세 격차",
        text: "해외 ETF 투자로 500만 원 수익이 났을 때, 일반 계좌는 77만 원의 세금을 내야 하지만, 중개형 ISA(일반형)에서는 비과세 200만 원과 9.9% 분리과세로 세금이 29.7만 원으로 줄어든다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "세금 29.7만 원으로 절감",
          falseLabel: "아닙니다",
          falseHint: "동일하게 77만 원 부과"
        },
        correctFeedback: "완벽합니다! 동일한 500만 원 수익이라도 계좌 하나 바꾼 것만으로 47.3만 원이 내 주머니에 남습니다.",
        incorrectFeedback: "계좌에 따른 세금 격차는 생각보다 엄청납니다. 비과세 한도 200만 원을 빼고 초과분만 9.9% 분리과세되어 세금이 60% 이상 줄어듭니다."
      }
    ]
  }
];
