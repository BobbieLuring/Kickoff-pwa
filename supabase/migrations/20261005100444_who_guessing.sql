-- Vem svarade?: gissningar, resultat och poäng när aktiviteten avslutas.

-- En gissning per spelare och svar. Hemligt: nås bara via funktioner.
create table public.who_guesses (
  answer_id uuid not null references public.who_answers on delete cascade,
  guesser_id uuid not null references public.players on delete cascade,
  guessed_player_id uuid not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, guesser_id)
);

alter table public.who_guesses enable row level security;

-- Vad Svara-fliken ska visa, per fas.
--   answering: frågorna med anroparens egna svar.
--   guessing:  andras svar utan författare, i en ordning som är fast per spelare, och vem man kan gissa på.
--   finished:  alla svar med författare, anroparens gissning och om den var rätt.
create or replace function public.who_player_state()
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

  v_phase := public.section_phase(v_player.room_id, 'who');

  if v_phase = 'answering' then
    return json_build_object(
      'phase', v_phase,
      'questions', coalesce((
        select json_agg(
          json_build_object('id', q.id, 'text', q.text, 'my_answer', a.text)
          order by q.created_at
        )
        from public.who_questions q
        left join public.who_answers a on a.question_id = q.id and a.player_id = v_player.id
        where q.room_id = v_player.room_id
      ), '[]'::json)
    );
  end if;

  if v_phase = 'guessing' then
    return json_build_object(
      'phase', v_phase,
      'cards', coalesce((
        select json_agg(
          json_build_object(
            'answer_id', a.id,
            'question', q.text,
            'text', a.text,
            'my_guess', g.guessed_player_id
          )
          -- Blandad ordning, men samma för spelaren varje gång sidan laddas.
          order by md5(a.id::text || v_player.id::text)
        )
        from public.who_answers a
        join public.who_questions q on q.id = a.question_id
        left join public.who_guesses g on g.answer_id = a.id and g.guesser_id = v_player.id
        where q.room_id = v_player.room_id and a.player_id <> v_player.id
      ), '[]'::json),
      -- De man kan gissa på: alla som har svarat, utom en själv.
      'players', coalesce((
        select json_agg(json_build_object('id', p.id, 'username', p.username) order by lower(p.username))
        from public.players p
        where p.room_id = v_player.room_id and p.id <> v_player.id
          and exists (
            select 1 from public.who_answers a
            join public.who_questions q on q.id = a.question_id
            where a.player_id = p.id and q.room_id = v_player.room_id
          )
      ), '[]'::json)
    );
  end if;

  if v_phase = 'finished' then
    return json_build_object(
      'phase', v_phase,
      'results', coalesce((
        select json_agg(
          json_build_object(
            'question', q.text,
            'text', a.text,
            'author', author.username,
            'mine', a.player_id = v_player.id,
            'my_guess', guessed.username,
            'correct', g.guessed_player_id = a.player_id
          )
          order by q.created_at, lower(author.username)
        )
        from public.who_answers a
        join public.who_questions q on q.id = a.question_id
        join public.players author on author.id = a.player_id
        left join public.who_guesses g on g.answer_id = a.id and g.guesser_id = v_player.id
        left join public.players guessed on guessed.id = g.guessed_player_id
        where q.room_id = v_player.room_id
      ), '[]'::json),
      'my_points', coalesce((
        select sum(points) from public.point_awards
        where player_id = v_player.id and section = 'who'
      ), 0)
    );
  end if;

  return json_build_object('phase', v_phase);
end;
$$;

-- Sparar eller ändrar anroparens gissning på ett svar, så länge gissningen pågår.
create function public.who_submit_guess(p_answer_id uuid, p_guessed_player_id uuid)
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

  if public.section_phase(v_player.room_id, 'who') <> 'guessing' then
    return json_build_object('ok', false, 'error', 'not_guessing');
  end if;

  -- Svaret måste finnas i rummet och vara någon annans.
  if not exists (
    select 1 from public.who_answers a
    join public.who_questions q on q.id = a.question_id
    where a.id = p_answer_id and q.room_id = v_player.room_id and a.player_id <> v_player.id
  ) then
    return json_build_object('ok', false, 'error', 'unknown_answer');
  end if;

  -- Man gissar på en annan spelare i samma rum.
  if p_guessed_player_id = v_player.id or not exists (
    select 1 from public.players where id = p_guessed_player_id and room_id = v_player.room_id
  ) then
    return json_build_object('ok', false, 'error', 'unknown_player');
  end if;

  insert into public.who_guesses (answer_id, guesser_id, guessed_player_id)
  values (p_answer_id, v_player.id, p_guessed_player_id)
  on conflict (answer_id, guesser_id) do update
    set guessed_player_id = excluded.guessed_player_id, created_at = now();

  return json_build_object('ok', true);
end;
$$;

-- 10 poäng per rätt gissning. Anropas bara från advance_section, när 'who' går till 'finished'.
create function public.who_award_points(p_room_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.point_awards (room_id, player_id, section, points)
  select p_room_id, g.guesser_id, 'who', 10 * count(*)
  from public.who_guesses g
  join public.who_answers a on a.id = g.answer_id
  join public.who_questions q on q.id = a.question_id
  where q.room_id = p_room_id and g.guessed_player_id = a.player_id
  group by g.guesser_id;
$$;

revoke execute on function public.who_award_points(uuid) from public, anon, authenticated;

-- Som tidigare, men delar även ut poängen när en aktivitet avslutas.
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
  if p_key = 'who' and v_next = 'finished' then
    perform public.who_award_points(v_player.room_id);
  end if;

  return json_build_object('ok', true, 'phase', v_next);
end;
$$;

revoke execute on function public.who_submit_guess(uuid, uuid) from public, anon;
grant execute on function public.who_submit_guess(uuid, uuid) to authenticated;