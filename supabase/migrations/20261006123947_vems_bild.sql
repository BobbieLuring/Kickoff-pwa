-- Vems bild?: varje spelare laddar upp en bild en gång, sedan gissar alla vem som laddade upp vilken.
-- Bilderna ligger i en privat Storage-bucket med slumpade filnamn; kopplingen till ägaren är hemlig.

-- Privat bucket. Appen krymper bilderna till JPEG innan uppladdning; 1 MB är en säkerhetsgräns.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 1048576, array['image/jpeg']);

-- En rad per spelare: vilken fil som är spelarens. Skapas när spelaren ska ladda upp.
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  player_id uuid not null references public.players on delete cascade,
  path text not null unique,
  created_at timestamptz not null default now(),
  unique (room_id, player_id)
);

alter table public.photos enable row level security;

create table public.photo_guesses (
  photo_id uuid not null references public.photos on delete cascade,
  guesser_id uuid not null references public.players on delete cascade,
  guessed_player_id uuid not null references public.players on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, guesser_id)
);

alter table public.photo_guesses enable row level security;

-- Om filen till en bildrad faktiskt har laddats upp.
create function public.photo_uploaded(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from storage.objects where bucket_id = 'photos' and name = p_path);
$$;

revoke execute on function public.photo_uploaded(text) from public, anon, authenticated;

-- ── Regler för Storage ──────────────────────────────────────────────────────
-- Policies körs som spelaren, så hjälpfunktionerna måste vara körbara för inloggade.

-- Får anroparen ladda upp till den här filen? Bara sin egen reserverade fil, och bara under uppladdningen.
create function public.photo_can_upload(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.photos ph
    join public.players p on p.id = ph.player_id
    where ph.path = p_name
      and p.user_id = auth.uid()
      and public.section_phase(ph.room_id, 'photo') = 'uploading'
  );
$$;

-- Får anroparen se den här bilden? Sin egen alltid, andras i samma rum när gissningen har öppnat.
create function public.photo_can_view(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.photos ph
    join public.players me on me.user_id = auth.uid() and me.room_id = ph.room_id
    where ph.path = p_name
      and (ph.player_id = me.id
           or public.section_phase(ph.room_id, 'photo') in ('guessing', 'finished'))
  );
$$;

revoke execute on function public.photo_can_upload(text) from public, anon;
revoke execute on function public.photo_can_view(text) from public, anon;
grant execute on function public.photo_can_upload(text) to authenticated;
grant execute on function public.photo_can_view(text) to authenticated;

-- Bara insert, ingen update eller delete: en uppladdad bild kan inte bytas ut.
create policy "players upload their reserved photo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos' and public.photo_can_upload(name));

create policy "players view photos they may see"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos' and public.photo_can_view(name));

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
    when p_key in ('flyg', 'plattor', 'pricka') then array['closed', 'open', 'finished']
  end;
$$;

-- 10 poäng per rätt gissning. Anropas bara från advance_section när 'photo' avslutas.
create function public.photo_award_points(p_room_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.point_awards (room_id, player_id, section, points)
  select p_room_id, g.guesser_id, 'photo', 10 * count(*)
  from public.photo_guesses g
  join public.photos ph on ph.id = g.photo_id
  where ph.room_id = p_room_id and g.guessed_player_id = ph.player_id
  group by g.guesser_id;
$$;

revoke execute on function public.photo_award_points(uuid) from public, anon, authenticated;

-- Som tidigare, plus poäng för Vems bild?.
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
    elsif p_key in ('flyg', 'plattor', 'pricka') then
      perform public.game_award_points(v_player.room_id, p_key);
    end if;
  end if;

  return json_build_object('ok', true, 'phase', v_next);
end;
$$;

-- ── Spelare ─────────────────────────────────────────────────────────────────

-- Reserverar anroparens filnamn (en gång). Returnerar samma namn om det redan finns, så att en
-- misslyckad uppladdning kan försökas igen. Fel om bilden redan är uppladdad.
create function public.photo_reserve()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_path text;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  if public.section_phase(v_player.room_id, 'photo') <> 'uploading' then
    return json_build_object('ok', false, 'error', 'not_uploading');
  end if;

  select path into v_path from public.photos where room_id = v_player.room_id and player_id = v_player.id;

  if v_path is null then
    v_path := v_player.room_id::text || '/' || gen_random_uuid()::text || '.jpg';
    insert into public.photos (room_id, player_id, path) values (v_player.room_id, v_player.id, v_path);
  elsif public.photo_uploaded(v_path) then
    return json_build_object('ok', false, 'error', 'already_uploaded');
  end if;

  return json_build_object('ok', true, 'path', v_path);
end;
$$;

-- Vad fliken ska visa, per fas.
--   uploading: om anroparen har laddat upp, och i så fall sökvägen till den egna bilden.
--   guessing:  andras uppladdade bilder utan ägare, blandade (fast ordning per spelare), och vem man kan gissa på.
--   finished:  alla bilder med ägare, anroparens gissning och om den var rätt, plus allas poäng.
create function public.photo_player_state()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_phase text;
  v_my_path text;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  v_phase := public.section_phase(v_player.room_id, 'photo');

  if v_phase = 'uploading' then
    select path into v_my_path from public.photos
    where room_id = v_player.room_id and player_id = v_player.id;
    return json_build_object(
      'phase', v_phase,
      'my_path', case when v_my_path is not null and public.photo_uploaded(v_my_path) then v_my_path end
    );
  end if;

  if v_phase = 'guessing' then
    return json_build_object(
      'phase', v_phase,
      'cards', coalesce((
        select json_agg(
          json_build_object('photo_id', ph.id, 'path', ph.path, 'my_guess', g.guessed_player_id)
          order by md5(ph.id::text || v_player.id::text)
        )
        from public.photos ph
        left join public.photo_guesses g on g.photo_id = ph.id and g.guesser_id = v_player.id
        where ph.room_id = v_player.room_id and ph.player_id <> v_player.id
          and public.photo_uploaded(ph.path)
      ), '[]'::json),
      'players', coalesce((
        select json_agg(json_build_object('id', p.id, 'username', p.username) order by lower(p.username))
        from public.players p
        where p.room_id = v_player.room_id and p.id <> v_player.id
          and exists (
            select 1 from public.photos ph
            where ph.player_id = p.id and public.photo_uploaded(ph.path)
          )
      ), '[]'::json)
    );
  end if;

  if v_phase = 'finished' then
    return json_build_object(
      'phase', v_phase,
      'my_player_id', v_player.id,
      'my_points', coalesce((
        select sum(points) from public.point_awards where player_id = v_player.id and section = 'photo'
      ), 0),
      'results', coalesce((
        select json_agg(
          json_build_object(
            'path', ph.path,
            'owner', owner.username,
            'mine', ph.player_id = v_player.id,
            'my_guess', guessed.username,
            'correct', g.guessed_player_id = ph.player_id
          )
          order by lower(owner.username)
        )
        from public.photos ph
        join public.players owner on owner.id = ph.player_id
        left join public.photo_guesses g on g.photo_id = ph.id and g.guesser_id = v_player.id
        left join public.players guessed on guessed.id = g.guessed_player_id
        where ph.room_id = v_player.room_id and public.photo_uploaded(ph.path)
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
          left join public.point_awards pa on pa.player_id = p.id and pa.section = 'photo'
          where p.room_id = v_player.room_id
          group by p.id, p.username
        ) s
      ), '[]'::json)
    );
  end if;

  return json_build_object('phase', v_phase);
end;
$$;

-- Sparar eller ändrar anroparens gissning på en bild, så länge gissningen pågår.
create function public.photo_submit_guess(p_photo_id uuid, p_guessed_player_id uuid)
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

  if public.section_phase(v_player.room_id, 'photo') <> 'guessing' then
    return json_build_object('ok', false, 'error', 'not_guessing');
  end if;

  if not exists (
    select 1 from public.photos
    where id = p_photo_id and room_id = v_player.room_id and player_id <> v_player.id
  ) then
    return json_build_object('ok', false, 'error', 'unknown_photo');
  end if;

  if p_guessed_player_id = v_player.id or not exists (
    select 1 from public.players where id = p_guessed_player_id and room_id = v_player.room_id
  ) then
    return json_build_object('ok', false, 'error', 'unknown_player');
  end if;

  insert into public.photo_guesses (photo_id, guesser_id, guessed_player_id)
  values (p_photo_id, v_player.id, p_guessed_player_id)
  on conflict (photo_id, guesser_id) do update
    set guessed_player_id = excluded.guessed_player_id, created_at = now();

  return json_build_object('ok', true);
end;
$$;

-- ── Admin ───────────────────────────────────────────────────────────────────

-- Fas och hur många som laddat upp. Aldrig bilderna eller vem som äger vilken.
create function public.photo_admin_overview()
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
    'phase', public.section_phase(v_admin.room_id, 'photo'),
    'player_count', (select count(*) from public.players where room_id = v_admin.room_id),
    'uploaded_count', (
      select count(*) from public.photos ph
      where ph.room_id = v_admin.room_id and public.photo_uploaded(ph.path)
    )
  );
end;
$$;

revoke execute on function public.photo_reserve() from public, anon;
revoke execute on function public.photo_player_state() from public, anon;
revoke execute on function public.photo_submit_guess(uuid, uuid) from public, anon;
revoke execute on function public.photo_admin_overview() from public, anon;
grant execute on function public.photo_reserve() to authenticated;
grant execute on function public.photo_player_state() to authenticated;
grant execute on function public.photo_submit_guess(uuid, uuid) to authenticated;
grant execute on function public.photo_admin_overview() to authenticated;