# Watchers 실시간 퀴즈 게임

2026-10-17 Watchers 개강총회용 Kahoot 스타일 실시간 퀴즈 웹앱.

- 진행자(`/host`): 게임 생성(PIN 발급) → 로비 → 문제 출제(20초 타이머) → 정답 공개 → Top 10 → 최종 결과
- 참가자(`/play`): PIN + 닉네임으로 입장 → 폰에서 4지선다 답변 → 실시간 리더보드

## 기술 스택

- Next.js 15 App Router + Tailwind CSS
- Supabase (PostgreSQL + Realtime Broadcast)
- Vercel 배포 (serverless — 커스텀 WebSocket 서버 없음)

## 실시간 동기화 방식

- 상태 변경(문제 시작/정답 공개/다음 문제/종료) 시 Supabase Realtime Broadcast 채널(`quiz:{PIN}`)로 신호 전송
- 클라이언트는 신호 수신 시 REST로 게임 상태 재조회
- Broadcast 실패 대비 2초 폴링 폴백 (30명 동시 접속 가정)

## 점수 규칙

- 정답: 600점 + 시간 보너스 (최대 400점, `round(400 * (1 - 경과초/20))`)
- 오답: 0점
- 문제당 1회만 답변 가능

## 로컬 실행

```bash
npm install
cp .env.example .env.local  # Supabase URL/anon key 입력
npm run dev
```

## Supabase 설정

1. `supabase/migration.sql`을 Supabase Dashboard > SQL Editor에서 실행 (테이블 + RLS 정책)
2. Vercel 프로젝트 환경변수에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정

## 문제 교체

`lib/questions.ts`의 `QUESTIONS` 배열만 교체하면 됩니다.
형식: `{ question: string, choices: [string,string,string,string], answerIndex: number }`
