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
    benefitBadge: "연말정산 세액공제 한도 148.5만 원 계산하기",
    intro: "세액공제 혜택과 위험자산(주식형 ETF) 투자 한도를 고려한 1순위 계좌 배분 골든룰입니다.",
    questions: [
      {
        id: "1-1",
        shortTitle: "주식형 ETF 편입 한도 규제",
        text: "연금저축과 IRP는 모두 세액공제를 받지만, 연금저축펀드는 주식형 ETF를 100%까지 자유롭게 담을 수 있는 반면 IRP는 위험자산 편입 비중이 원칙적으로 70%로 제한된다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "위험자산 70% 한도",
          falseLabel: "아닙니다",
          falseHint: "동일한 규제 적용"
        },
        correctFeedback: "정확합니다! 연금저축펀드는 주식형 ETF 등 위험자산 한도 제한 없이 100% 자율 운용이 가능한 반면, IRP는 근로자퇴직급여보장법상 주식형 ETF 등 위험자산 비중이 원칙적으로 70%로 제한됩니다. (단, 적격 TDF나 채권혼합형 등 감독규정상 예외 상품은 규정에 따라 초과 편입 가능)",
        incorrectFeedback: "IRP는 퇴직연금 감독규정상 주식형 ETF 등 위험자산 투자한도가 원칙적으로 70%로 제한됩니다. 따라서 나머지 30%는 채권형, 예금, 또는 적격 TDF 등 위험자산 한도 예외 자산으로 채워야 합니다. 위험자산 100% 자율 운용이 가능한 연금저축 600만 원을 먼저 채우는 이유가 여기에 있습니다."
      },
      {
        id: "1-2",
        shortTitle: "세액공제 최대 환급액 팩트",
        text: "연금저축에 연 600만 원을 넣고 IRP에 300만 원을 추가로 넣으면, 총급여 5,500만 원 이하 직장인은 최대 148.5만 원을 연말정산으로 돌려받는다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "최대 148.5만 원 공제",
          falseLabel: "아닙니다",
          falseHint: "공제 한도 상이"
        },
        correctFeedback: "정답입니다! 900만 원 한도에 16.5% 공제율이 적용되어 세액공제액은 148.5만 원입니다. 실제 환급액은 이미 납부한 세액 범위 안에서 결정됩니다. (총급여 5,500만 원 초과 시 13.2% 적용으로 세액공제액 118.8만 원)",
        incorrectFeedback: "공제 한도가 자주 바뀌어 헷갈리기 쉽습니다. 2023년 세법 개정 이후 연금저축 600만 + IRP 합산 900만 원 한도로 확대되어, 16.5% 적용 시 세액공제액은 148.5만 원(5,500만 원 초과 시 13.2% 적용으로 118.8만 원)입니다. 실제 환급액은 이미 납부한 세액 범위 안에서 결정됩니다."
      }
    ]
  },
  {
    step: 2,
    title: "[유동성] 급전이 필요할 때, 세금 0원 비과세 인출 구조",
    benefitBadge: "🛡️ 급전 필요 시 중도인출 세금 0원 비과세 인출 구조",
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
    title: "[특례 구조] 3년 만기 ISA 자금의 연금 이전 추가 공제 한도 (최대 300만 원 대상)",
    benefitBadge: "ISA 만기 이전 시 추가 세액공제 대상 최대 300만 원 (환급 효과 최대 49.5만 원)",
    intro: "ISA 만기 자금을 60일 이내에 연금 계좌로 전환하여 추가 세액공제 대상 한도를 확보하는 실전 특례입니다.",
    questions: [
      {
        id: "3-1",
        shortTitle: "ISA 만기자금 연금 이전 세액공제 대상",
        text: "ISA 만기 자금을 60일 이내에 연금 계좌로 이전하면, 이전 금액의 10%(최대 300만 원 한도)가 기존 연간 납입 한도와 별개로 '추가 세액공제 대상 금액'으로 인정된다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "10% 추가 공제 대상",
          falseLabel: "아닙니다",
          falseHint: "기존 한도 내 포함"
        },
        correctFeedback: "정답입니다! 조특법 제86조의4에 따라 이전 금액의 10%(최대 300만 원)가 '추가 세액공제 대상 금액'이 됩니다. 이에 따라 실제 추가 세액공제액은 적용 공제율에 따라 최대 49.5만 원(16.5% 적용 시) 또는 39.6만 원(13.2% 적용 시)이며, 기본 연금 공제 한도(900만 원 대상, 최대 148.5만 원)와 합산 시 당해 연도 세액공제 대상은 총 1,200만 원, 공제액 합계는 최대 198만 원까지 가능합니다.",
        incorrectFeedback: "헷갈리기 쉬운 부분입니다. 이전 금액의 10%(최대 300만 원)는 '세액공제 대상 금액'이며, 그 자체가 전액 환급되는 것이 아닙니다. 여기에 공제율(16.5% 또는 13.2%)을 곱한 최대 49.5만 원(또는 39.6만 원)이 실제 추가 환급 효과입니다. (기본 연금 공제 최대 148.5만 원과 합산 시 총 세액공제액은 최대 198만 원)"
      },
      {
        id: "3-2",
        shortTitle: "ISA 계좌 재개설 가능 여부",
        text: "ISA 만기 자금을 연금 계좌로 넘기고 나면, ISA 계좌는 평생 다시 개설할 수 없다.",
        answer: false,
        options: {
          trueLabel: "맞습니다",
          trueHint: "평생 1회 한정",
          falseLabel: "아닙니다",
          falseHint: "즉시 재개설 가능"
        },
        correctFeedback: "정답입니다! 연금 이전 즉시 새로운 ISA를 개설하여 3년 비과세 시계를 반복 운용할 수 있습니다.",
        incorrectFeedback: "안심하셔도 됩니다! 만기 이전 완료 즉시 새 ISA를 개설할 수 있어, 3년 주기로 반복 운용할 수 있습니다."
      }
    ]
  },
  {
    step: 4,
    title: "[숨은 비용] 증권사 앱 총보수 이면에 숨은 실부담비용",
    benefitBadge: "🔍 겉보기 총보수 이면 숨은 기타비용·매매수수료 확인법",
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
    title: "[절세의 힘] 국내 상장 해외 ETF와 과세이연 복리 효과",
    benefitBadge: "📈 국내 상장 해외 ETF 과세이연 복리 재투자 원리",
    intro: "일반 계좌의 매 거래 시 세금 원천징수 대비, 절세계좌 과세이연이 장기 복리 수익률에 미치는 영향입니다.",
    questions: [
      {
        id: "5-1",
        shortTitle: "해외 ETF 매매차익 과세이연 복리",
        text: "일반 위탁 계좌에서 국내 상장 해외 ETF(예: 미국 S&P500)를 매매하면 매매차익에 15.4% 배당소득세가 즉시 원천징수되지만, ISA나 연금 계좌에서는 인출 전까지 과세가 유예되어 세금으로 나갈 돈까지 복리로 재투자된다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "세금 유예 복리 재투자",
          falseLabel: "아닙니다",
          falseHint: "매번 15.4% 즉시 징수"
        },
        correctFeedback: "정답입니다! 매매차익에 대한 15.4% 세금을 매번 떼지 않고 원금 전체를 재투자할 수 있는 '과세이연' 효과는 장기 투자 시 복리 효과를 극대화하는 핵심 원동력입니다.",
        incorrectFeedback: "절세계좌의 핵심 이점은 당장의 세금 감면뿐만 아니라 '과세가 유예되어 세금으로 빠져나갈 자금까지 복리로 불어나는 과세이연 효과'에 있습니다."
      },
      {
        id: "5-2",
        shortTitle: "일반 계좌 vs 중개형 ISA 절세 비교 (과세표준 500만 원 가정)",
        text: "국내 상장 해외 ETF 매매차익 500만 원(전액 과세 대상 가정)이 발생했을 때, 일반 위탁 계좌는 배당소득세(15.4%)로 77만 원이 징수되지만, 중개형 ISA(일반형)에서는 순이익 200만 원 비과세 후 초과분 300만 원에 9.9% 분리과세가 적용되어 세금이 29.7만 원으로 줄어든다.",
        answer: true,
        options: {
          trueLabel: "맞습니다",
          trueHint: "세금 29.7만 원 (차이 47.3만 원)",
          falseLabel: "아닙니다",
          falseHint: "동일하게 77만 원 부과"
        },
        correctFeedback: "완벽합니다! 동일한 500만 원 과세 대상 수익 가정 시, ISA 일반형을 활용하면 비과세 200만 원과 9.9% 저율 분리과세 덕분에 세금이 77만 원에서 29.7만 원으로 47.3만 원 절감됩니다. (서민형은 비과세 한도 400만 원으로 세부담 추가 감소)",
        incorrectFeedback: "국내 상장 해외 ETF는 배당소득세율 15.4%가 적용됩니다. 반면 중개형 ISA(일반형)는 순이익 200만 원까지 비과세, 초과분은 9.9% 분리과세되므로 500만 원 수익 기준 세부담이 77만 원에서 29.7만 원으로 47.3만 원 낮아집니다."
      }
    ]
  }
];
