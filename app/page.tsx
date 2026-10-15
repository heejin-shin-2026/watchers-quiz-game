import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-ink">
      <div className="text-center max-w-2xl">
        <p className="text-kahootYellow font-bold tracking-widest text-sm mb-4">
          WATCHERS 개강총회
        </p>
        <h1 className="text-5xl md:text-7xl font-black mb-4">
          실시간 <span className="text-kahootRed">퀴</span>
          <span className="text-kahootBlue">즈</span> 게임
        </h1>
        <p className="text-muted text-lg mb-12">
          2026년 핫한 투자·경제 토픽 10문제 · 1~10위 실시간 리더보드
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/host"
            className="px-10 py-5 rounded-2xl bg-kahootBlue text-white text-2xl font-bold hover:brightness-110 active:scale-95 transition"
          >
            🎤 진행자로 시작
          </Link>
          <Link
            href="/play"
            className="px-10 py-5 rounded-2xl bg-kahootGreen text-white text-2xl font-bold hover:brightness-110 active:scale-95 transition"
          >
            📱 참가하기
          </Link>
        </div>
      </div>
      <footer className="absolute bottom-6 text-muted text-sm">
        Watchers · 2026-10-17 개강총회
      </footer>
    </main>
  );
}
