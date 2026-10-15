-- Watchers 실시간 퀴즈 게임 — Supabase 마이그레이션
-- Supabase Dashboard > SQL Editor에서 service_role로 실행하세요.

-- 1. 게임
create table if not exists quiz_games (
  id uuid primary key default gen_random_uuid(),
  pin text unique not null,
  status text not null default 'lobby' check (status in ('lobby','question','reveal','finished')),
  question_index int not null default 0,
  question_started_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_quiz_games_pin on quiz_games(pin);

-- 2. 참가자
create table if not exists quiz_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references quiz_games(id) on delete cascade,
  nickname text not null,
  score int not null default 0,
  joined_at timestamptz not null default now(),
  unique(game_id, nickname)
);
create index if not exists idx_quiz_players_game on quiz_players(game_id);

-- 3. 답변
create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references quiz_games(id) on delete cascade,
  player_id uuid not null references quiz_players(id) on delete cascade,
  question_index int not null,
  choice_index int not null,
  answered_at timestamptz not null default now(),
  is_correct boolean not null default false,
  points int not null default 0,
  unique(game_id, player_id, question_index)
);
create index if not exists idx_quiz_answers_game_q on quiz_answers(game_id, question_index);

-- RLS: 단기 라이브 이벤트용으로 anon 키에 SELECT/INSERT/UPDATE 허용 (DELETE는 차단)
alter table quiz_games enable row level security;
alter table quiz_players enable row level security;
alter table quiz_answers enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'quiz anon select' and tablename = 'quiz_games') then
    create policy "quiz anon select" on quiz_games for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'quiz anon insert' and tablename = 'quiz_games') then
    create policy "quiz anon insert" on quiz_games for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'quiz anon update' and tablename = 'quiz_games') then
    create policy "quiz anon update" on quiz_games for update to anon using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'quiz anon select' and tablename = 'quiz_players') then
    create policy "quiz anon select" on quiz_players for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'quiz anon insert' and tablename = 'quiz_players') then
    create policy "quiz anon insert" on quiz_players for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'quiz anon update' and tablename = 'quiz_players') then
    create policy "quiz anon update" on quiz_players for update to anon using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'quiz anon select' and tablename = 'quiz_answers') then
    create policy "quiz anon select" on quiz_answers for select to anon using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'quiz anon insert' and tablename = 'quiz_answers') then
    create policy "quiz anon insert" on quiz_answers for insert to anon with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'quiz anon update' and tablename = 'quiz_answers') then
    create policy "quiz anon update" on quiz_answers for update to anon using (true) with check (true);
  end if;
end $$;
