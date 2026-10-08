-- Quiz: redaktören skriver frågor med tre alternativ (A/B/C). Spelarna svarar i egen takt och kan
-- ändra tills värden stänger. 10 poäng per rätt svar.

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  text text not null check (length(trim(text)) between 1 and 200),
  option_a text not null check (length(trim(option_a)) between 1 and 100),
  option_b text not null check (length(trim(option_b)) between 1 and 100),
  option_c text not null check (length(trim(option_c)) between 1 and 100),
  correct text not null check (correct in ('a', 'b', 'c')),
  created_at timestamptz not null default now()
);

create index on public.quiz_questions (room_id, created_at);

-- Hemligt: rätt svar får inte nå spelarna förrän quizet är avslutat. Nås bara via funktioner.
alter table public.quiz_questions enable row level security;

create table public.quiz_answers (
  question_id uuid not null references public.quiz_questions on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  choice text not null check (choice in ('a', 'b', 'c')),
  updated_at timestamptz not null default now(),
  primary key (question_id, player_id)
);

alter table public.quiz_answers enable row level security;

-- ── Faser och poäng ─────────────────────────────────────────────────────────

create or replace function public.section_phases(p_key text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when p_key = 'who' then array['closed', 'answering', 'guessing', 'finished']
    when p_key = 'photo' then array['closed', 'uploading', 'guessing', 'finished']
    when p_key = 'missions' then array['closed', 'open', 'revealed']
    when p_key = 'quiz' then array['closed', 'open', 'finished']
    when p_key in ('flyg', 'plattor', 'pricka') then array['closed', 'open', 'finished']
  end;
$$;

-- 10 poäng per rätt svar. Anropas bara från advance_section när 'quiz' avslutas.
create function public.quiz_award_points(p_room_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.point_awards (room_id, player_id, section, points)
  select p_room_id, a.player_id, 'quiz', 10 * count(*)
  from public.quiz_answers a
  join public.quiz_questions q on q.id = a.question_id
  where q.room_id = p_room_id and a.choice = q.correct
  group by a.player_id;
$$;

revoke execute on function public.quiz_award_points(uuid) from public, anon, authenticated;

-- Som tidigare, plus poäng för quizet.
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
    elsif p_key = 'photo' then
      perform public.photo_award_points(v_player.room_id);
    elsif p_key = 'quiz' then
      perform public.quiz_award_points(v_player.room_id);
    elsif p_key in ('flyg', 'plattor', 'pricka') then
      perform public.game_award_points(v_player.room_id, p_key);
    end if;
  end if;

  return json_build_object('ok', true, 'phase', v_next);
end;
$$;

-- ── Redaktör ────────────────────────────────────────────────────────────────

-- Redaktörens frågor med rätt svar, och om de fortfarande går att ändra.
create function public.editor_quiz()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room_id uuid := public.my_editor_room_id();
begin
  if v_room_id is null then
    raise exception 'not editor' using errcode = '42501';
  end if;

  return json_build_object(
    'editable', public.section_phase(v_room_id, 'quiz') = 'closed',
    'questions', coalesce((
      select json_agg(
        json_build_object(
          'id', id, 'text', text,
          'option_a', option_a, 'option_b', option_b, 'option_c', option_c,
          'correct', correct
        )
        order by created_at
      )
      from public.quiz_questions where room_id = v_room_id
    ), '[]'::json)
  );
end;
$$;

-- Lägger till (p_question_id null) eller ändrar en fråga. Bara innan värden öppnat quizet.
create function public.editor_save_quiz_question(
  p_question_id uuid, p_text text, p_option_a text, p_option_b text, p_option_c text, p_correct text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid := public.my_editor_room_id();
begin
  if v_room_id is null then
    raise exception 'not editor' using errcode = '42501';
  end if;

  if public.section_phase(v_room_id, 'quiz') <> 'closed' then
    return json_build_object('ok', false, 'error', 'not_editable');
  end if;

  if length(trim(coalesce(p_text, ''))) not between 1 and 200 then
    return json_build_object('ok', false, 'error', 'invalid_text');
  end if;

  if length(trim(coalesce(p_option_a, ''))) not between 1 and 100
     or length(trim(coalesce(p_option_b, ''))) not between 1 and 100
     or length(trim(coalesce(p_option_c, ''))) not between 1 and 100 then
    return json_build_object('ok', false, 'error', 'invalid_option');
  end if;

  if p_correct not in ('a', 'b', 'c') then
    return json_build_object('ok', false, 'error', 'invalid_correct');
  end if;

  if p_question_id is null then
    insert into public.quiz_questions (room_id, text, option_a, option_b, option_c, correct)
    values (v_room_id, trim(p_text), trim(p_option_a), trim(p_option_b), trim(p_option_c), p_correct);
  else
    update public.quiz_questions
    set text = trim(p_text), option_a = trim(p_option_a), option_b = trim(p_option_b),
        option_c = trim(p_option_c), correct = p_correct
    where id = p_question_id and room_id = v_room_id;
    if not found then
      return json_build_object('ok', false, 'error', 'unknown_question');
    end if;
  end if;

  return json_build_object('ok', true);
end;
$$;

-- Tar bort en fråga. Bara innan värden öppnat quizet.
create function public.editor_delete_quiz_question(p_question_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid := public.my_editor_room_id();
begin
  if v_room_id is null then
    raise exception 'not editor' using errcode = '42501';
  end if;

  if public.section_phase(v_room_id, 'quiz') <> 'closed' then
    return json_build_object('ok', false, 'error', 'not_editable');
  end if;

  delete from public.quiz_questions where id = p_question_id and room_id = v_room_id;
  return json_build_object('ok', true);
end;
$$;

-- ── Spelare ─────────────────────────────────────────────────────────────────

-- Vad Quiz-sidan ska visa, per fas.
--   open:     frågorna med alternativ och anroparens svar. Aldrig rätt svar.
--   finished: frågorna med rätt svar och anroparens svar, plus allas poäng.
create function public.quiz_player_state()
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

  v_phase := public.section_phase(v_player.room_id, 'quiz');

  if v_phase = 'open' then
    return json_build_object(
      'phase', v_phase,
      'questions', coalesce((
        select json_agg(
          json_build_object(
            'id', q.id, 'text', q.text,
            'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c,
            'my_choice', a.choice
          )
          order by q.created_at
        )
        from public.quiz_questions q
        left join public.quiz_answers a on a.question_id = q.id and a.player_id = v_player.id
        where q.room_id = v_player.room_id
      ), '[]'::json)
    );
  end if;

  if v_phase = 'finished' then
    return json_build_object(
      'phase', v_phase,
      'my_player_id', v_player.id,
      'my_points', coalesce((
        select sum(points) from public.point_awards where player_id = v_player.id and section = 'quiz'
      ), 0),
      'questions', coalesce((
        select json_agg(
          json_build_object(
            'id', q.id, 'text', q.text,
            'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c,
            'correct', q.correct,
            'my_choice', a.choice
          )
          order by q.created_at
        )
        from public.quiz_questions q
        left join public.quiz_answers a on a.question_id = q.id and a.player_id = v_player.id
        where q.room_id = v_player.room_id
      ), '[]'::json),
      'scores', coalesce((
        select json_agg(
          json_build_object('player_id', s.id, 'username', s.username, 'points', s.points, 'rank', s.rank)
          order by s.rank, lower(s.username)
        )
        from (
          select p.id, p.username, coalesce(sum(pa.points), 0) as points,
                 rank() over (order by coalesce(sum(pa.points), 0) desc) as rank
          from public.players p
          left join public.point_awards pa on pa.player_id = p.id and pa.section = 'quiz'
          where p.room_id = v_player.room_id
          group by p.id, p.username
        ) s
      ), '[]'::json)
    );
  end if;

  return json_build_object('phase', v_phase);
end;
$$;

-- Sparar eller ändrar anroparens svar på en fråga, så länge quizet är öppet.
create function public.quiz_submit_answer(p_question_id uuid, p_choice text)
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

  if public.section_phase(v_player.room_id, 'quiz') <> 'open' then
    return json_build_object('ok', false, 'error', 'not_open');
  end if;

  if p_choice not in ('a', 'b', 'c') then
    return json_build_object('ok', false, 'error', 'invalid_choice');
  end if;

  if not exists (
    select 1 from public.quiz_questions where id = p_question_id and room_id = v_player.room_id
  ) then
    return json_build_object('ok', false, 'error', 'unknown_question');
  end if;

  insert into public.quiz_answers (question_id, player_id, choice)
  values (p_question_id, v_player.id, p_choice)
  on conflict (question_id, player_id) do update set choice = excluded.choice, updated_at = now();

  return json_build_object('ok', true);
end;
$$;

-- ── Admin ───────────────────────────────────────────────────────────────────

-- Fas, antal frågor och hur många som svarat på alla. Aldrig frågorna eller svaren.
create function public.quiz_admin_overview()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin public.players := public.require_admin_player();
  v_question_count int;
begin
  select count(*) into v_question_count from public.quiz_questions where room_id = v_admin.room_id;

  return json_build_object(
    'phase', public.section_phase(v_admin.room_id, 'quiz'),
    'question_count', v_question_count,
    'player_count', (select count(*) from public.players where room_id = v_admin.room_id),
    'answered_count', (
      select count(*) from (
        select a.player_id
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
        where q.room_id = v_admin.room_id
        group by a.player_id
        having count(*) = v_question_count
      ) done
    )
  );
end;
$$;

revoke execute on function public.editor_quiz() from public, anon;
revoke execute on function public.editor_save_quiz_question(uuid, text, text, text, text, text) from public, anon;
revoke execute on function public.editor_delete_quiz_question(uuid) from public, anon;
revoke execute on function public.quiz_player_state() from public, anon;
revoke execute on function public.quiz_submit_answer(uuid, text) from public, anon;
revoke execute on function public.quiz_admin_overview() from public, anon;
grant execute on function public.editor_quiz() to authenticated;
grant execute on function public.editor_save_quiz_question(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.editor_delete_quiz_question(uuid) to authenticated;
grant execute on function public.quiz_player_state() to authenticated;
grant execute on function public.quiz_submit_answer(uuid, text) to authenticated;
grant execute on function public.quiz_admin_overview() to authenticated;