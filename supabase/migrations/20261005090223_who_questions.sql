-- Vem svarade?: frågor, svar och adminfunktioner för frågorna.

create table public.who_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  text text not null check (length(trim(text)) between 1 and 200),
  created_at timestamptz not null default now()
);

create index on public.who_questions (room_id, created_at);

alter table public.who_questions enable row level security;

-- Ett svar per spelare och fråga. Hemligt: nås bara via funktioner.
create table public.who_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.who_questions on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  text text not null check (length(trim(text)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (question_id, player_id)
);

alter table public.who_answers enable row level security;

-- Anroparens admin-spelare, annars fel. Hjälpfunktion för adminfunktionerna.
create function public.require_admin_player()
returns public.players
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
begin
  if v_player.id is null or v_player.admin_user_id is distinct from auth.uid() then
    raise exception 'not admin' using errcode = '42501';
  end if;
  return v_player;
end;
$$;

-- Fasen för en aktivitet i ett rum ('closed' om raden saknas).
create function public.section_phase(p_room_id uuid, p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select phase from public.sections where room_id = p_room_id and key = p_key),
    'closed'
  );
$$;

revoke execute on function public.require_admin_player() from public, anon, authenticated;
revoke execute on function public.section_phase(uuid, text) from public, anon, authenticated;

-- Admin: översikt för adminfliken. Visar frågorna och hur många som svarat, aldrig svaren.
create function public.who_admin_overview()
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
  select count(*) into v_question_count from public.who_questions where room_id = v_admin.room_id;

  return json_build_object(
    'phase', public.section_phase(v_admin.room_id, 'who'),
    'questions', coalesce((
      select json_agg(json_build_object('id', id, 'text', text) order by created_at)
      from public.who_questions where room_id = v_admin.room_id
    ), '[]'::json),
    'player_count', (select count(*) from public.players where room_id = v_admin.room_id),
    -- Spelare som svarat på alla frågor.
    'answered_count', (
      select count(*) from (
        select a.player_id
        from public.who_answers a
        join public.who_questions q on q.id = a.question_id
        where q.room_id = v_admin.room_id
        group by a.player_id
        having count(*) = v_question_count
      ) done
    )
  );
end;
$$;

-- Admin: lägger till en fråga. Bara innan aktiviteten öppnats.
create function public.who_add_question(p_text text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.players := public.require_admin_player();
  v_text text := trim(p_text);
begin
  if public.section_phase(v_admin.room_id, 'who') <> 'closed' then
    return json_build_object('ok', false, 'error', 'already_open');
  end if;

  if v_text is null or length(v_text) not between 1 and 200 then
    return json_build_object('ok', false, 'error', 'invalid_text');
  end if;

  insert into public.who_questions (room_id, text) values (v_admin.room_id, v_text);
  return json_build_object('ok', true);
end;
$$;

-- Admin: tar bort en fråga. Bara innan aktiviteten öppnats.
create function public.who_delete_question(p_question_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.players := public.require_admin_player();
begin
  if public.section_phase(v_admin.room_id, 'who') <> 'closed' then
    return json_build_object('ok', false, 'error', 'already_open');
  end if;

  delete from public.who_questions where id = p_question_id and room_id = v_admin.room_id;
  return json_build_object('ok', true);
end;
$$;

revoke execute on function public.who_admin_overview() from public, anon;
revoke execute on function public.who_add_question(text) from public, anon;
revoke execute on function public.who_delete_question(uuid) from public, anon;
grant execute on function public.who_admin_overview() to authenticated;
grant execute on function public.who_add_question(text) to authenticated;
grant execute on function public.who_delete_question(uuid) to authenticated;