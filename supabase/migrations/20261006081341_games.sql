-- Highscorespelen Flyg, Plattor och Pricka: poängtabell, topplista per spel och poäng efter placering
-- när admin avslutar ett spel.

-- Varje spelomgång. Spelarens bästa resultat är det som räknas.
create table public.game_scores (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  game text not null check (game in ('flyg', 'plattor', 'pricka')),
  score int not null check (score between 0 and 100000),
  created_at timestamptz not null default now()
);

create index on public.game_scores (room_id, game);

alter table public.game_scores enable row level security;

-- Som tidigare, plus faserna för de tre spelen.
create or replace function public.section_phases(p_key text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_key = 'who' then array['closed', 'answering', 'guessing', 'finished']
    when p_key in ('flyg', 'plattor', 'pricka') then array['closed', 'open', 'finished']
  end;
$$;

-- Poäng per placering. Preliminära värden, justeras när alla aktiviteter finns.
create function public.game_rank_points(p_rank int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case p_rank
    when 1 then 20 when 2 then 16 when 3 then 13 when 4 then 10 when 5 then 8
    when 6 then 6 when 7 then 4 when 8 then 3 when 9 then 2
    else 1
  end;
$$;

-- Spelarnas bästa resultat i ett spel, med placering. Lika resultat ger samma placering.
create function public.game_ranking(p_room_id uuid, p_game text)
returns table (player_id uuid, best int, rank int)
language sql
stable
security definer
set search_path = ''
as $$
  select s.player_id, max(s.score), (rank() over (order by max(s.score) desc))::int
  from public.game_scores s
  where s.room_id = p_room_id and s.game = p_game
  group by s.player_id;
$$;

-- Delar ut poäng efter placering. Anropas bara från advance_section när ett spel avslutas.
create function public.game_award_points(p_room_id uuid, p_game text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.point_awards (room_id, player_id, section, points)
  select p_room_id, r.player_id, p_game, public.game_rank_points(r.rank)
  from public.game_ranking(p_room_id, p_game) r;
$$;

revoke execute on function public.game_rank_points(int) from public, anon, authenticated;
revoke execute on function public.game_ranking(uuid, text) from public, anon, authenticated;
revoke execute on function public.game_award_points(uuid, text) from public, anon, authenticated;

-- Som tidigare, plus poäng efter placering när ett spel avslutas.
create or replace function public.advance_section(p_key text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_phases text[] := public.section_phases(p_key);
  v_current text;
  v_next text;
begin
  if v_player.id is null or v_player.admin_user_id is distinct from auth.uid() then
    raise exception 'not admin' using errcode = '42501';
  end if;

  if v_phases is null then
    return json_build_object('ok', false, 'error', 'unknown_section');
  end if;

  select phase into v_current
  from public.sections
  where room_id = v_player.room_id and key = p_key
  for update;

  v_current := coalesce(v_current, v_phases[1]);
  v_next := v_phases[array_position(v_phases, v_current) + 1];

  if v_next is null then
    return json_build_object('ok', false, 'error', 'already_finished');
  end if;

  insert into public.sections (room_id, key, phase)
  values (v_player.room_id, p_key, v_next)
  on conflict (room_id, key) do update set phase = excluded.phase, updated_at = now();

  -- Poäng delas ut i samma transaktion som fasbytet: antingen båda eller inget.
  if v_next = 'finished' then
    if p_key = 'who' then
      perform public.who_award_points(v_player.room_id);
    elsif p_key in ('flyg', 'plattor', 'pricka') then
      perform public.game_award_points(v_player.room_id, p_key);
    end if;
  end if;

  return json_build_object('ok', true, 'phase', v_next);
end;
$$;

-- Sparar en spelomgång, så länge spelet är öppet.
create function public.game_submit_score(p_game text, p_score int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  if p_game not in ('flyg', 'plattor', 'pricka') then
    return json_build_object('ok', false, 'error', 'unknown_game');
  end if;

  if public.section_phase(v_player.room_id, p_game) <> 'open' then
    return json_build_object('ok', false, 'error', 'not_open');
  end if;

  if p_score is null or p_score not between 0 and 100000 then
    return json_build_object('ok', false, 'error', 'invalid_score');
  end if;

  insert into public.game_scores (room_id, player_id, game, score)
  values (v_player.room_id, v_player.id, p_game, p_score);

  return json_build_object('ok', true);
end;
$$;

-- Ett spels fas och topplista i anroparens rum. Efter avslut även poängen per placering.
create function public.game_state(p_game text)
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_phase text;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  if p_game not in ('flyg', 'plattor', 'pricka') then
    return json_build_object('error', 'unknown_game');
  end if;

  v_phase := public.section_phase(v_player.room_id, p_game);

  return json_build_object(
    'phase', v_phase,
    'my_player_id', v_player.id,
    'highscores', coalesce((
      select json_agg(
        json_build_object(
          'player_id', r.player_id,
          'username', p.username,
          'best', r.best,
          'rank', r.rank,
          'points', case when v_phase = 'finished' then public.game_rank_points(r.rank) end
        )
        order by r.rank, lower(p.username)
      )
      from public.game_ranking(v_player.room_id, p_game) r
      join public.players p on p.id = r.player_id
    ), '[]'::json)
  );
end;
$$;

-- Admin: de tre spelens fas och hur många som har spelat.
create function public.admin_games()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin public.players := public.require_admin_player();
begin
  return json_build_object(
    'player_count', (select count(*) from public.players where room_id = v_admin.room_id),
    'games', (
      select json_agg(
        json_build_object(
          'key', g.key,
          'phase', public.section_phase(v_admin.room_id, g.key),
          'played_count', (
            select count(distinct s.player_id) from public.game_scores s
            where s.room_id = v_admin.room_id and s.game = g.key
          )
        )
        order by g.ord
      )
      from unnest(array['flyg', 'plattor', 'pricka']) with ordinality as g (key, ord)
    )
  );
end;
$$;

revoke execute on function public.game_submit_score(text, int) from public, anon;
revoke execute on function public.game_state(text) from public, anon;
revoke execute on function public.admin_games() from public, anon;
grant execute on function public.game_submit_score(text, int) to authenticated;
grant execute on function public.game_state(text) to authenticated;
grant execute on function public.admin_games() to authenticated;