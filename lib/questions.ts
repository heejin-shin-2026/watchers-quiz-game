export interface Question {
  question: string;
  choices: [string, string, string, string];
  answerIndex: number;
}

/**
 * 2026년 핫한 투자·경제 토픽 10문제 (쉬움 → 어려움 순)
 * 교체 방법: 이 배열만 통째로 바꾸면 됩니다.
 */
export const QUESTIONS: Question[] = [
  {
    question: "2026년 사상 최고치를 경신한 국제 금값이 돌파한 온스당 가격은?",
    choices: ["$3,000", "$4,000", "$5,000", "$6,000"],
    answerIndex: 2,
  },
  {
    question: "2026년 금과 함께 사상 처음으로 온스당 100달러를 돌파한 귀금속은?",
    choices: ["백금", "은", "팔라듐", "구리"],
    answerIndex: 1,
  },
  {
    question: "2026년 10월 13일, 코스피가 장중 붕괴되며 내줬던 지수는?",
    choices: ["5000선", "6000선", "7000선", "8000선"],
    answerIndex: 1,
  },
  {
    question: "2026년 3분기, 국내 기업 최초로 분기 영업이익 100조원을 돌파한 기업은?",
    choices: ["SK하이닉스", "현대차", "삼성전자", "TSMC"],
    answerIndex: 2,
  },
  {
    question: "2026년 3분기 사상 최대 실적을 내고 연간 가이던스를 세 번째 상향 조정한 반도체 장비 기업은?",
    choices: ["도쿄일렉트론", "ASML", "램리서치", "어플라이드머티리얼즈"],
    answerIndex: 1,
  },
  {
    question: "중국 창신메모리(CXMT)가 2026년 10월 발표한 차세대 D램의 핵심 스펙은?",
    choices: ["셀 면적 약 33% 축소", "동작 속도 2배 향상", "전력 소모 50% 절감", "판매 가격 33% 인하"],
    answerIndex: 0,
  },
  {
    question: "2026년 10월, 브로드컴 CEO 혹 탄이 'AI 확장에서 가장 큰 제약'이라고 꼽은 것은?",
    choices: ["전력 수급", "자본", "인재 확보", "정부 규제"],
    answerIndex: 1,
  },
  {
    question: "2026년 하반기, 코스피와 극명하게 대비되며 연초 대비 약 70% 급등한 아시아 증시는?",
    choices: ["일본 닛케이225", "대만 가권지수", "중국 상해종합지수", "홍콩 항셍지수"],
    answerIndex: 1,
  },
  {
    question: "2026년 외국인의 코스피 순매도액 중 삼성전자와 SK하이닉스가 차지한 비중은?",
    choices: ["30%대", "50%대", "70%대", "85% 이상"],
    answerIndex: 3,
  },
  {
    question: "2026년 10월 13일 코스피 급락 당시 두 달 만에 발동된 것은?",
    choices: ["매도 사이드카", "서킷브레이커", "매수 사이드카", "거래소 휴장"],
    answerIndex: 0,
  },
];

export const QUESTION_TIME_SEC = 20;
export const BASE_POINTS = 600;
export const MAX_TIME_BONUS = 400;
