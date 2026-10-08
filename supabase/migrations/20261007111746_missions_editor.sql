-- Uppdrag: redaktören (den utomstående) skriver uppdragen. Hur de delas ut och poängsätts
-- byggs när varianten är bestämd.

-- Ett uppdrag är bara fri text. Nämns en kollega skriver redaktören en reserv i texten.
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms on delete cascade,
  text text not null check (length(trim(text)) between 1 and 300),
  created_at timestamptz not null default now()
);

create index on public.missions (room_id, created_at);

-- Hemligt: värden spelar och får aldrig se uppdragen. Nås bara via funktioner.
alter table public.missions enable row level security;

-- ── Redaktör ────────────────────────────────────────────────────────────────

-- Redaktörens uppdrag, och om de fortfarande går att ändra.
create function public.editor_missions()
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
    'editable', public.section_phase(v_room_id, 'missions') = 'closed',
    'missions', coalesce((
      select json_agg(json_build_object('id', id, 'text', text) order by created_at)
      from public.missions where room_id = v_room_id
    ), '[]'::json)
  );
end;
$$;

-- Lägger till (p_mission_id null) eller ändrar ett uppdrag. Bara innan värden öppnat uppdragen.
create function public.editor_save_mission(p_mission_id uuid, p_text text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid := public.my_editor_room_id();
  v_text text := trim(p_text);
begin
  if v_room_id is null then
    raise exception 'not editor' using errcode = '42501';
  end if;

  if public.section_phase(v_room_id, 'missions') <> 'closed' then
    return json_build_object('ok', false, 'error', 'not_editable');
  end if;

  if v_text is null or length(v_text) not between 1 and 300 then
    return json_build_object('ok', false, 'error', 'invalid_text');
  end if;

  if p_mission_id is null then
    insert into public.missions (room_id, text) values (v_room_id, v_text);
  else
    update public.missions set text = v_text where id = p_mission_id and room_id = v_room_id;
    if not found then
      return json_build_object('ok', false, 'error', 'unknown_mission');
    end if;
  end if;

  return json_build_object('ok', true);
end;
$$;

-- Tar bort ett uppdrag. Bara innan värden öppnat uppdragen.
create function public.editor_delete_mission(p_mission_id uuid)
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

  if public.section_phase(v_room_id, 'missions') <> 'closed' then
    return json_build_object('ok', false, 'error', 'not_editable');
  end if;

  delete from public.missions where id = p_mission_id and room_id = v_room_id;
  return json_build_object('ok', true);
end;
$$;

-- ── Admin ───────────────────────────────────────────────────────────────────

-- Hur många uppdrag redaktören lagt in, och hur många spelare som finns. Aldrig texterna.
create function public.admin_missions_overview()
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
    'mission_count', (select count(*) from public.missions where room_id = v_admin.room_id),
    'player_count', (select count(*) from public.players where room_id = v_admin.room_id)
  );
end;
$$;

revoke execute on function public.editor_missions() from public, anon;
revoke execute on function public.editor_save_mission(uuid, text) from public, anon;
revoke execute on function public.editor_delete_mission(uuid) from public, anon;
revoke execute on function public.admin_missions_overview() from public, anon;
grant execute on function public.editor_missions() to authenticated;
grant execute on function public.editor_save_mission(uuid, text) to authenticated;
grant execute on function public.editor_delete_mission(uuid) to authenticated;
grant execute on function public.admin_missions_overview() to authenticated;