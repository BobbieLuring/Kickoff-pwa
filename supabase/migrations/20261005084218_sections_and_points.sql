-- Aktiviteter per rum med fas, och poängtabellen som topplistan räknar från.

-- Fasen för varje aktivitet i ett rum. Saknas raden är aktiviteten 'closed'.
create table public.sections (
  room_id uuid not null references public.rooms on delete cascade,
  key text not null,
  phase text not null,
  updated_at timestamptz not null default now(),
  primary key (room_id, key)
);

alter table public.sections enable row level security;

-- Varje poängutdelning. Topplistan är summan per spelare.
create table public.point_awards (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  section text not null,
  points int not null,
  created_at timestamptz not null default now()
);

create index on public.point_awards (room_id);

alter table public.point_awards enable row level security;

-- Faserna varje aktivitet går igenom, i ordning. Nya aktiviteter läggs till här.
create function public.section_phases(p_key text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_key
    when 'who' then array['closed', 'answering', 'guessing', 'finished']
  end;
$$;

-- Spelaren som är inloggad på anroparens session, eller null.
create function public.my_player()
returns public.players
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.players where user_id = auth.uid();
$$;

-- Hjälpfunktionerna anropas bara från andra funktioner, aldrig från appen.
revoke execute on function public.section_phases(text) from public, anon, authenticated;
revoke execute on function public.my_player() from public, anon, authenticated;

-- Faserna för alla aktiviteter i anroparens rum.
create function public.room_sections()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  return coalesce((
    select json_object_agg(key, phase) from public.sections where room_id = v_player.room_id
  ), '{}'::json);
end;
$$;

-- Admin flyttar en aktivitet ett steg framåt i sitt rum. Bara framåt, ett steg i taget,
-- så att poäng aldrig delas ut två gånger.
create function public.advance_section(p_key text)
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

  return json_build_object('ok', true, 'phase', v_next);
end;
$$;

revoke execute on function public.room_sections() from public, anon;
revoke execute on function public.advance_section(text) from public, anon;
grant execute on function public.room_sections() to authenticated;
grant execute on function public.advance_section(text) to authenticated;

-- Rummet anroparen är inloggad i. Används av policies, därför körbar för inloggade.
create function public.my_room_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select room_id from public.players where user_id = auth.uid();
$$;

revoke execute on function public.my_room_id() from public, anon;
grant execute on function public.my_room_id() to authenticated;

-- Poäng är inte hemliga: spelare får läsa poängen i sitt eget rum (behövs även för Realtime).
-- Ingen policy för att skriva: poäng delas bara ut av funktioner.
create policy "players read points in own room"
  on public.point_awards for select
  to authenticated
  using (room_id = public.my_room_id());