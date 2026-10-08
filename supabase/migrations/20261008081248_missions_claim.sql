-- Uppdrag: spelarna drar ett slumpat uppdrag, ser sitt eget igen, och värden avslöjar alla på båten.
-- Poäng och eventuell gissning läggs till när det är bestämt.

-- Vem som fått uppdraget. Ett uppdrag per spelare.
alter table public.missions
  add column claimed_by uuid unique references public.players on delete set null,
  add column claimed_at timestamptz;

-- Som tidigare, plus faserna för uppdragen.
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
    when p_key in ('flyg', 'plattor', 'pricka') then array['closed', 'open', 'finished']
  end;
$$;

-- Ger anroparen ett slumpat uppdrag som ingen annan har. Har spelaren redan ett returneras det.
create function public.mission_claim()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_player public.players := public.my_player();
  v_mission public.missions;
begin
  if v_player.id is null then
    raise exception 'not in a room' using errcode = '42501';
  end if;

  if public.section_phase(v_player.room_id, 'missions') <> 'open' then
    return json_build_object('ok', false, 'error', 'not_open');
  end if;

  select * into v_mission from public.missions where claimed_by = v_player.id;
  if v_mission.id is not null then
    return json_build_object('ok', true, 'text', v_mission.text);
  end if;

  -- "skip locked": två spelare som drar samtidigt får aldrig samma uppdrag.
  select * into v_mission
  from public.missions
  where room_id = v_player.room_id and claimed_by is null
  order by random()
  limit 1
  for update skip locked;

  if v_mission.id is null then
    return json_build_object('ok', false, 'error', 'none_left');
  end if;

  update public.missions set claimed_by = v_player.id, claimed_at = now() where id = v_mission.id;
  return json_build_object('ok', true, 'text', v_mission.text);
end;
$$;

-- Vad Uppdrag-fliken ska visa, per fas.
--   open:     anroparens uppdrag, eller null om hen inte dragit något än.
--   revealed: alla spelare med sitt uppdrag (null för den som aldrig drog).
create function public.mission_player_state()
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

  v_phase := public.section_phase(v_player.room_id, 'missions');

  if v_phase = 'open' then
    return json_build_object(
      'phase', v_phase,
      'my_mission', (select text from public.missions where claimed_by = v_player.id)
    );
  end if;

  if v_phase = 'revealed' then
    return json_build_object(
      'phase', v_phase,
      'my_player_id', v_player.id,
      'reveal', coalesce((
        select json_agg(
          json_build_object('player_id', p.id, 'username', p.username, 'mission', m.text)
          order by lower(p.username)
        )
        from public.players p
        left join public.missions m on m.claimed_by = p.id
        where p.room_id = v_player.room_id
      ), '[]'::json)
    );
  end if;

  return json_build_object('phase', v_phase);
end;
$$;

-- Som tidigare, plus fasen och hur många som dragit ett uppdrag. Aldrig texterna.
create or replace function public.admin_missions_overview()
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
    'phase', public.section_phase(v_admin.room_id, 'missions'),
    'mission_count', (select count(*) from public.missions where room_id = v_admin.room_id),
    'claimed_count', (
      select count(*) from public.missions where room_id = v_admin.room_id and claimed_by is not null
    ),
    'player_count', (select count(*) from public.players where room_id = v_admin.room_id)
  );
end;
$$;

revoke execute on function public.mission_claim() from public, anon;
revoke execute on function public.mission_player_state() from public, anon;
grant execute on function public.mission_claim() to authenticated;
grant execute on function public.mission_player_state() to authenticated;