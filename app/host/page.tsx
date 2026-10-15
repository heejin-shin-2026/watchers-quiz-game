"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { QUESTIONS, QUESTION_TIME_SEC } from "@/lib/questions";
import {
  CHOICE_COLORS,
  CHOICE_SHAPES,
  QuizGame,
  QuizPlayer,
  calcPoints,
  elapsedSec,
  generatePin,
  remainingSec,
} from "@/lib/game";

type Screen = "menu" | "lobby" | "question" | "reveal" | "finished";

function Leaderboard({ players, highlightId }: { players: QuizPlayer[]; highlightId?: string }) {
  const top = players.slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];
  if (top.length === 0) return <p className="text-muted">아직 참가자가 없습니다.</p>;
  return (
    <ol className="space-y-2">
      {top.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
            p.id === highlightId
              ? "bg-kahootYellow/20 border-kahootYellow border-2"
              : "bg-card border-line"
          } ${i < 3 ? "text-xl font-black" : "text-lg"}`}
        >
          <span className="w-12 text-center shrink-0">{i < 3 ? medals[i] : `${i + 1}위`}</span>
          <span className="flex-1 truncate font-semibold">{p.nickname}</span>
          <span className="font-black text-kahootYellow shrink-0">{p.score.toLocaleString()}점</span>
        </li>
      ))}
    </ol>
  );
}

export default function HostPage() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [game, setGame] = useState<QuizGame | null>(null);
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SEC);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const revealingRef = useRef(false);
  const gameRef = useRef<QuizGame | null>(null);
  gameRef.current = game;

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/play` : "/play";

  // ---------- realtime broadcast ----------
  const getChannel = useCallback((pin: string): RealtimeChannel => {
    if (!channelRef.current) {
      const ch = supabase().channel(`quiz:${pin}`);
      ch.subscribe();
      channelRef.current = ch;
    }
    return channelRef.current;
  }, []);

  const broadcast = useCallback(
    async (pin: string) => {
      try {
        await getChannel(pin).send({
          type: "broadcast",
          event: "state",
          payload: { t: Date.now() },
        });
      } catch {
        /* 2초 폴링이 커버 */
      }
    },
    [getChannel]
  );

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  // ---------- loaders ----------
  const loadPlayers = useCallback(async (gameId: string) => {
    try {
      const { data } = await supabase()
        .from("quiz_players")
        .select("*")
        .eq("game_id", gameId)
        .order("score", { ascending: false });
      if (data) setPlayers(data as QuizPlayer[]);
    } catch {
      /* 폴백: 다음 폴링에서 재시도 */
    }
  }, []);

  const loadAnswerCount = useCallback(async (g: QuizGame) => {
    try {
      const { count } = await supabase()
        .from("quiz_answers")
        .select("id", { count: "exact", head: true })
        .eq("game_id", g.id)
        .eq("question_index", g.question_index);
      setAnsweredCount(count ?? 0);
    } catch {
      /* 무시 */
    }
  }, []);

  // ---------- actions ----------
  const createGame = async () => {
    setError(null);
    setBusy(true);
    try {
      let row: QuizGame | null = null;
      for (let i = 0; i < 5; i++) {
        const pin = generatePin();
        const { data, error } = await supabase().from("quiz_games").insert({ pin }).select().single();
        if (!error && data) {
          row = data as QuizGame;
          break;
        }
        const code = (error as { code?: string } | null)?.code;
        if (code !== "23505" && !String(error?.message ?? "").includes("duplicate")) throw error;
      }
      if (!row) throw new Error("PIN 생성에 실패했습니다. 다시 시도해주세요.");
      setGame(row);
      getChannel(row.pin);
      setScreen("lobby");
      await loadPlayers(row.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "게임 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const continueGame = async () => {
    const pin = pinInput.trim();
    if (!/^\d{6}$/.test(pin)) {
      setError("6자리 PIN을 입력해주세요.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { data, error } = await supabase().from("quiz_games").select("*").eq("pin", pin).single();
      if (error || !data) throw new Error("게임을 찾을 수 없습니다. PIN을 확인해주세요.");
      const g = data as QuizGame;
      setGame(g);
      getChannel(pin);
      await loadPlayers(g.id);
      setScreen(
        g.status === "lobby"
          ? "lobby"
          : g.status === "question"
            ? "question"
            : g.status === "reveal"
              ? "reveal"
              : "finished"
      );
      if (g.status === "question") {
        setTimeLeft(remainingSec(g.question_started_at));
        await loadAnswerCount(g);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "접속에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const startQuiz = async () => {
    const g = gameRef.current;
    if (!g || busy) return;
    if (players.length === 0) {
      setError("참가자가 1명 이상 있어야 시작할 수 있습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const startedAt = new Date().toISOString();
      const { error } = await supabase()
        .from("quiz_games")
        .update({ status: "question", question_index: 0, question_started_at: startedAt })
        .eq("id", g.id);
      if (error) throw error;
      setGame({ ...g, status: "question", question_index: 0, question_started_at: startedAt });
      setScreen("question");
      setTimeLeft(QUESTION_TIME_SEC);
      setAnsweredCount(0);
      revealingRef.current = false;
      await broadcast(g.pin);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "퀴즈 시작에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const reveal = useCallback(async () => {
    const g = gameRef.current;
    if (!g || revealingRef.current || g.status !== "question") return;
    revealingRef.current = true;
    setError(null);
    try {
      const q = QUESTIONS[g.question_index];
      const { data: answers } = await supabase()
        .from("quiz_answers")
        .select("*")
        .eq("game_id", g.id)
        .eq("question_index", g.question_index);

      const deltas = new Map<string, number>();
      for (const a of ((answers ?? []) as unknown as {
        id: string;
        player_id: string;
        choice_index: number;
        answered_at: string;
        is_correct: boolean;
      }[])) {
        if (a.is_correct) continue; // 멱등성
        const correct = a.choice_index === q.answerIndex;
        const pts =
          correct && g.question_started_at ? calcPoints(elapsedSec(g.question_started_at, a.answered_at)) : 0;
        await supabase().from("quiz_answers").update({ is_correct: correct, points: pts }).eq("id", a.id);
        if (pts > 0) deltas.set(a.player_id, (deltas.get(a.player_id) ?? 0) + pts);
      }
      if (deltas.size > 0) {
        const { data: plist } = await supabase().from("quiz_players").select("id,score").eq("game_id", g.id);
        for (const p of ((plist ?? []) as unknown as { id: string; score: number }[])) {
          const d = deltas.get(p.id) ?? 0;
          if (d > 0) await supabase().from("quiz_players").update({ score: p.score + d }).eq("id", p.id);
        }
      }
      const { error } = await supabase().from("quiz_games").update({ status: "reveal" }).eq("id", g.id);
      if (error) throw error;
      setGame({ ...g, status: "reveal" });
      setScreen("reveal");
      await loadPlayers(g.id);
      await broadcast(g.pin);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "정답 공개에 실패했습니다.");
      revealingRef.current = false;
    }
  }, [broadcast, loadPlayers]);

  const nextStep = async () => {
    const g = gameRef.current;
    if (!g || busy) return;
    setBusy(true);
    setError(null);
    try {
      const isLast = g.question_index >= QUESTIONS.length - 1;
      if (isLast) {
        const { error } = await supabase().from("quiz_games").update({ status: "finished" }).eq("id", g.id);
        if (error) throw error;
        setGame({ ...g, status: "finished" });
        setScreen("finished");
      } else {
        const startedAt = new Date().toISOString();
        const { error } = await supabase()
          .from("quiz_games")
          .update({ status: "question", question_index: g.question_index + 1, question_started_at: startedAt })
          .eq("id", g.id);
        if (error) throw error;
        setGame({ ...g, status: "question", question_index: g.question_index + 1, question_started_at: startedAt });
        setScreen("question");
        setTimeLeft(QUESTION_TIME_SEC);
        setAnsweredCount(0);
        revealingRef.current = false;
      }
      await broadcast(g.pin);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "진행에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setGame(null);
    setPlayers([]);
    setPinInput("");
    setError(null);
    setScreen("menu");
    revealingRef.current = false;
  };

  // ---------- polling (broadcast 폴백) ----------
  useEffect(() => {
    if (!game || (screen !== "lobby" && screen !== "question")) return;
    const t = setInterval(() => {
      const g = gameRef.current;
      if (!g) return;
      loadPlayers(g.id);
      if (screen === "question") loadAnswerCount(g);
    }, 2000);
    return () => clearInterval(t);
  }, [game, screen, loadPlayers, loadAnswerCount]);

  // ---------- host-owned 20초 타이머 ----------
  useEffect(() => {
    if (screen !== "question" || !game?.question_started_at) return;
    const t = setInterval(() => {
      const left = remainingSec(game.question_started_at);
      setTimeLeft(left);
      if (left <= 0) void reveal();
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, game?.question_started_at]);

  const q = game ? QUESTIONS[game.question_index] : null;
  const isLastQ = game ? game.question_index >= QUESTIONS.length - 1 : false;

  return (
    <main className="min-h-screen bg-ink px-4 py-6 md:px-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-muted hover:text-white text-sm">
            ← 처음으로
          </Link>
          {game && (
            <span className="text-muted text-sm">
              PIN <span className="text-white font-bold">{game.pin}</span>
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-kahootRed/20 border border-kahootRed text-white">
            ⚠️ {error}
          </div>
        )}

        {screen === "menu" && (
          <div className="text-center pt-16">
            <h1 className="text-4xl md:text-5xl font-black mb-10">🎤 진행자 화면</h1>
            <button
              onClick={createGame}
              disabled={busy}
              className="block w-full max-w-md mx-auto px-8 py-5 mb-6 rounded-2xl bg-kahootBlue text-white text-2xl font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              {busy ? "생성 중…" : "＋ 새 게임 만들기"}
            </button>
            <div className="max-w-md mx-auto bg-card border border-line rounded-2xl p-6">
              <p className="text-muted mb-3 font-semibold">진행자 계속하기 (새로고침 대응)</p>
              <div className="flex gap-2">
                <input
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6자리 PIN"
                  inputMode="numeric"
                  className="flex-1 px-4 py-3 rounded-xl bg-ink border border-line text-center text-2xl font-black tracking-[0.3em] text-white placeholder:text-muted/50"
                />
                <button
                  onClick={continueGame}
                  disabled={busy}
                  className="px-6 py-3 rounded-xl bg-kahootGreen text-white font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
                >
                  접속
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === "lobby" && game && (
          <div className="text-center">
            <p className="text-muted mb-2">참가용 PIN</p>
            <div className="text-7xl md:text-8xl font-black tracking-[0.2em] text-kahootYellow mb-4">{game.pin}</div>
            <p className="text-muted mb-1">참가 주소</p>
            <p className="text-xl font-bold text-white mb-8 break-all">{joinUrl}</p>
            <div className="bg-card border border-line rounded-2xl p-6 mb-8 text-left">
              <p className="font-bold text-xl mb-4">
                참가자 <span className="text-kahootGreen">{players.length}명</span>
              </p>
              {players.length === 0 ? (
                <p className="text-muted">아직 참가자가 없습니다. PIN을 화면에 띄워주세요!</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {players.map((p) => (
                    <span key={p.id} className="px-4 py-2 rounded-full bg-ink border border-line font-semibold">
                      {p.nickname}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={startQuiz}
              disabled={busy || players.length === 0}
              className="px-12 py-5 rounded-2xl bg-kahootGreen text-white text-2xl font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-40"
            >
              {busy ? "시작 중…" : "▶ 퀴즈 시작"}
            </button>
          </div>
        )}

        {screen === "question" && game && q && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted font-bold">
                문제 {game.question_index + 1} / {QUESTIONS.length}
              </span>
              <span
                className={`text-5xl font-black tabular-nums ${timeLeft <= 5 ? "text-kahootRed animate-pulse" : "text-kahootYellow"}`}
              >
                {timeLeft}
              </span>
            </div>
            <h2 className="text-2xl md:text-4xl font-black mb-8 leading-snug">{q.question}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {q.choices.map((c, i) => (
                <div key={i} className={`${CHOICE_COLORS[i]} rounded-2xl p-5 flex items-center gap-4 opacity-90`}>
                  <span className="text-3xl">{CHOICE_SHAPES[i]}</span>
                  <span className="text-xl md:text-2xl font-bold text-white">{c}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between bg-card border border-line rounded-2xl p-5">
              <span className="text-xl font-bold">
                🙋 {answeredCount} / {players.length}명 답변
              </span>
              <button
                onClick={() => void reveal()}
                className="px-8 py-4 rounded-2xl bg-kahootRed text-white text-xl font-bold hover:brightness-110 active:scale-95 transition"
              >
                정답 공개
              </button>
            </div>
          </div>
        )}

        {screen === "reveal" && game && q && (
          <div>
            <p className="text-muted font-bold mb-2">
              문제 {game.question_index + 1} / {QUESTIONS.length} · 정답 공개
            </p>
            <h2 className="text-2xl md:text-3xl font-black mb-6">{q.question}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {q.choices.map((c, i) => (
                <div
                  key={i}
                  className={`${CHOICE_COLORS[i]} rounded-2xl p-5 flex items-center gap-4 ${
                    i === q.answerIndex ? "ring-4 ring-white scale-[1.02]" : "opacity-40"
                  }`}
                >
                  <span className="text-3xl">{CHOICE_SHAPES[i]}</span>
                  <span className="text-xl md:text-2xl font-bold text-white">{c}</span>
                  {i === q.answerIndex && <span className="ml-auto text-2xl">✅</span>}
                </div>
              ))}
            </div>
            <h3 className="text-2xl font-black mb-4">🏆 Top 10</h3>
            <Leaderboard players={players} />
            <button
              onClick={nextStep}
              disabled={busy}
              className="mt-8 w-full px-8 py-5 rounded-2xl bg-kahootBlue text-white text-2xl font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              {busy ? "진행 중…" : isLastQ ? "🏁 최종 결과" : "다음 문제 →"}
            </button>
          </div>
        )}

        {screen === "finished" && (
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-black mb-2">🎉 최종 결과 🎉</h1>
            <p className="text-muted text-xl mb-8">수고하셨습니다!</p>
            <div className="text-left mb-8">
              <Leaderboard players={players} />
            </div>
            <button
              onClick={resetAll}
              className="px-10 py-4 rounded-2xl bg-kahootGreen text-white text-xl font-bold hover:brightness-110 active:scale-95 transition"
            >
              새 게임 만들기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
