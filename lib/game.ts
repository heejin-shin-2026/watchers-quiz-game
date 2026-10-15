import { BASE_POINTS, MAX_TIME_BONUS, QUESTION_TIME_SEC } from "./questions";

export type GameStatus = "lobby" | "question" | "reveal" | "finished";

export interface QuizGame {
  id: string;
  pin: string;
  status: GameStatus;
  question_index: number;
  question_started_at: string | null;
  created_at: string;
}

export interface QuizPlayer {
  id: string;
  game_id: string;
  nickname: string;
  score: number;
  joined_at: string;
}

export interface QuizAnswer {
  id: string;
  game_id: string;
  player_id: string;
  question_index: number;
  choice_index: number;
  answered_at: string;
  is_correct: boolean;
  points: number;
}

export const CHOICE_COLORS = [
  "bg-kahootRed",
  "bg-kahootBlue",
  "bg-kahootYellow",
  "bg-kahootGreen",
] as const;

export const CHOICE_SHAPES = ["▲", "◆", "●", "■"] as const;

/** 6자리 숫자 PIN 생성 */
export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 정답 점수: 600 + 시간 보너스(최대 400) */
export function calcPoints(elapsedSec: number): number {
  const clamped = Math.min(Math.max(elapsedSec, 0), QUESTION_TIME_SEC);
  return BASE_POINTS + Math.round(MAX_TIME_BONUS * (1 - clamped / QUESTION_TIME_SEC));
}

/** 문제 시작 시각 기준 남은 시간(초) */
export function remainingSec(startedAt: string | null): number {
  if (!startedAt) return QUESTION_TIME_SEC;
  const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(QUESTION_TIME_SEC - elapsed));
}

export function elapsedSec(startedAt: string, answeredAt: string): number {
  return Math.max(0, (new Date(answeredAt).getTime() - new Date(startedAt).getTime()) / 1000);
}
