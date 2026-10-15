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
  remainingSec,
} from "@/lib/game";

type Screen = "join" | "lobby" | "question" | "reveal" | "finished";

function MiniLeaderboard({ players, highlightId }: { players: QuizPlayer[]; highlightId?: string }) {
  const top = players.slice(0, 10);
  const medals = ["🥇", "🥈", "🥉"];
  if (top.length === 0) return <p className="text-muted text-center">집계 중…</p>;
  return (
    <ol className="space-y-2">
      {top.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-base ${
            p.id === highlightId ? "bg-kahootYellow/20 border-kahootYellow border-2" : "bg-card border-line"
          } ${i < 3 ? "font-black text-lg" : ""}`}
        >
          <span className="w-10 text-center shrink-0">{i < 3 ? medals[i] : `${i + 1}위`}</span>
          <span className="flex-1 truncate font-semibold">{p.nickname}</span>
          <span className="font-black text-kahootYellow shrink-0">{p.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

export default function PlayPage() {
  const [screen, setScreen] = useState<Screen>("join");
  const [pinInput, setPinInput] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [game, setGame] = useState<QuizGame | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<QuizPlayer[]>([]);
  const [myAnswer, setMyAnswer] = useState<number | null>(null);
  const [myCorrect, setMyCorrect] = useState<boolean | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SEC);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const gameRef = useRef<QuizGame | null>(null);
  gameRef.current = game;
  const playerIdRef = useRef<string | null>(null);
  playerIdRef.current = playerId;
  const lastQRef = useRef<number | null>(null);

  const applyGameState = useCallback((g: QuizGame) => {
    if (lastQRef.current !== null && lastQRef.current !== g.question_index) {
      setMyAnswer(null);
      setMyCorrect(null);
      setMyPoints(0);
    }
    lastQRef.current = g.question_index;
    setGame(g);
    setScreen(
      g.status === "lobby" ? "lobby" : g.status === "question" ? "question" : g.status === "reveal" ? "reveal" : "finished"
    );
  }, []);

  const loadPlayers = useCallback(async (gameId: string) => {
    try {
      const { data } = await supabase()
        .from("quiz_players")
        .select("*")
        .eq("game_id", gameId)
        .order("score", { ascending: false });
      if (data) setPlayers(data as QuizPlayer[]);
    } catch {
      /* 다음 폴링에서 재시도 */
    }
  }, []);

  const fetchGame = useCallback(async () => {
    const g = gameRef.current;
    if (!g) return;
    try {
      const { data } = await supabase().from("quiz_games").select("*").eq("id", g.id).single();
      if (data) applyGameState(data as QuizGame);
    } catch {
      /* 무시 */
    }
  }, [applyGameState]);
  const fetchGameRef = useRef(fetchGame);
  fetchGameRef.current = fetchGame;

  const subscribe = useCallback((pin: string) => {
    if (channelRef.current) return;
    try {
      const ch = supabase().channel(`quiz:${pin}`);
      ch.on("broadcast", { event: "state" }, () => {
        void fetchGameRef.current();
      });
      ch.subscribe();
      channelRef.current = ch;
    } catch {
      /* 2초 폴링이 커버 */
    }
  }, []);

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  // 세션 복원 (새로고침 대응)
  useEffect(() => {
    (async () => {
      try {
        const raw = sessionStorage.getItem("quizSession");
        if (!raw) return;
        const { pin, playerId: pid } = JSON.parse(raw) as { pin: string; playerId: string };
        const { data: p, error: pe } = await supabase().from("quiz_players").select("*").eq("id", pid).single();
        if (pe || !p) {
          sessionStorage.removeItem("quizSession");
          return;
        }
        const player = p as QuizPlayer;
        const { data: g, error: ge } = await supabase().from("quiz_games").select("*").eq("id", player.game_id).single();
        if (ge || !g || (g as QuizGame).pin !== pin) {
          sessionStorage.removeItem("quizSession");
          return;
        }
        const ng = g as QuizGame;
        setPlayerId(pid);
        setPinInput(pin);
        subscribe(pin);
        const { data: a } = await supabase()
          .from("quiz_answers")
          .select("choice_index")
          .eq("game_id", ng.id)
          .eq("player_id", pid)
          .eq("question_index", ng.question_index)
          .maybeSingle();
        if (a) setMyAnswer((a as { choice_index: number }).choice_index);
        applyGameState(ng);
        await loadPlayers(ng.id);
      } catch {
        /* 조용히 입장 화면 유지 */
      }
    })();
  }, [subscribe, applyGameState, loadPlayers]);

  // 2초 폴링 (브로드캐스트 폴백)
  useEffect(() => {
    if (!game) return;
    const t = setInterval(() => {
      void fetchGameRef.current();
      const g = gameRef.current;
      if (g) void loadPlayers(g.id);
    }, 2000);
    return () => clearInterval(t);
  }, [game, loadPlayers]);

  // 1초 타이머 표시
  useEffect(() => {
    if (screen !== "question" || !game?.question_started_at) return;
    const t = setInterval(() => setTimeLeft(remainingSec(game.question_started_at)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, game?.question_started_at]);

  // reveal/finished 진입 시 내 결과 집계
  useEffect(() => {
    if ((screen !== "reveal" && screen !== "finished") || !game || !playerId) return;
    (async () => {
      try {
        const { data: a } = await supabase()
          .from("quiz_answers")
          .select("*")
          .eq("game_id", game.id)
          .eq("player_id", playerId)
          .eq("question_index", game.question_index)
          .maybeSingle();
        if (a) {
          const ans = a as { choice_index: number; is_correct: boolean; points: number };
          setMyAnswer(ans.choice_index);
          setMyCorrect(ans.is_correct);
          setMyPoints(ans.points);
        } else {
          setMyCorrect(false);
          setMyPoints(0);
        }
        const { data: plist } = await supabase()
          .from("quiz_players")
          .select("*")
          .eq("game_id", game.id)
          .order("score", { ascending: false });
        if (plist) {
          const list = plist as QuizPlayer[];
          setPlayers(list);
          const idx = list.findIndex((p) => p.id === playerId);
          setMyRank(idx >= 0 ? idx + 1 : null);
          if (idx >= 0) setMyScore(list[idx].score);
        }
      } catch {
        /* 무시 */
      }
    })();
  }, [screen, game, playerId]);

  const join = async () => {
    const pin = pinInput.trim();
    const nickname = nicknameInput.trim();
    if (!/^\d{6}$/.test(pin)) {
      setError("6자리 PIN을 입력해주세요.");
      return;
    }
    if (!nickname) {
      setError("닉네임을 입력해주세요.");
      return;
    }
    if (nickname.length > 12) {
      setError("닉네임은 12자 이내로 입력해주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: g, error: ge } = await supabase().from("quiz_games").select("*").eq("pin", pin).single();
      if (ge || !g) throw new Error("게임을 찾을 수 없습니다. PIN을 확인해주세요.");
      const ng = g as QuizGame;
      if (ng.status === "finished") throw new Error("이미 종료된 게임입니다.");
      const { data: p, error: pe } = await supabase()
        .from("quiz_players")
        .insert({ game_id: ng.id, nickname })
        .select()
        .single();
      if (pe) {
        const code = (pe as { code?: string }).code;
        if (code === "23505" || String(pe.message ?? "").includes("duplicate")) {
          throw new Error("이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.");
        }
        throw pe;
      }
      const pid = (p as QuizPlayer).id;
      setPlayerId(pid);
      try {
        sessionStorage.setItem("quizSession", JSON.stringify({ pin, playerId: pid }));
      } catch {
        /* 무시 */
      }
      subscribe(pin);
      applyGameState(ng);
      await loadPlayers(ng.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "입장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const answer = async (choice: number) => {
    const g = gameRef.current;
    const pid = playerIdRef.current;
    if (!g || !pid || myAnswer !== null || busy) return;
    if (remainingSec(g.question_started_at) <= 0) {
      setError("시간이 종료되었습니다.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase().from("quiz_answers").insert({
        game_id: g.id,
        player_id: pid,
        question_index: g.question_index,
        choice_index: choice,
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (code === "23505") {
          setMyAnswer(choice); // 이미 답변됨 → 답변 완료로 처리
          return;
        }
        throw error;
      }
      setMyAnswer(choice);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "답변 전송에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const q = game ? QUESTIONS[game.question_index] : null;
  const timeUp = screen === "question" && timeLeft <= 0 && myAnswer === null;

  return (
    <main className="min-h-screen bg-ink px-4 py-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-muted hover:text-white text-sm">
            ← 처음으로
          </Link>
          {game && <span className="text-muted text-sm">PIN {game.pin}</span>}
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-kahootRed/20 border border-kahootRed text-white">
            ⚠️ {error}
          </div>
        )}

        {screen === "join" && (
          <div className="pt-10">
            <h1 className="text-4xl font-black text-center mb-8">📱 게임 참가</h1>
            <div className="bg-card border border-line rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-muted font-semibold mb-2">게임 PIN (6자리)</label>
                <input
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  className="w-full px-4 py-4 rounded-xl bg-ink border border-line text-center text-3xl font-black tracking-[0.3em] text-white placeholder:text-muted/40"
                />
              </div>
              <div>
                <label className="block text-muted font-semibold mb-2">닉네임</label>
                <input
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value.slice(0, 12))}
                  placeholder="화면에 표시될 이름"
                  maxLength={12}
                  className="w-full px-4 py-4 rounded-xl bg-ink border border-line text-center text-2xl font-bold text-white placeholder:text-muted/40"
                />
              </div>
              <button
                onClick={join}
                disabled={busy}
                className="w-full px-8 py-4 rounded-2xl bg-kahootGreen text-white text-2xl font-bold hover:brightness-110 active:scale-95 transition disabled:opacity-50"
              >
                {busy ? "입장 중…" : "입장하기"}
              </button>
            </div>
          </div>
        )}

        {screen === "lobby" && (
          <div className="text-center pt-16">
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-3xl font-black mb-2">대기 중…</h1>
            <p className="text-muted text-lg">
              참가자 <span className="text-white font-bold">{players.length}명</span> · 곧 시작합니다!
            </p>
          </div>
        )}

        {screen === "question" && game && q && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted font-bold">
                문제 {game.question_index + 1} / {QUESTIONS.length}
              </span>
              <span
                className={`text-4xl font-black tabular-nums ${timeLeft <= 5 ? "text-kahootRed animate-pulse" : "text-kahootYellow"}`}
              >
                {timeLeft}
              </span>
            </div>
            <h2 className="text-xl font-black mb-5 leading-snug">{q.question}</h2>
            {myAnswer === null && !timeUp ? (
              <div className="grid grid-cols-1 gap-3">
                {q.choices.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => void answer(i)}
                    disabled={busy}
                    className={`${CHOICE_COLORS[i]} rounded-2xl p-5 flex items-center gap-4 text-left active:scale-95 transition hover:brightness-110 disabled:opacity-70 min-h-[76px]`}
                  >
                    <span className="text-3xl shrink-0">{CHOICE_SHAPES[i]}</span>
                    <span className="text-lg font-bold text-white">{c}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center pt-10">
                {timeUp ? (
                  <>
                    <div className="text-6xl mb-4">⏰</div>
                    <p className="text-2xl font-black">시간 종료!</p>
                    <p className="text-muted mt-2">다음 문제에서 만나요</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">✅</div>
                    <p className="text-2xl font-black">답변 완료!</p>
                    <p className="text-muted mt-2">결과 대기 중…</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {screen === "reveal" && game && q && (
          <div>
            <div
              className={`text-center rounded-2xl p-6 mb-4 ${myCorrect ? "bg-kahootGreen/20 border-2 border-kahootGreen" : "bg-kahootRed/20 border-2 border-kahootRed"}`}
            >
              <div className="text-5xl mb-2">{myCorrect ? "🎯" : "😅"}</div>
              <p className="text-2xl font-black">{myCorrect ? `정답! +${myPoints.toLocaleString()}점` : "오답"}</p>
              <p className="text-muted mt-1">
                정답: <span className="text-white font-bold">{q.choices[q.answerIndex]}</span>
              </p>
            </div>
            <div className="flex justify-center gap-6 mb-6 text-center">
              <div className="bg-card border border-line rounded-xl px-6 py-3">
                <p className="text-muted text-sm">내 점수</p>
                <p className="text-2xl font-black text-kahootYellow">{myScore.toLocaleString()}</p>
              </div>
              <div className="bg-card border border-line rounded-xl px-6 py-3">
                <p className="text-muted text-sm">내 순위</p>
                <p className="text-2xl font-black">{myRank ? `${myRank}위` : "-"}</p>
              </div>
            </div>
            <h3 className="text-xl font-black mb-3">🏆 Top 10</h3>
            <MiniLeaderboard players={players} highlightId={playerId ?? undefined} />
          </div>
        )}

        {screen === "finished" && (
          <div>
            <h1 className="text-4xl font-black text-center mb-2">🎉 최종 결과 🎉</h1>
            {myRank && (
              <p className="text-center text-xl mb-6">
                내 최종 순위: <span className="font-black text-kahootYellow">{myRank}위</span> ({myScore.toLocaleString()}점)
              </p>
            )}
            <MiniLeaderboard players={players} highlightId={playerId ?? undefined} />
          </div>
        )}
      </div>
    </main>
  );
}
