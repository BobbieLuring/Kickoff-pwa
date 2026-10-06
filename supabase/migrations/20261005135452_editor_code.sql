-- Redaktörskod: en utomstående som inte spelar kan lägga in innehåll i ett rum.
-- Koden skrivs på samma startskärm som rumskoden.

alter table public.rooms add column editor_code text unique;

-- Anonyma sessioner som angett en redaktörskod. En session är redaktör i högst ett rum åt gången.
create table public.room_editors (
  user_id uuid primary key,
  room_id uuid not null references public.rooms on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.room_editors enable row level security;

-- Slumpar en kod som varken är en rumskod eller en redaktörskod.
create function public.generate_unused_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  for i in 1..10 loop
    v_code := public.generate_room_code();
    if not exists (select 1 from public.rooms where code = v_code or editor_code = v_code) then
      return v_code;
    end if;
  end loop;
  raise exception 'could not generate a free code after 10 tries';
end;
$$;

-- Rummet anroparen är redaktör i, eller null. Stängda rum räknas inte.
create function public.my_editor_room_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.room_id
  from public.room_editors e
  join public.rooms r on r.id = e.room_id
  where e.user_id = auth.uid() and r.closed_at is null;
$$;

revoke execute on function public.generate_unused_code() from public, anon, authenticated;
revoke execute on function public.my_editor_room_id() from public, anon, authenticated;

-- Startskärmen: avgör om koden är en rumskod eller en redaktörskod.
-- Samma spärr som check_room_code: 5 fel i rad spärrar enheten i 15 minuter.
create function public.enter_code(p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_locked_until timestamptz;
  v_room public.rooms;
  v_failure json;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  v_locked_until := public.login_locked_until('code', v_uid);
  if v_locked_until is not null then
    return json_build_object('ok', false, 'attempts_left', 0, 'locked_until', v_locked_until);
  end if;

  select * into v_room from public.rooms where code = v_code and closed_at is null;
  if v_room.id is not null then
    perform public.record_login_attempt('code', v_uid, true, 5, interval '15 minutes');
    return json_build_object('ok', true, 'kind', 'room', 'room_name', v_room.name);
  end if;

  select * into v_room from public.rooms where editor_code = v_code and closed_at is null;
  v_failure := public.record_login_attempt('code', v_uid, v_room.id is not null, 5, interval '15 minutes');
  if v_failure is not null then
    return v_failure;
  end if;

  insert into public.room_editors (user_id, room_id) values (v_uid, v_room.id)
  on conflict (user_id) do update set room_id = excluded.room_id, created_at = now();

  return json_build_object('ok', true, 'kind', 'editor', 'room_name', v_room.name);
end;
$$;

-- Admin: rummets redaktörskod. Skapas första gången den efterfrågas.
create function public.admin_editor_code()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.players := public.require_admin_player();
  v_code text;
begin
  select editor_code into v_code from public.rooms where id = v_admin.room_id for update;
  if v_code is null then
    v_code := public.generate_unused_code();
    update public.rooms set editor_code = v_code where id = v_admin.room_id;
  end if;
  return json_build_object('ok', true, 'code', v_code);
end;
$$;

-- Admin: ger rummet en ny redaktörskod. Den gamla slutar gälla, och tidigare redaktörer loggas ut.
create function public.admin_regenerate_editor_code()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin public.players := public.require_admin_player();
  v_code text := public.generate_unused_code();
begin
  update public.rooms set editor_code = v_code where id = v_admin.room_id;
  delete from public.room_editors where room_id = v_admin.room_id;
  return json_build_object('ok', true, 'code', v_code);
end;
$$;

-- Redaktörens vy: vilket rum hen redigerar, eller null om sessionen inte är redaktör.
create function public.editor_room()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object('room_name', r.name)
  from public.rooms r
  where r.id = public.my_editor_room_id();
$$;

revoke execute on function public.enter_code(text) from public, anon;
revoke execute on function public.admin_editor_code() from public, anon;
revoke execute on function public.admin_regenerate_editor_code() from public, anon;
revoke execute on function public.editor_room() from public, anon;
grant execute on function public.enter_code(text) to authenticated;
grant execute on function public.admin_editor_code() to authenticated;
grant execute on function public.admin_regenerate_editor_code() to authenticated;
grant execute on function public.editor_room() to authenticated;